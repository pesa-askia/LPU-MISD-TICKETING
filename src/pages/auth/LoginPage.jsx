import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { Eye, EyeOff, Mail } from "lucide-react";
import "./LoginPage.css";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import supabaseAuth from "../../lib/supabaseAuthClient";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";

const LoginPage = () => {
  const [mode, setMode] = useState("magic"); // "magic" | "admin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();

  // Auto-redirect if already logged in with valid session
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) return;
      // Use app_role for role detection (admin vs student)
      if (decoded.app_role === "admin") {
        navigate("/admin/tickets", { replace: true });
      } else {
        navigate("/Tickets", { replace: true });
      }
    } catch {
      // Invalid token, do nothing
    }
  }, [navigate]);

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setEmail("");
    setPassword("");
    setEmailSent(false);
  };

  // ── Student magic-link flow ─────────────────────────────────────────────
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.toLowerCase().endsWith("@lpulaguna.edu.ph")) {
      setError("Only @lpulaguna.edu.ph email addresses are allowed.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: supaError } = await supabaseAuth.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
        },
      });

      if (supaError) {
        setError(
          supaError.message || "Failed to send magic link. Please try again.",
        );
        return;
      }

      setEmailSent(true);
    } catch (err) {
      setError(err.message || "Failed to send magic link.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Admin password flow ─────────────────────────────────────────────────
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const API_BASE_URL = getApiBaseUrl();
      const res = await fetch(`${API_BASE_URL}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Invalid email or password");
        return;
      }

      if (data.token) {
        localStorage.setItem("authToken", data.token);
        realtimeSupabase.realtime.setAuth(data.token);
      }
      if (data.user?.id) localStorage.setItem("userId", data.user.id);
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userEmail", data.user?.email || email);
      localStorage.setItem("userRole", data.user?.role || "admin");
      localStorage.setItem("userFullName", data.user?.full_name || "");

      navigate("/admin/tickets");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-image" aria-hidden="true" />

        <div className="login-panel">
          <div className="login-heading">
            <h1 className="login-title">WELCOME</h1>
            <p className="login-subtitle">TO LPU-L MISD HELP DESK</p>
          </div>

          {/* ── Mode Toggle Flip ── */}
          <div className="mode-toggle-container">
            <div className={`mode-toggle-slider ${mode}`} />
            <button
              type="button"
              className={`mode-btn ${mode === "magic" ? "active" : ""}`}
              onClick={() => switchMode("magic")}
            >
              User
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === "admin" ? "active" : ""}`}
              onClick={() => switchMode("admin")}
            >
              Admin
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {/* ── Student Form ── */}
          {mode === "magic" && !emailSent && (
            <form onSubmit={handleMagicLink}>
              <input
                type="email"
                placeholder="Email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <button type="submit" className="login-btn" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          )}

          {mode === "magic" && emailSent && (
            <div className="magic-sent">
              <div className="magic-sent-icon" aria-hidden="true">
                <Mail size={32} />
              </div>
              <p className="magic-sent-title">Check your inbox</p>
              <p className="magic-sent-body">
                We sent a sign-in link to
                <br />
                <strong>{email}</strong>
              </p>
              <button
                type="button"
                className="magic-resend-btn"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
              >
                Use a different email
              </button>
            </div>
          )}

          {/* ── Admin Form ── */}
          {mode === "admin" && (
            <form onSubmit={handleAdminLogin}>
              <input
                type="email"
                placeholder="Email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button type="submit" className="login-btn" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
