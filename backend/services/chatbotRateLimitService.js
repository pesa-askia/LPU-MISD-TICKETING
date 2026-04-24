import { supabase } from "../config/database.js";

// --- Rate limit (env-tunable; no separate shared module) ---
const envGet = (env, k) => {
  if (!env) return undefined;
  return env[k] ?? env[`VITE_${k}`];
};

const parseList = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const parts = raw
    .split(/[\s,|]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts;
};

function getChatbotWindowMs(env) {
  const v = Number(
    envGet(env, "CHATBOT_LIMIT_WINDOW_MS") ||
      envGet(env, "CHATBOT_RATE_WINDOW_MS"),
  );
  if (v > 0) return v;
  return 24 * 60 * 60 * 1000;
}

/** Spacing after each successful message (enforcing "too fast" only for sends before this). 0 = no min gap. */
function getMinMessageGapMs(env) {
  const v = Number(envGet(env, "CHATBOT_MIN_MESSAGE_GAP_MS"));
  if (v >= 0) return v;
  return 2_000;
}

function buildCooldownTiersMs(env) {
  const msList = parseList(
    String(envGet(env, "CHATBOT_COOLDOWNS_MS") || "").trim() || null,
  );
  if (msList) {
    const out = msList
      .map((s) => Math.max(0, Math.round(Number(s))))
      .filter((n) => n > 0);
    if (out.length) return out;
  }
  const secList = parseList(
    String(envGet(env, "CHATBOT_COOLDOWNS_SEC") || "").trim() || null,
  );
  if (secList) {
    const out = secList
      .map((s) => Math.max(0, Math.round(Number(s) * 1000)))
      .filter((n) => n > 0);
    if (out.length) return out;
  }
  const baseMs = Number(envGet(env, "CHATBOT_COOLDOWN_BASE_MS")) || 45_000;
  const growth = Number(envGet(env, "CHATBOT_COOLDOWN_GROWTH")) || 2.35;
  const steps = Math.max(
    1,
    Math.min(20, Math.floor(Number(envGet(env, "CHATBOT_COOLDOWN_STEPS")) || 6)),
  );
  const capMs = Math.max(
    baseMs,
    Number(envGet(env, "CHATBOT_COOLDOWN_MAX_MS")) || 30 * 60 * 1000,
  );
  const out = [];
  for (let i = 0; i < steps; i += 1) {
    out.push(
      Math.min(capMs, Math.max(1_000, Math.round(baseMs * growth ** i))),
    );
  }
  return out;
}

let _tiersCache = null;
let _tiersKey = "";
function getTiersMs(env) {
  const k = JSON.stringify({
    a: envGet(env, "CHATBOT_COOLDOWNS_MS"),
    b: envGet(env, "CHATBOT_COOLDOWNS_SEC"),
    c: envGet(env, "CHATBOT_COOLDOWN_BASE_MS"),
    d: envGet(env, "CHATBOT_COOLDOWN_GROWTH"),
    e: envGet(env, "CHATBOT_COOLDOWN_STEPS"),
    f: envGet(env, "CHATBOT_COOLDOWN_MAX_MS"),
  });
  if (k === _tiersKey && _tiersCache) return _tiersCache;
  _tiersCache = buildCooldownTiersMs(env);
  _tiersKey = k;
  return _tiersCache;
}

/** How long the user must wait after a *violation* (send while cooldown was active). 1st violation → tiers[0], etc. */
function getPenaltyCooldownMsForViolationIndex(violationIndex, env) {
  const n = Math.max(1, Math.floor(violationIndex));
  const tiers = getTiersMs(env);
  if (!tiers.length) return 60_000;
  const idx = Math.min(n - 1, tiers.length - 1);
  return tiers[idx];
}

// In-memory fallback so cooldown still works even when Supabase/RPC/table/RLS
// is misconfigured. This won't persist across server restarts or multiple instances,
// but it prevents "no limiter at all" in dev and misconfigured deployments.
const memoryLimiter = new Map();

function toIso(date) {
  return date.toISOString();
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Enforces per-account cooldowns.
 * `chat_count` in storage = **violation** count (sends that occurred while a cooldown was active), not every chat.
 * Successful sends get only a short min gap; that gap does not increase the violation count.
 */
export async function enforceChatbotAccountCooldown({ userId, sessionId }) {
  // Prefer per-account. If auth is missing (token not sent/invalid), fall back to sessionId
  // so the UI still enforces cooldowns during testing and for anonymous sessions.
  const key = userId
    ? `user:${userId}`
    : sessionId
      ? `session:${sessionId}`
      : null;
  const keyType = userId ? "user" : sessionId ? "session" : null;
  if (!key) return { allowed: true };
  const now = new Date();

  // chatCount in map = violation count
  const readMemory = () => {
    const entry = memoryLimiter.get(key) || {
      chatCount: 0,
      cooldownUntil: null,
      windowStart: null,
      updatedAt: null,
    };
    return {
      violationCount: Number(entry.chatCount || 0),
      cooldownUntil: parseDate(entry.cooldownUntil),
      windowStart: parseDate(entry.windowStart),
      updatedAt: parseDate(entry.updatedAt),
    };
  };

  const writeMemory = ({ violationCount, cooldownUntil, windowStart }) => {
    memoryLimiter.set(key, {
      chatCount: Number(violationCount || 0),
      cooldownUntil: cooldownUntil ? toIso(cooldownUntil) : null,
      windowStart: windowStart ? toIso(windowStart) : null,
      updatedAt: toIso(now),
    });
  };

  const windowExpired = (ws) => {
    if (!ws) return true;
    const w = getChatbotWindowMs(process.env);
    return now.getTime() - ws.getTime() > w;
  };

  /** When window elapses, count resets and short-term cooldown is cleared. */
  const applyWindowReset = (memState, row) => {
    const dbWs = parseDate(row?.window_start);
    const memWs = memState.windowStart;
    const bestWs = dbWs || memWs;
    if (windowExpired(bestWs)) {
      return {
        windowStart: now,
        violationCount: 0,
        cooldownUntil: null,
        sourceTag: "window_reset",
      };
    }
    return {
      windowStart: bestWs,
      violationCount: Math.max(
        Number(row?.chat_count || 0),
        Number(memState.violationCount || 0),
      ),
      cooldownUntil: (() => {
        const dbC = parseDate(row?.cooldown_until);
        const mC = memState.cooldownUntil;
        if (dbC && mC) return new Date(Math.max(dbC.getTime(), mC.getTime()));
        return dbC || mC;
      })(),
      sourceTag: "active",
    };
  };

  const onCooldownHit = async (merged, { persistDb }) => {
    const nextV = merged.violationCount + 1;
    const penaltyMs = getPenaltyCooldownMsForViolationIndex(nextV, process.env);
    const nextCd = new Date(now.getTime() + penaltyMs);
    const ws = merged.windowStart;
    writeMemory({
      violationCount: nextV,
      cooldownUntil: nextCd,
      windowStart: ws,
    });
    if (persistDb) {
      const up = {
        key,
        user_id: userId || null,
        chat_count: nextV,
        cooldown_until: toIso(nextCd),
        window_start: toIso(ws),
        updated_at: toIso(now),
      };
      const { error: upErr } = await supabase
        .from("chatbot_account_limits")
        .upsert(up, { onConflict: "key" });
      if (upErr) {
        console.warn("[Chatbot limiter] violation upsert failed:", upErr.message);
      }
    }
    return {
      allowed: false,
      retryAfterMs: penaltyMs,
      cooldownUntil: toIso(nextCd),
      violationCount: nextV,
      source: persistDb ? "db" : "memory",
      keyType,
    };
  };

  const onAllowed = async (merged, { persistDb }) => {
    const gap = getMinMessageGapMs(process.env);
    const nextCd = gap > 0 ? new Date(now.getTime() + gap) : null;
    const ws = merged.windowStart;
    writeMemory({
      violationCount: merged.violationCount,
      cooldownUntil: nextCd,
      windowStart: ws,
    });
    if (persistDb) {
      const up = {
        key,
        user_id: userId || null,
        chat_count: merged.violationCount,
        cooldown_until: nextCd ? toIso(nextCd) : null,
        window_start: toIso(ws),
        updated_at: toIso(now),
      };
      const { error: upErr } = await supabase
        .from("chatbot_account_limits")
        .upsert(up, { onConflict: "key" });
      if (upErr) {
        console.warn("[Chatbot limiter] allow upsert failed:", upErr.message);
        return { allowed: true, source: "memory", keyType };
      }
    }
    return { allowed: true, source: persistDb ? "db" : "memory", keyType };
  };

  const enforceInMemory = async () => {
    const m = readMemory();
    const merged = applyWindowReset(m, null);
    if (merged.cooldownUntil && now < merged.cooldownUntil) {
      return onCooldownHit(merged, { persistDb: false });
    }
    return onAllowed(merged, { persistDb: false });
  };

  const mem = readMemory();

  const { data: row, error: readErr } = await supabase
    .from("chatbot_account_limits")
    .select("key, user_id, chat_count, cooldown_until, window_start, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (readErr) {
    console.warn("[Chatbot limiter] read failed:", readErr.message);
    return enforceInMemory();
  }

  const merged = applyWindowReset(mem, row);
  if (merged.cooldownUntil && now < merged.cooldownUntil) {
    return onCooldownHit(merged, { persistDb: true });
  }
  return onAllowed(merged, { persistDb: true });
}

