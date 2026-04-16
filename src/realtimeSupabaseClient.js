import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
