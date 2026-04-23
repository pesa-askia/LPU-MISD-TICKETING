import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { Eye, EyeOff, Mail } from "lucide-react";
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
        setError(supaError.message || "Failed to send magic link.");
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
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userId", data.user?.id || "");
      localStorage.setItem("userEmail", data.user?.email || email);
      localStorage.setItem("userRole", data.user?.role || "admin");
      navigate("/admin/tickets");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 font-poppins bg-[radial-gradient(1200px_700px_at_20%_15%,#ffffff_0%,#f3f3f3_45%,#ededed_100%)]">
      <div className="w-full max-w-245 rounded-[18px] overflow-hidden flex flex-col md:grid md:grid-cols-[1.25fr_1fr] shadow-[0_18px_50px_rgba(0,0,0,0.18)] bg-lpu-maroon">
        {/* Image Side - Visible on all devices */}
        <div
          className="relative h-48 md:h-auto bg-gray-300 bg-[url('/lpu-building.jpg')] bg-center bg-cover bg-no-repeat after:content-[''] after:absolute after:inset-0 after:bg-lpu-maroon/30"
          aria-hidden="true"
        />

        {/* Form Side */}
        <div className="bg-lpu-maroon p-8 md:p-16 flex flex-col justify-center gap-6">
          <div className="text-center">
            <h1 className="text-white text-3xl md:text-5xl font-bold tracking-wider leading-none m-0">
              WELCOME
            </h1>
            <p className="mt-2.5 text-white/90 text-[10px] md:text-xs tracking-[0.22em] uppercase">
              TO LPU-L MISD HELP DESK
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="relative flex bg-black/20 rounded-xl p-1 border border-white/70 w-full">
            <div
              className={`absolute top-1 left-1 w-[calc(50%-4px)] h-[calc(100%-8px)] bg-white rounded-lg transition-transform duration-300 ease-in-out z-10 ${
                mode === "admin" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            <button
              type="button"
              className={`flex-1 py-2.5 z-20 font-semibold text-[13px] uppercase tracking-wider transition-colors duration-300 ${mode === "magic" ? "text-lpu-maroon" : "text-white/70"}`}
              onClick={() => switchMode("magic")}
            >
              User
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 z-20 font-semibold text-[13px] uppercase tracking-wider transition-colors duration-300 ${mode === "admin" ? "text-lpu-maroon" : "text-white/70"}`}
              onClick={() => switchMode("admin")}
            >
              Admin
            </button>
          </div>

          {error && (
            <div className="bg-lpu-gold text-lpu-maroon border border-white/70 p-3 rounded-lg text-sm font-bold text-center shadow-lg animate-in fade-in zoom-in duration-300">
              {error}
            </div>
          )}

          {/* Forms */}
          <div className="w-full">
            {mode === "magic" && !emailSent && (
              <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full p-3.5 px-4.5 rounded-lg bg-lpu-maroon/40 border border-white/70 text-white placeholder-white/60 outline-none focus:border-white focus:ring-4 focus:ring-white/10 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 mt-2 rounded-full bg-white text-lpu-maroon font-black uppercase tracking-widest hover:bg-lpu-gold hover:text-lpu-maroon hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_15px_rgba(0,0,0,0.2)]"
                >
                  {isLoading ? "Logging in..." : "Login"}
                </button>
              </form>
            )}

            {mode === "magic" && emailSent && (
              <div className="flex flex-col items-center gap-2.5 text-center py-2">
                <Mail size={32} className="text-white mb-2" />
                <p className="text-white font-semibold text-lg">
                  Check your inbox
                </p>
                <p className="text-white/85 text-sm leading-relaxed">
                  We sent a sign-in link to <br />
                  <strong className="text-white break-all">{email}</strong>
                </p>
                <button
                  type="button"
                  className="w-full py-3.5 mt-2 rounded-full bg-white text-lpu-maroon font-black uppercase tracking-widest hover:bg-lpu-gold hover:text-lpu-maroon hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_15px_rgba(0,0,0,0.2)]"
                  onClick={() => {
                    setEmailSent(false);
                    setEmail("");
                  }}
                >
                  Use a different email
                </button>
              </div>
            )}

            {mode === "admin" && (
              <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full p-3.5 px-4.5 rounded-lg bg-lpu-maroon/40 border border-white/70 text-white placeholder-white/60 outline-none focus:border-white focus:ring-4 focus:ring-white/10 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="relative w-full">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="w-full p-3.5 pr-12 rounded-lg bg-lpu-maroon/40 border border-white/70 text-white placeholder-white/60 outline-none focus:border-white focus:ring-4 focus:ring-white/10 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 mt-2 rounded-full bg-white text-lpu-maroon font-black uppercase tracking-widest hover:bg-lpu-gold hover:text-lpu-maroon hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_15px_rgba(0,0,0,0.2)]"
                >
                  {isLoading ? "Logging in..." : "Login"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
