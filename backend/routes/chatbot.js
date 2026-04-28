import express from "express";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import {
  sendChatMessage,
  markSessionTransferred,
  getSession,
} from "../services/chatbotService.js";
import { enforceChatbotAccountCooldown } from "../services/chatbotRateLimitService.js";

const router = express.Router();

// POST /api/chatbot/message
router.post("/message", optionalAuthMiddleware, async (req, res) => {
  const { message, sessionId, history } = req.body;
  if (!message || !sessionId) {
    return res
      .status(400)
      .json({ success: false, error: "message and sessionId required" });
  }

  const userId = req.user?.id || req.user?.sub || null;

  try {
    const limit = await enforceChatbotAccountCooldown({ userId, sessionId });
    if (!limit.allowed) {
      const retryAfterSec = Math.ceil((limit.retryAfterMs || 0) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      if (limit.source) res.setHeader("X-Chatbot-Limiter", String(limit.source));
      if (limit.keyType) res.setHeader("X-Chatbot-Limiter-Key", String(limit.keyType));
      return res.status(429).json({
        success: false,
        error: "Chat cooldown active. Please wait before sending another message.",
        code: "CHAT_COOLDOWN",
        retryAfterMs: limit.retryAfterMs,
        cooldownUntil: limit.cooldownUntil,
        violationCount:
          typeof limit.violationCount === "number" ? limit.violationCount : null,
        limiter: {
          source: limit.source || null,
          keyType: limit.keyType || null,
        },
      });
    }

    const result = await sendChatMessage(message, sessionId, userId, Array.isArray(history) ? history : []);
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
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "SET" : "NOT SET",
    GROQ_API_KEY: process.env.GROQ_API_KEY ? "SET" : "NOT SET", // Updated
    SUPABASE_URL: process.env.SUPABASE_URL ? "SET" : "NOT SET",
  };

  res.json({
    status: "ok",
    environment: env,
    message:
      "Chatbot RAG API is operational using Groq (Llama 3.3) and Gemini Embeddings.",
  });
});

export default router;
