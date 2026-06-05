import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { Eye, EyeOff, Mail } from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import supabaseAuth from "../../lib/supabaseAuthClient";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { PrimaryButton, FloatingInput } from "../../components/FormFields";

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

  // Student magic-link flow
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError("");

    const allowedDomains = ["@lpulaguna.edu.ph", "@lpusc.edu.ph"];
    if (!allowedDomains.some((d) => email.toLowerCase().endsWith(d))) {
      setError("Only @lpulaguna.edu.ph or @lpusc.edu.ph email addresses are allowed.");
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

  // Admin password flow
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
    <div className="h-screen flex items-center justify-center p-4 md:p-6 font-poppins bg-[#F7F6F3]">
      <div className="w-full max-w-6xl rounded-2xl overflow-hidden flex flex-col md:grid md:grid-cols-2 shadow-[0_8px_40px_rgba(0,0,0,0.10)] border-t-6 border-lpu-maroon ">
        {/* Image Side */}
        <div
          className="relative h-36 md:min-h-130 w-full bg-gray-200 bg-[url('/lpu-building.jpg')] bg-center bg-cover bg-no-repeat after:content-[''] after:absolute after:inset-0 after:bg-[#1a0000]/40"
          aria-hidden="true"
        />

        {/* Form Side */}
        <div className="bg-white p-5 md:p-12 flex flex-col justify-center h-full gap-4 md:gap-8">
          <div>
            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-2 md:mb-3">
              LPU-L MISD Help Desk
            </p>
            <h1 className="text-3xl md:text-5xl font-black text-black m-0 tracking-tight">
              Welcome
            </h1>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-full p-1 h-10 md:h-12">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center h-full px-3 md:px-6 rounded-full text-xs md:text-sm font-bold uppercase transition-all duration-300 cursor-pointer ${
                mode === "magic"
                  ? "bg-lpu-maroon text-white shadow-sm"
                  : "text-gray-500 hover:text-lpu-maroon"
              }`}
              onClick={() => switchMode("magic")}
            >
              User
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center justify-center h-full px-3 md:px-6 rounded-full text-xs md:text-sm font-bold uppercase transition-all duration-300 cursor-pointer ${
                mode === "admin"
                  ? "bg-lpu-maroon text-white shadow-sm"
                  : "text-gray-500 hover:text-lpu-maroon"
              }`}
              onClick={() => switchMode("admin")}
            >
              Admin
            </button>
          </div>

          {error && (
            <div className="bg-[#FDEBEC] text-[#9F2F2D] border border-[#9F2F2D]/15 px-4 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium">
              {error}
            </div>
          )}

          {/* Forms */}
          <div className="w-full flex flex-col justify-center">
            {mode === "magic" && !emailSent && (
              <form
                onSubmit={handleMagicLink}
                className="flex flex-col gap-3 md:gap-4"
              >
                <FloatingInput
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 md:h-12 text-sm"
                />
                <PrimaryButton
                  label="Login"
                  loadingLabel="Logging In..."
                  isLoading={isLoading}
                  className="w-full h-10 md:h-12 text-sm uppercase"
                />
              </form>
            )}

            {mode === "magic" && emailSent && (
              <div className="flex flex-col gap-2 md:gap-3 py-2 w-full">
                <div className="flex flex-col items-center gap-2 md:gap-3 text-center">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-lpu-maroon/10 flex items-center justify-center">
                    <Mail size={20} className="text-lpu-maroon" />
                  </div>
                  <div>
                    <p className="text-gray-800 font-bold text-sm md:text-base">
                      Check your inbox
                    </p>
                    <p className="text-gray-500 text-xs md:text-sm leading-relaxed mt-0.5 md:mt-1">
                      Sign-in link sent to{" "}
                      <strong className="text-gray-800 break-all">{email}</strong>
                    </p>
                  </div>
                </div>
                <PrimaryButton
                  label="Use a different email"
                  type="button"
                  className="w-full h-10 md:h-12 text-sm uppercase mt-2"
                  onClick={() => {
                    setEmailSent(false);
                    setEmail("");
                  }}
                />
              </div>
            )}

            {mode === "admin" && (
              <form
                onSubmit={handleAdminLogin}
                className="flex flex-col gap-3 md:gap-4"
              >
                <FloatingInput
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 md:h-12 text-sm"
                />
                <div className="relative">
                  <FloatingInput
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    className="pr-10 h-10 md:h-12 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-lpu-maroon transition-colors cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PrimaryButton
                  label="Login"
                  loadingLabel="Logging in..."
                  isLoading={isLoading}
                  className="w-full h-10 md:h-12 text-sm uppercase"
                />
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
