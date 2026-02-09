import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const MOCK_EMAIL = "test123@gmail.com";
    const MOCK_PASSWORD = "test123";

    const handleLogin = (e) => {
        e.preventDefault();
        setError("");

        if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("userEmail", email);
            navigate("/Tickets");
        } else {
            setError("Invalid email or password");
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">WELCOME TO MIS HELP DESK</h1>

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

                    <button type="submit" className="login-btn">
                        Login
                    </button>
                </form>

                <a href="#" className="forgot-password">
                    Forgot Password
                </a>

                <div className="demo-credentials">
                    <small>Demo: test123@gmail.com / test123</small>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
