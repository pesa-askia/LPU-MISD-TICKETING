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
    return res
      .status(400)
      .json({ success: false, error: "message and sessionId required" });
  }

  const userId = req.user?.id || null;

  try {
    const result = await sendChatMessage(message, sessionId, userId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Chatbot] message error:", err.message);
    res
      .status(500)
      .json({ success: false, error: err.message, detail: err.stack });
  }
});

// POST /api/chatbot/handoff
router.post("/handoff", optionalAuthMiddleware, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, error: "sessionId required" });
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

// GET /api/chatbot/test
router.get("/test", async (req, res) => {
  const env = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
      ? "SET (" + process.env.GEMINI_API_KEY.slice(0, 6) + "...)"
      : "NOT SET",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY
      ? "SET (" + process.env.OPENROUTER_API_KEY.slice(0, 6) + "...)"
      : "NOT SET",
    SUPABASE_URL: process.env.SUPABASE_URL ? "SET" : "NOT SET",
    SUPABASE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
        ? "SET"
        : "NOT SET",
  };

  res.json({
    status: "ok",
    environment: env,
    message:
      "Chatbot RAG API is operational using OpenRouter (Llama 3.1) and Gemini Embeddings.",
  });
});

export default router;
