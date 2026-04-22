import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import lpuLogo from "../../assets/lpul-logo.png";
import "./AdminVerifyEmail.css";

/**
 * Public page opened from the Resend invitation link (?token=...).
 * Finishes sign-up: sets email_verified_at so the new admin can log in.
 */
export default function AdminVerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | ok | err
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("err");
      setMessage("This link is missing a token. Use the full URL from your invitation email.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/auth/verify-admin-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        );
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setStatus("ok");
          setMessage(
            json.message ||
              "Your email is verified. You can sign in to the admin portal.",
          );
        } else {
          setStatus("err");
          setMessage(
            json.message || "Verification failed. The link may have expired.",
          );
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("err");
          setMessage(e.message || "Network error. Try again later.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="admin-verify-page">
      <div className="admin-verify-card">
        <img src={lpuLogo} alt="LPU" />
        <h1>Admin account verification</h1>

        {status === "loading" && <p>Verifying your email…</p>}

        {status === "ok" && (
          <>
            <div className="admin-verify-ok">{message}</div>
            <p>
              <Link to="/" className="admin-verify-back">
                Go to sign in
              </Link>
            </p>
          </>
        )}

        {status === "err" && (
          <>
            <div className="admin-verify-err">{message}</div>
            <p>
              If the problem continues, ask a root admin to confirm your
              account or resend the invitation.
            </p>
            <Link to="/" className="admin-verify-back">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
