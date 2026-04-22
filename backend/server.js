import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { initializeAdminUsers, initializeDatabase } from "./config/database.js";
import { verifyAdminEmailFromToken } from "./services/authService.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import ticketRoutes from "./routes/tickets.js";
import chatbotRoutes from "./routes/chatbot.js";
import knowledgeRoutes from "./routes/knowledge.js";
import os from "os";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsAllowList = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server / curl / same-origin
      if (!origin) return callback(null, true);

      // Always allow localhost for dev
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true);
      }

      // Allow configured origins (e.g., your Vercel URL)
      if (corsAllowList.length > 0 && corsAllowList.includes(origin)) {
        return callback(null, true);
      }

      // Allow Vercel deployments for this project only (exact prefix match)
      if (/^https:\/\/lpu-misd-ticketing[\w-]*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "20mb" }));

// Rate limiting for auth endpoints (login / signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

// Public: admin email verification (not behind strict auth rate limiter)
app.post("/api/auth/verify-admin-email", async (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token || typeof token !== "string" || !token.trim()) {
            return res.status(400).json({ success: false, message: "Token is required" });
        }
        const result = await verifyAdminEmailFromToken(token.trim());
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Verification error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "✓ Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/knowledge", knowledgeRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "LPU MISD Authentication Backend",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      admin: "/api/admin",
      health: "/health",
    },
    documentation: {
      signup: "POST /api/auth/signup",
      login: "POST /api/auth/login",
      getProfile: "GET /api/auth/me",
      updateProfile: "PUT /api/auth/me",
      changePassword: "POST /api/auth/change-password",
      getAllUsers: "GET /api/admin/users",
      getUserDetails: "GET /api/admin/users/:userId",
      updateUser: "PUT /api/admin/users/:userId",
      deleteUser: "DELETE /api/admin/users/:userId",
      getStats: "GET /api/admin/stats",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Initialize database and start server
const start = async () => {
  const getLanIP = () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) return net.address;
      }
    }
    return "127.0.0.1";
  };
  const lanIp = getLanIP();
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const publicBase = process.env.PUBLIC_BASE_URL || vercelUrl || "";
  const corsList = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ") || "(none)";
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "(not set)";
  const dbKind = process.env.DATABASE_URL
    ? "postgresql"
    : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
      ? "supabase"
      : "unknown";

  // Admin invite email debug (never print secrets)
  const adminInviteDebug = String(process.env.ADMIN_INVITE_DEBUG || "").trim().toLowerCase() === "true";
  const smtpHost = String(process.env.ADMIN_INVITE_SMTP_HOST || "").trim();
  const smtpPort = Number(process.env.ADMIN_INVITE_SMTP_PORT || 587);
  const smtpSecure =
    String(process.env.ADMIN_INVITE_SMTP_SECURE || "").trim().toLowerCase() === "true" || smtpPort === 465;
  const smtpUserPresent = Boolean(String(process.env.ADMIN_INVITE_SMTP_USER || "").trim());
  const smtpPassPresent = Boolean(String(process.env.ADMIN_INVITE_SMTP_PASS || "").trim());
  const smtpConfigured = Boolean(smtpHost) && smtpUserPresent && smtpPassPresent;
  const resendApiKeyPresent = Boolean(String(process.env.RESEND_API_KEY || "").trim());
  const inviteEnabled = smtpConfigured || resendApiKeyPresent;

  try {
    await initializeDatabase();
    await initializeAdminUsers();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
╔════════════════════════════════════════╗
║  LPU MISD Auth Backend                 ║
║  🚀 Server running on port ${PORT}       ║
╠════════════════════════════════════════╣
║  📍 http://localhost:${PORT}             ║
║  🏥 Health: http://localhost:${PORT}/health ║
║  📚 Docs: http://localhost:${PORT}/       ║
║                                          ║
║  🌐 LAN:  http://${lanIp}:${PORT}          ║
║  🔒 CORS: ${corsList.padEnd(28).slice(0, 28)}║
║  🌎 Public: ${publicBase || "(none)"}      ║
║                                          ║
║  🗄  DB Kind: ${dbKind}                      ║
║  🔌 DB URL: ${dbUrl}                        ║
╚════════════════════════════════════════╝
            `);

      console.log(
        "[Admin invite email]",
        inviteEnabled ? "enabled" : "disabled",
        "| SMTP:",
        smtpConfigured ? "configured" : "not configured",
        `(${smtpHost || "no-host"}:${smtpPort} secure=${smtpSecure})`,
        "| RESEND_API_KEY:",
        resendApiKeyPresent ? "present" : "missing",
        "| PUBLIC_BASE_URL:",
        publicBase || "(none)",
        "| DEBUG:",
        adminInviteDebug ? "on" : "off",
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
