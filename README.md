# LPU MISD Ticketing

React/Vite frontend plus an Express/Supabase backend for the LPU MISD help desk ticketing system.

## Requirements

- Node.js 20 or newer
- npm
- Supabase project with the SQL from `backend/schema.sql` applied
- Backend secrets from `backend/.env.example`
- Frontend public env values from `.env.example`

## Setup

1. Copy `.env.example` to `.env`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Fill in real Supabase, JWT, CORS, Resend, and AI provider values.
4. In Supabase SQL Editor, run `backend/schema.sql` once before starting the backend.
5. Install dependencies:

```bash
npm install
cd backend
npm install
```

You can also use `./run.sh setup` on Linux/macOS-style shells.

## Development

Run backend and frontend together:

```bash
./run.sh dev
```

Or run them separately:

```bash
cd backend
npm start
```

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Backend health check: `http://localhost:5000/health`

## Production Build

```bash
npm run build
```

The frontend build is emitted to `dist/`. For Vercel, `vercel.json` serves the Vite SPA and rewrites routes to `index.html`.

Deploy the backend separately with:

```bash
cd backend
npm start
```

Set `VITE_API_BASE_URL_PROD` on the frontend to the deployed backend URL unless you proxy API requests from the same origin.

## Environment Notes

Frontend `.env` values are browser-visible and must only contain public keys, such as the Supabase anon key.

Backend `.env` contains secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`

`MAGIC_LINK_ALLOWED_DOMAINS` is enforced server-side for student magic-link login. The default allowlist is `@lpulaguna.edu.ph,@lpusc.edu.ph`.

When `RESEND_API_KEY` is set, admin email verification is enforced.

## Verification

Use these before handoff or deployment:

```bash
npm run lint
npm run build
npm audit --omit=dev
cd backend
npm audit --omit=dev
```
