#!/usr/bin/env bash
# Setup + run LPU MISD Ticketing on Linux.
# Usage: ./run.sh [setup|clean|dev|build|backend|frontend|prod]
#   (no arg) -> setup if needed, then run backend + frontend in dev
#   setup    -> install deps + scaffold .env files only
#   clean    -> wipe node_modules + lockfiles, fresh reinstall (fixes cross-OS native binding errors)
#   dev      -> run backend + frontend (assumes already set up)
#   backend  -> run backend only (dev)
#   frontend -> run frontend only (dev)
#   build    -> production build of frontend (-> dist/)
#   prod     -> full production: install (npm ci) + build + serve dist + backend (NODE_ENV=production)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Production-tunable ports.
FRONT_PORT="${FRONT_PORT:-4173}"
BACK_PORT="${PORT:-5000}"

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    red "Node.js not found. Install Node 20+ first (e.g. via nvm or your package manager)."
    exit 1
  fi
  local major
  major="$(node -v | sed -E 's/v([0-9]+).*/\1/')"
  if [ "$major" -lt 20 ]; then
    yellow "Node $(node -v) detected. Node 20+ recommended (Vite 7 / React 19)."
  fi
}

scaffold_env() {
  if [ ! -f "$ROOT/.env" ] && [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    yellow "Created .env from .env.example — fill in real values."
  fi
}

# Fail fast if env files missing or still hold placeholder values.
require_env() {
  local missing=0
  if [ ! -f "$ROOT/.env" ]; then
    red ".env missing. Run ./run.sh setup and fill in real values."
    missing=1
  fi
  if [ "$missing" -ne 0 ]; then exit 1; fi
}

# Clean, reproducible install. npm ci when a lockfile exists, else npm install.
install_deps() {
  local flag="${1:-install}"
  local cmd="install"
  if [ "$flag" = "ci" ]; then cmd="ci"; fi

  green "Installing frontend deps (npm $cmd)..."
  if [ "$cmd" = "ci" ] && [ ! -f "$ROOT/package-lock.json" ]; then
    yellow "No package-lock.json — falling back to npm install."
    npm install
  else
    npm "$cmd"
  fi

  green "Installing backend deps (npm $cmd)..."
  if [ "$cmd" = "ci" ] && [ ! -f "$ROOT/backend/package-lock.json" ]; then
    yellow "No backend/package-lock.json — falling back to npm install."
    (cd "$ROOT/backend" && npm install)
  else
    (cd "$ROOT/backend" && npm "$cmd")
  fi
}

# Wipe node_modules + lockfiles and reinstall from scratch.
# Fixes npm optional-dep bug (npm/cli#4828): a lockfile committed from another
# OS/arch omits this platform's native optional deps (e.g. @tailwindcss/oxide),
# causing "Cannot find native binding" at runtime.
clean_install() {
  yellow "Cleaning node_modules and lockfiles (cross-platform native binding fix)..."
  rm -rf "$ROOT/node_modules" "$ROOT/package-lock.json"
  rm -rf "$ROOT/backend/node_modules" "$ROOT/backend/package-lock.json"

  green "Reinstalling frontend deps (npm install)..."
  npm install
  green "Reinstalling backend deps (npm install)..."
  (cd "$ROOT/backend" && npm install)
}

# Verify the platform-native Tailwind oxide binding actually loads.
# Returns non-zero when node_modules was installed from a foreign-OS lockfile
# and the native optional dep is missing (npm/cli#4828).
oxide_ok() {
  [ -d "$ROOT/node_modules/@tailwindcss/oxide" ] || return 1
  node -e 'require("@tailwindcss/oxide")' >/dev/null 2>&1
}

# Self-heal: if the native binding is broken, wipe + reinstall automatically.
ensure_native_bindings() {
  if [ ! -d "$ROOT/node_modules" ]; then return 0; fi
  if oxide_ok; then return 0; fi
  yellow "Tailwind native binding missing/broken — auto-cleaning (npm/cli#4828)..."
  clean_install
  if ! oxide_ok; then
    red "Native binding still missing after clean install. Node: $(node -v) $(node -p process.platform)-$(node -p process.arch)"
    exit 1
  fi
}

setup() {
  check_node
  scaffold_env
  install_deps install
  green "Setup done. Edit .env, then run: ./run.sh dev"
}

run_backend() {
  green "Starting backend on :$BACK_PORT ..."
  (cd "$ROOT/backend" && npm start)
}

run_frontend() {
  green "Starting frontend (Vite) ..."
  npm run dev -- --host
}

run_dev() {
  # Run both; kill both on Ctrl-C.
  green "Starting backend + frontend (Ctrl-C to stop both)..."
  (cd "$ROOT/backend" && npm start) &
  BACK_PID=$!
  npm run dev -- --host &
  FRONT_PID=$!
  trap 'kill $BACK_PID $FRONT_PID 2>/dev/null || true' INT TERM EXIT
  wait
}

# Full production run: install + build + serve static dist + backend.
run_prod() {
  check_node
  require_env
  install_deps ci
  ensure_native_bindings

  green "Building frontend (production)..."
  npm run build

  if [ ! -d "$ROOT/dist" ]; then
    red "Build produced no dist/ — aborting."
    exit 1
  fi

  green "Starting production: backend :$BACK_PORT + static frontend :$FRONT_PORT (Ctrl-C to stop both)..."

  # Backend in production mode.
  (cd "$ROOT/backend" && NODE_ENV=production PORT="$BACK_PORT" npm start) &
  BACK_PID=$!

  # Serve built dist. vite preview serves the production build as-is.
  npm run preview -- --host --port "$FRONT_PORT" &
  FRONT_PID=$!

  trap 'kill $BACK_PID $FRONT_PID 2>/dev/null || true' INT TERM EXIT
  wait
}

CMD="${1:-}"
case "$CMD" in
  setup) setup ;;
  clean) check_node; clean_install; green "Clean install done. Run: ./run.sh dev" ;;
  dev) check_node; ensure_native_bindings; run_dev ;;
  backend) check_node; run_backend ;;
  frontend) check_node; ensure_native_bindings; run_frontend ;;
  build) check_node; ensure_native_bindings; npm run build ;;
  prod) run_prod ;;
  "")
    # First run convenience: setup if deps missing, then dev.
    if [ ! -d "$ROOT/node_modules" ] || [ ! -d "$ROOT/backend/node_modules" ]; then
      setup
    else
      scaffold_env
    fi
    ensure_native_bindings
    run_dev
    ;;
  *)
    red "Unknown command: $CMD"
    echo "Usage: ./run.sh [setup|clean|dev|build|backend|frontend|prod]"
    exit 1
    ;;
esac
