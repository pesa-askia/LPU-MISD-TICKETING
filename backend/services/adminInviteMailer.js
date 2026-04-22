import nodemailer from "nodemailer";

const DEFAULT_FROM = "MISD Help Desk <onboarding@resend.dev>";
const debugEnabled = () =>
  String(process.env.ADMIN_INVITE_DEBUG || "").trim().toLowerCase() === "true";

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const smtpConfigured = () =>
  Boolean(String(process.env.ADMIN_INVITE_SMTP_HOST || "").trim()) &&
  Boolean(String(process.env.ADMIN_INVITE_SMTP_USER || "").trim()) &&
  Boolean(String(process.env.ADMIN_INVITE_SMTP_PASS || "").trim());

const createTransport = () => {
  const host = String(process.env.ADMIN_INVITE_SMTP_HOST || "").trim();
  const port = Number(process.env.ADMIN_INVITE_SMTP_PORT || 587);
  const secure = String(process.env.ADMIN_INVITE_SMTP_SECURE || "").trim() === "true" || port === 465;
  const user = String(process.env.ADMIN_INVITE_SMTP_USER || "").trim();
  const pass = String(process.env.ADMIN_INVITE_SMTP_PASS || "").trim();

  if (debugEnabled()) {
    console.log("[admin-invite][smtp] configured", {
      host,
      port,
      secure,
      user_present: Boolean(user),
      pass_present: Boolean(pass),
      from: String(process.env.ADMIN_INVITE_FROM_EMAIL || "").trim() || DEFAULT_FROM,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

export function isAdminInviteEmailEnabled() {
  const enabled =
    smtpConfigured() || Boolean(String(process.env.RESEND_API_KEY || "").trim());
  if (debugEnabled()) {
    console.log("[admin-invite] enabled", {
      smtpConfigured: smtpConfigured(),
      resendApiKeyPresent: Boolean(String(process.env.RESEND_API_KEY || "").trim()),
    });
  }
  return enabled;
}

/**
 * Admin-invite email sender:
 * - Prefers SMTP (ADMIN_INVITE_SMTP_*)
 * - Falls back to Resend HTTP API (RESEND_API_KEY)
 */
export async function sendAdminInviteEmail({ to, fullName, verifyUrl }) {
  const name = escapeHtml(fullName || "there");
  const subject = "Verify your MISD Help Desk admin account";
  const html = `<!doctype html>
<html><body style="font-family:Segoe UI,system-ui,sans-serif;line-height:1.5;color:#1a1a1a">
  <p>Hi ${name},</p>
  <p>You were invited as an <strong>admin</strong> for the LPU MISD Help Desk ticketing system.
     Click the button below to verify this email and activate your account. You must complete this
     step before you can sign in to the admin portal.</p>
  <p style="margin:24px 0">
    <a href="${verifyUrl}" style="background:#8c0001;color:#fff;padding:12px 22px;border-radius:999px;
      text-decoration:none;font-weight:600;display:inline-block">Verify email &amp; activate</a>
  </p>
  <p style="font-size:12px;color:#666">If the button does not work, paste this link into your browser:</p>
  <p style="font-size:12px;word-break:break-all"><a href="${verifyUrl}">${escapeHtml(verifyUrl)}</a></p>
  <p style="font-size:12px;color:#666">This link expires in 7 days.</p>
</body></html>`;

  // 1) SMTP
  if (smtpConfigured()) {
    try {
      const transporter = createTransport();
      const from = String(process.env.ADMIN_INVITE_FROM_EMAIL || "").trim() || DEFAULT_FROM;
      if (debugEnabled()) {
        console.log("[admin-invite][smtp] sending", {
          to,
          from,
          subject,
          verifyUrl_preview: String(verifyUrl || "").slice(0, 60),
        });
      }
      const info = await transporter.sendMail({ from, to, subject, html });
      if (debugEnabled()) {
        console.log("[admin-invite][smtp] sent", {
          messageId: info?.messageId,
          response: info?.response,
        });
      }
      return { success: true, provider: "smtp", id: info?.messageId };
    } catch (e) {
      if (debugEnabled()) {
        console.error("[admin-invite][smtp] error", e);
      }
      return { success: false, provider: "smtp", error: e?.message || "SMTP send failed" };
    }
  }

  // 2) Resend HTTP API fallback (existing)
  if (debugEnabled()) {
    console.log("[admin-invite][resend] fallback", {
      to,
      resendApiKeyPresent: Boolean(String(process.env.RESEND_API_KEY || "").trim()),
    });
  }
  const { sendAdminVerificationEmail } = await import("./resendService.js");
  const r = await sendAdminVerificationEmail({ to, fullName, verifyUrl });
  return r.success
    ? { success: true, provider: "resend", id: r.id }
    : { success: false, provider: "resend", error: r.error || "Resend send failed" };
}

