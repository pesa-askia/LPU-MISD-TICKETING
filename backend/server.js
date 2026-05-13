/* global process */
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
app.use((err, req, res, _next) => {
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
  const corsList = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ") || "(none)";
  const dbKind = process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase (service_role)" : "supabase (anon)";

  try {
    await initializeDatabase();
    await initializeAdminUsers();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LPU MISD Auth Backend  ·  port ${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Local   →  http://localhost:${PORT}
  Health  →  http://localhost:${PORT}/health
  LAN     →  http://${lanIp}:${PORT}
  CORS    →  ${corsList}
  DB      →  ${dbKind}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
