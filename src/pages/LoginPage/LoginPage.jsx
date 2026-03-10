import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const API_BASE_URL = getApiBaseUrl();
      // Pipeline 1: Admin login
      const adminRes = await fetch(`${API_BASE_URL}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const adminData = await adminRes.json().catch(() => null);

      // If admin succeeds, short-circuit
      if (adminRes.ok && adminData?.success) {
        if (adminData.token) localStorage.setItem("authToken", adminData.token);
        if (adminData.user?.id) localStorage.setItem("userId", adminData.user.id);
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userEmail", adminData.user?.email || email);
        localStorage.setItem("userRole", "admin");

        navigate("/admin/tickets");
        return;
      }

      // Pipeline 2: Normal user login
      const userRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const userData = await userRes.json();

      if (!userRes.ok || !userData.success) {
        // Prefer user error; otherwise show admin error if available
        setError(
          userData.message ||
            adminData?.message ||
            "Invalid email or password",
        );
        setIsLoading(false);
        return;
      }

      // Store token and user info
      if (userData.token) localStorage.setItem("authToken", userData.token);
      if (userData.user?.id) localStorage.setItem("userId", userData.user.id);
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userEmail", userData.user?.email || email);
      localStorage.setItem("userRole", "user");

      navigate("/Tickets");
    } catch (err) {
      setError(err.message || "Login failed");
      setIsLoading(false);
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

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit" className="login-btn" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          <a href="#" className="forgot-password">
            Forgot Password
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
