const debugEnabled = () =>
  String(process.env.ADMIN_INVITE_DEBUG || "").trim().toLowerCase() === "true";

export function isAdminInviteEmailEnabled() {
  return true; // Supabase inviteUserByEmail uses the project's configured email provider
}

export async function sendAdminInviteEmail() {
  // No-op: email is now sent directly via supabase.auth.admin.inviteUserByEmail in routes/admin.js
}
