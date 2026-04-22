import express from "express";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import {
  sendChatMessage,
  markSessionTransferred,
  getSession,
} from "../services/chatbotService.js";

const router = express.Router();

// POST /api/chatbot/message
router.post("/message", optionalAuthMiddleware, async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || !sessionId) {
    return res.status(400).json({ success: false, error: "message and sessionId required" });
  }

  const userId = req.user?.id || null;

  try {
    const result = await sendChatMessage(message, sessionId, userId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Chatbot] message error:", err.message);
    res.status(500).json({ success: false, error: err.message, detail: err.stack });
  }
});

// POST /api/chatbot/handoff  — marks session as transferred (no ticket created here)
router.post("/handoff", optionalAuthMiddleware, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "sessionId required" });
  }

  try {
    await markSessionTransferred(sessionId);
    res.json({ success: true });
  } catch (err) {
    console.error("[Chatbot] handoff error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chatbot/session/:sessionId
router.get("/session/:sessionId", optionalAuthMiddleware, async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chatbot/test  — open in browser to diagnose
router.get("/test", async (req, res) => {
  const env = {
    FLOWISE_URL: process.env.FLOWISE_URL || "NOT SET",
    FLOWISE_CHATFLOW_ID: process.env.FLOWISE_CHATFLOW_ID || "NOT SET",
    FLOWISE_API_KEY: process.env.FLOWISE_API_KEY ? "SET (" + process.env.FLOWISE_API_KEY.slice(0, 6) + "...)" : "NOT SET",
  };

  try {
    const { sendChatMessage } = await import("../services/chatbotService.js");
    const result = await sendChatMessage("hello", "test-diag-session", null);
    res.json({ success: true, env, result });
  } catch (err) {
    res.json({ success: false, env, error: err.message, stack: err.stack });
  }
});

export default router;
