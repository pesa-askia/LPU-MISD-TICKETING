// Re-export the existing Supabase client for Auth operations (magic link,
// session exchange). Creating a second client with the same project URL
// triggers "Multiple GoTrueClient instances" warnings and can cause
// undefined behaviour when both share the same localStorage auth key.
//
// The existing realtimeSupabase client is safe to use here because its
// custom authFetch only injects the Authorization header when a custom JWT
// is already in localStorage — i.e. when the user is already logged in.
// During the magic-link flow the user is NOT logged in, so the header is
// never injected and the auth API calls go through cleanly.
export { realtimeSupabase as supabaseAuth } from "./realtimeSupabaseClient.js";
export { realtimeSupabase as default } from "./realtimeSupabaseClient.js";
