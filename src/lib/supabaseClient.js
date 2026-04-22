// Consolidated: re-exports the official @supabase/supabase-js client so all code
// uses the same instance. The hand-rolled REST wrapper has been removed.
// Ticket CRUD is routed through the Express backend — this client is used only
// for Supabase Realtime subscriptions and Storage uploads.
import { realtimeSupabase } from "./realtimeSupabaseClient.js";

export const supabase = realtimeSupabase;
export default realtimeSupabase;
