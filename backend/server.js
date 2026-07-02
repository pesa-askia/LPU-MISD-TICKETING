/* global process */
import "./config/env.js";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeAdminUsers, initializeDatabase } from "./config/database.js";
import { verifyAdminEmailFromToken } from "./services/authService.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import ticketRoutes from "./routes/tickets.js";
import chatbotRoutes from "./routes/chatbot.js";
import knowledgeRoutes from "./routes/knowledge.js";
import aiAnalyticsRoutes from "./routes/aiAnalytics.js";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDistDir =
  process.env.FRONTEND_DIST_DIR || path.join(__dirname, "public");
const frontendIndexPath = path.join(frontendDistDir, "index.html");

const app = express();
const PORT = process.env.PORT || 5000;
app.set("trust proxy", 1);

// Middleware
const corsAllowList = [process.env.PUBLIC_BASE_URL, process.env.CORS_ORIGINS]
  .filter(Boolean)
  .join(",")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const getOriginHost = (origin) => {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return "";
  }
};

const getRequestHost = (req) =>
  String(req.get("x-forwarded-host") || req.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

app.use(
  cors((req, callback) => {
    const origin = req.get("origin");
    let allowedOrigin = false;

    // Allow server-to-server / curl / same-origin
    if (!origin) {
      allowedOrigin = true;
    }

    // Always allow localhost for dev
    if (origin?.includes("localhost") || origin?.includes("127.0.0.1")) {
      allowedOrigin = true;
    }

    // Allow configured origins for split frontend/backend deployments.
    if (corsAllowList.length > 0 && corsAllowList.includes(origin)) {
      allowedOrigin = true;
    }

    if (origin && getOriginHost(origin) === getRequestHost(req)) {
      allowedOrigin = true;
    }

    // Allow Vercel deployments for this project only (exact prefix match)
    if (origin && /^https:\/\/lpu-misd-ticketing[\w-]*\.vercel\.app$/.test(origin)) {
      allowedOrigin = true;
    }

    callback(null, {
      origin: allowedOrigin,
      credentials: true,
    });
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
app.use("/api/ai-analytics", aiAnalyticsRoutes);

app.get("/env.js", (req, res) => {
  const publicConfig = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "",
    VITE_SUPABASE_URL_LOCAL: process.env.VITE_SUPABASE_URL_LOCAL || "",
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "",
    VITE_PUBLIC_BASE_URL:
      process.env.VITE_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || "",
    VITE_API_BASE_URL_LOCAL: process.env.VITE_API_BASE_URL_LOCAL || "/",
    VITE_API_BASE_URL_PROD: process.env.VITE_API_BASE_URL_PROD || "/",
  };

  const json = JSON.stringify(publicConfig).replace(/</g, "\\u003c");
  res
    .type("application/javascript")
    .set("Cache-Control", "no-store")
    .send(`window.__APP_CONFIG__ = ${json};`);
});

if (fs.existsSync(frontendIndexPath)) {
  app.use(
    express.static(frontendDistDir, {
      index: "index.html",
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

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
  void _next;
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
  try {
    await initializeDatabase();
    await initializeAdminUsers();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LPU MISD Ticketing Backend  ·  port ${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Local   →  http://localhost:${PORT}
  LAN     →  http://${lanIp}:${PORT}
  CORS    →  ${corsList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
