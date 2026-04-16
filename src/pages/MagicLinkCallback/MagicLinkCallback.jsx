import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabaseAuth from "../../supabaseAuthClient";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import "./MagicLinkCallback.css";

const MagicLinkCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    // Clear any stale custom JWT from a previous session before we start.
    // If authFetch sees an old authToken in localStorage it will inject it as
    // the Authorization header on Supabase's own internal /auth/v1/user call,
    // which Supabase doesn't recognise → 403 → session appears invalid.
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
        const API_BASE_URL = getApiBaseUrl();
        const res = await fetch(`${API_BASE_URL}/api/auth/magic-verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session.access_token,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Verification failed. Please try again.");
          return;
        }

        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userEmail", data.user.email);
        localStorage.setItem("userRole", "user");
        localStorage.setItem("userFullName", data.user?.full_name || "");

        // Sign out of Supabase Auth locally only (no API call).
        // scope:'local' just clears the Supabase session from localStorage
        // without hitting /auth/v1/logout, avoiding another authFetch injection.
        await supabaseAuth.auth.signOut({ scope: "local" });

        navigate("/Tickets", { replace: true });
      } catch (err) {
        console.error("Magic link callback error:", err);
        setError(
          "Could not reach the server. Make sure the backend is running and try again.",
        );
      }
    };

    // Subscribe first so we never miss the event
    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        exchangeForCustomJwt(session);
      }
    });

    // Also check immediately in case the session was already set before mount
    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      if (session && !done) {
        subscription.unsubscribe();
        exchangeForCustomJwt(session);
      }
    });

    // 10-second timeout in case nothing ever fires
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        setError(
          "Magic link has expired or is invalid. Please request a new one.",
        );
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="callback-page">
        <p className="callback-error">{error}</p>
        <a href="/" className="callback-back">
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="callback-page">
      <p className="callback-status">Signing you in…</p>
    </div>
  );
};

export default MagicLinkCallback;
