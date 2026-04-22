/**
 * Send transactional email via Resend (https://resend.com).
 * Set RESEND_API_KEY and RESEND_FROM_EMAIL in the server environment.
 */

const RESEND_API = "https://api.resend.com/emails";
const DEFAULT_FROM = "MISD Help Desk <onboarding@resend.dev>";

function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

/**
 * @param {object} options
 * @param {string} options.to
 * @param {string} [options.fullName]
 * @param {string} options.verifyUrl — link with signed token (our origin + /admin/verify-email?token=…)
 * @returns {Promise<{ success: true, id?: string } | { success: false, error: string }>}
 */
export async function sendAdminVerificationEmail({ to, fullName, verifyUrl }) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        return { success: false, error: "RESEND_API_KEY is not set" };
    }

    // Resend only allows sending from verified domains (or the onboarding@resend.dev sandbox).
    // For testing, if the configured FROM domain isn't verified, fall back to the sandbox sender
    // so the invite flow still works.
    const configuredFrom = String(process.env.RESEND_FROM_EMAIL || "").trim();
    const from = configuredFrom || DEFAULT_FROM;
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

    const send = async (payloadFrom) => {
        return await fetch(RESEND_API, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: payloadFrom, to: [to], subject, html }),
        });
    };

    let res = await send(from);

    let body;
    try {
        body = await res.json();
    } catch {
        body = {};
    }

    // If the FROM domain isn't verified, retry once using the sandbox sender.
    if (
        !res.ok &&
        configuredFrom &&
        (body?.message || "").toLowerCase().includes("domain is not verified")
    ) {
        res = await send(DEFAULT_FROM);
        try {
            body = await res.json();
        } catch {
            body = {};
        }
    }

    if (!res.ok) {
        const msg = body?.message || body?.name || res.statusText || "Resend request failed";
        return { success: false, error: String(msg) };
    }

    return { success: true, id: body.id };
}
