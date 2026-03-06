import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { initializeDatabase } from "./config/database.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "✓ Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

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
  try {
    await initializeDatabase();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
╔════════════════════════════════════════╗
║  LPU MISD Auth Backend                 ║
║  🚀 Server running on port ${PORT}       ║
╠════════════════════════════════════════╣
║  📍 http://localhost:${PORT}             ║
║  🏥 Health: http://localhost:${PORT}/health ║
║  📚 Docs: http://localhost:${PORT}/       ║
╚════════════════════════════════════════╝
            `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
