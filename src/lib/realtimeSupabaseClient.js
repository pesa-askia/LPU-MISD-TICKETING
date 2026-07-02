import { createClient } from "@supabase/supabase-js";
import { getRuntimeConfig } from "../utils/runtimeConfig.js";

// Pick the Supabase URL that matches how the app was opened. When reached over
// plain HTTP (LAN direct, e.g. http://10.1.10.12:8083) use the local-IP
// Supabase so traffic stays on the LAN and avoids mixed-content. When reached
// over HTTPS (Cloudflare tunnel) use the public hostname. Falls back to
// whichever value is set when only one is configured.
const resolveSupabaseUrl = () => {
  const publicUrl = getRuntimeConfig("VITE_SUPABASE_URL");
  const localUrl = getRuntimeConfig("VITE_SUPABASE_URL_LOCAL");
  const isHttp =
    typeof window !== "undefined" && window.location.protocol === "http:";
  if (isHttp && localUrl) return localUrl;
  return publicUrl || localUrl;
};

const SUPABASE_URL = resolveSupabaseUrl();
const ANON_KEY = getRuntimeConfig("VITE_SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing Supabase environment variables for Realtime client.");
}

// Inject the user's JWT on every request so Supabase RLS policies can enforce
// row-level access. Falls back to anon behaviour when no token is present.
// Uses the Headers constructor to correctly handle both plain objects and
// Headers instances, ensuring the apikey header is never accidentally dropped.
const authFetch = (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (!headers.has("apikey")) headers.set("apikey", ANON_KEY);
  const token = localStorage.getItem("authToken");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
};

export const realtimeSupabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: {
    // Implicit flow puts the token directly in the URL hash — no PKCE code
    // exchange needed. This avoids the "expired" error that happens when:
    // (a) detectSessionInUrl auto-exchanges the code AND our callback tries
    //     to exchange it again (double exchange), or
    // (b) the email is opened in a different browser where the PKCE verifier
    //     is not stored.
    flowType: "implicit",
  },
  global: { fetch: authFetch },
});

// Authenticate the Realtime WebSocket on page refresh (token already in
// localStorage). For fresh logins, setAuth is called in LoginPage and
// MagicLinkCallback right after the token is stored — the module is already
// initialized by then so this line would be a no-op for those cases.
const _storedToken = localStorage.getItem("authToken");
if (_storedToken) {
  realtimeSupabase.realtime.setAuth(_storedToken);
}

export default realtimeSupabase;
