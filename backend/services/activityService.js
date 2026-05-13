import { supabase } from "../config/database.js";

export async function logActivity({
  adminId,
  actionType,
  targetType = null,
  targetId = null,
  targetLabel = null,
  metadata = {},
}) {
  try {
    await supabase.from("activity_logs").insert({
      admin_id: adminId,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId != null ? String(targetId) : null,
      target_label: targetLabel,
      metadata,
    });
  } catch (err) {
    console.error("[Activity Log Error]:", err.message);
  }
}
