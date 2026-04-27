import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import supabaseAuth from "../lib/supabaseAuthClient";
import { realtimeSupabase } from "../lib/realtimeSupabaseClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import lpuLogo from "../assets/lpul-logo.png";

export default function AuthVerifyCallback({ mode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (mode === "magic") {
      localStorage.removeItem("authToken");
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userFullName");

      let done = false;

      const exchangeForCustomJwt = async (session) => {
        if (done) return;
        done = true;

        try {
          const res = await fetch(`${getApiBaseUrl()}/api/auth/magic-verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: session.access_token }),
          });

          const data = await res.json();

          if (!res.ok || !data.success) {
            setStatus("err");
            setMessage(
              data.message || "Verification failed. Please try again.",
            );
            return;
          }

          localStorage.setItem("authToken", data.token);
          localStorage.setItem("userId", data.user.id);
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("userEmail", data.user.email);
          localStorage.setItem("userRole", "user");
          localStorage.setItem("userFullName", data.user?.full_name || "");
          realtimeSupabase.realtime.setAuth(data.token);

          // Clear Supabase session locally only — avoids authFetch injecting stale
          // token into Supabase's own /auth/v1/logout call.
          await supabaseAuth.auth.signOut({ scope: "local" });

          navigate("/Tickets", { replace: true });
        } catch (err) {
          console.error("Magic link callback error:", err);
          setStatus("err");
          setMessage(
            "Could not reach the server. Make sure the backend is running and try again.",
          );
        }
      };

      const {
        data: { subscription },
      } = supabaseAuth.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          exchangeForCustomJwt(session);
        }
      });

      supabaseAuth.auth.getSession().then(({ data: { session } }) => {
        if (session && !done) {
          subscription.unsubscribe();
          exchangeForCustomJwt(session);
        }
      });

      const timeout = setTimeout(() => {
        if (!done) {
          done = true;
          setStatus("err");
          setMessage(
            "Magic link has expired or is invalid. Please request a new one.",
          );
        }
      }, 10000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }

    // mode === "admin"
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = searchParams.get("token") || hashParams.get("access_token");
    if (!token) {
      setStatus("err");
      setMessage(
        "This link is missing a token. Use the full URL from your invitation email.",
      );
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
  }, [mode, navigate, searchParams]);

  const title = mode === "magic" ? "Sign in" : "Admin account verification";
  const loadingText =
    mode === "magic" ? "Signing you in…" : "Verifying your email…";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f2f1ef] font-[Poppins,'Segoe_UI',sans-serif]">
      <div className="bg-white rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.08)] max-w-105 w-full px-7 py-8 text-center border-t-4 border-t-lpu-red">
        <img src={lpuLogo} alt="LPU" className="w-18 h-auto mb-4 mx-auto" />
        <h1 className="text-[20px] font-bold text-[#1a1a1a] mb-3">{title}</h1>

        {status === "loading" && (
          <p className="text-sm leading-relaxed text-[#555] mb-5">
            {loadingText}
          </p>
        )}

        {status === "ok" && (
          <>
            <div className="text-[#1b5e20] bg-[#e8f5e9] px-3.5 py-2.5 rounded-[10px] text-[13px] mb-4">
              {message}
            </div>
            <p className="text-sm leading-relaxed text-[#555] mb-5">
              <Link
                to="/"
                className="inline-block mt-2 text-lpu-maroon font-semibold text-sm hover:underline"
              >
                Go to sign in
              </Link>
            </p>
          </>
        )}

        {status === "err" && (
          <>
            <div className="text-[#c62828] bg-[#fce4ec] px-3.5 py-2.5 rounded-[10px] text-[13px] mb-4">
              {message}
            </div>
            {mode === "admin" && (
              <p className="text-sm leading-relaxed text-[#555] mb-5">
                If the problem continues, ask a root admin to confirm your
                account or resend the invitation.
              </p>
            )}
            <Link
              to="/"
              className="inline-block mt-2 text-lpu-maroon font-semibold text-sm hover:underline"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
