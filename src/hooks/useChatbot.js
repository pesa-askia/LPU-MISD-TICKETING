import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { jwtDecode } from "jwt-decode";

const envGet = (env, k) => env?.[k] ?? env?.[`VITE_${k}`];
function getRateWindowMs(env) {
  const v = Number(
    envGet(env, "CHATBOT_LIMIT_WINDOW_MS") ||
      envGet(env, "CHATBOT_RATE_WINDOW_MS"),
  );
  if (v > 0) return v;
  return 24 * 60 * 60 * 1000;
}

const SPAM_THRESHOLD_COUNT = 3;
const SPAM_WINDOW_MS = 6_000;
const SPAM_BASE_COOLDOWN_MS = 5_000;
const SPAM_MAX_COOLDOWN_MS = 120_000;

export const CHATBOT_GREETING =
  "Hi! I'm Stella, the MISD Support Bot. How can I help you today? I can assist with LMS, Microsoft 365, Student Portal, ERP, hardware, and software issues.";

export const CHATBOT_SUGGESTIONS = [
  "I can't log in to LMS",
  "Microsoft 365 account setup",
  "Student Portal not working",
  "ERP system access issue",
  "Computer hardware problem",
  "Software installation help",
];


export function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useChatbot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: "bot", content: CHATBOT_GREETING, id: "greeting" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [shouldHandoff, setShouldHandoff] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const [cooldownUntilMs, setCooldownUntilMs] = useState(null);
  const [cooldownLabel, setCooldownLabel] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const sendTimestampsRef = useRef([]);

  // Show suggestion chips only before the first user message
  const showSuggestions = useMemo(
    () => messages.length === 1 && messages[0].id === "greeting",
    [messages],
  );

  const limiterKey = (() => {
    try {
      const token = localStorage.getItem("authToken");
      if (token) {
        const decoded = jwtDecode(token);
        const userId = decoded?.id || decoded?.sub;
        if (userId) return `chatLimiter:user:${userId}`;
      }
    } catch {
      // ignore
    }
    return `chatLimiter:session:${sessionId}`;
  })();

  const rateWindowMs = getRateWindowMs(import.meta.env);

  const formatWait = (ms) => {
    const s = Math.max(1, Math.ceil(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.ceil(s / 60);
    return `${m}m`;
  };

  const writeLocalLimiterRaw = useCallback(
    (payload) => {
      try {
        localStorage.setItem(
          limiterKey,
          JSON.stringify({ ...payload, updatedAt: Date.now() }),
        );
      } catch {
        // ignore
      }
    },
    [limiterKey],
  );

  const readLocalLimiter = useCallback(() => {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(limiterKey);
      if (!raw)
        return { violationCount: 0, cooldownUntilMs: null, windowStartMs: null };
      const parsed = JSON.parse(raw);
      const violationCount = Number(parsed?.chatCount || 0);
      const storedCooldown =
        typeof parsed?.cooldownUntilMs === "number"
          ? parsed.cooldownUntilMs
          : null;
      const windowStartMs =
        typeof parsed?.windowStartMs === "number" ? parsed.windowStartMs : null;

      if (windowStartMs && now - windowStartMs > rateWindowMs) {
        const reset = { chatCount: 0, cooldownUntilMs: null, windowStartMs: now };
        writeLocalLimiterRaw(reset);
        return { violationCount: 0, cooldownUntilMs: null, windowStartMs: now };
      }
      if (!windowStartMs && violationCount > 0) {
        const reset = { chatCount: 0, cooldownUntilMs: null, windowStartMs: now };
        writeLocalLimiterRaw(reset);
        return { violationCount: 0, cooldownUntilMs: null, windowStartMs: now };
      }
      return { violationCount, cooldownUntilMs: storedCooldown, windowStartMs };
    } catch {
      return { violationCount: 0, cooldownUntilMs: null, windowStartMs: null };
    }
  }, [limiterKey, rateWindowMs, writeLocalLimiterRaw]);

  const writeLocalLimiter = useCallback(
    ({ violationCount, cooldownUntilMs: until, windowStartMs }) => {
      writeLocalLimiterRaw({
        chatCount: Number(violationCount || 0),
        cooldownUntilMs: typeof until === "number" ? until : null,
        windowStartMs: typeof windowStartMs === "number" ? windowStartMs : null,
      });
    },
    [writeLocalLimiterRaw],
  );

  useEffect(() => {
    const { cooldownUntilMs: until } = readLocalLimiter();
    if (until && Date.now() < until) {
      setCooldownUntilMs(until);
      setCooldownLabel(
        `You can continue chatting after ${formatWait(until - Date.now())}.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limiterKey]);

  useEffect(() => {
    if (!cooldownUntilMs) return;
    const tick = () => {
      const left = cooldownUntilMs - Date.now();
      if (left <= 0) {
        setCooldownUntilMs(null);
        setCooldownLabel("");
        return;
      }
      setCooldownLabel(
        `You can continue chatting after ${formatWait(left)}.`,
      );
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [cooldownUntilMs]);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || isTyping) return;

      // Capture history before appending new user message (last 20 = 10 exchanges), skip greeting
      const history = messages
        .filter((m) => m.id !== "greeting")
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      // Only filter against messages the user actually sent (not shown suggestions —
      // those accumulate and end up blocking everything after a few exchanges)
      const sentByUser = new Set(
        messages
          .filter((m) => m.role === "user")
          .map((m) => m.content.toLowerCase().trim()),
      );
      sentByUser.add(text.trim().toLowerCase());

      const filterSugs = (arr) =>
        (arr || []).filter((s) => !sentByUser.has(s.toLowerCase().trim()));

      sendTimestampsRef.current = [
        ...sendTimestampsRef.current.filter(
          (t) => Date.now() - t < SPAM_WINDOW_MS,
        ),
        Date.now(),
      ];

      const userMsg = {
        role: "user",
        content: text.trim(),
        id: Date.now().toString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsTyping(true);

      try {
        const token = localStorage.getItem("authToken");
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${getApiBaseUrl()}/api/chatbot/message`, {
          method: "POST",
          headers,
          body: JSON.stringify({ message: text.trim(), sessionId, history }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          const retryAfterMs =
            typeof data?.retryAfterMs === "number" ? data.retryAfterMs : null;
          if (res.status === 429 && retryAfterMs) {
            const until = Date.now() + retryAfterMs;
            setCooldownUntilMs(until);
            setCooldownLabel(
              `You can continue chatting after ${formatWait(retryAfterMs)}.`,
            );
            const cur = readLocalLimiter();
            const v =
              typeof data?.violationCount === "number"
                ? data.violationCount
                : cur.violationCount + 1;
            writeLocalLimiter({
              violationCount: v,
              cooldownUntilMs: until,
              windowStartMs: cur.windowStartMs ?? Date.now(),
            });
            return;
          }
          throw new Error(data?.error || "Bot unavailable");
        }

        const botMsg = {
          role: "bot",
          content: data.reply,
          id: `bot_${Date.now()}`,
          suggestions: filterSugs(data.suggestions),
        };
        setMessages((prev) => [...prev, botMsg]);

        const now = Date.now();
        sendTimestampsRef.current = sendTimestampsRef.current.filter(
          (t) => now - t < SPAM_WINDOW_MS,
        );
        const recentCount = sendTimestampsRef.current.length;
        if (recentCount >= SPAM_THRESHOLD_COUNT) {
          const cur = readLocalLimiter();
          const newViolations = cur.violationCount + 1;
          const cooldownMs = Math.min(
            SPAM_BASE_COOLDOWN_MS * Math.pow(2, newViolations - 1),
            SPAM_MAX_COOLDOWN_MS,
          );
          const until = now + cooldownMs;
          writeLocalLimiter({
            violationCount: newViolations,
            cooldownUntilMs: until,
            windowStartMs: cur.windowStartMs ?? now,
          });
          setCooldownUntilMs(until);
          sendTimestampsRef.current = [];
        } else {
          const cur = readLocalLimiter();
          writeLocalLimiter({
            violationCount: cur.violationCount,
            cooldownUntilMs: null,
            windowStartMs: cur.windowStartMs ?? now,
          });
        }

        if (data.shouldHandoff) setShouldHandoff(true);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            content:
              "Sorry, I'm having trouble connecting. Please try again or submit a ticket directly.",
            id: `err_${Date.now()}`,
            isError: true,
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping, sessionId, messages, readLocalLimiter, writeLocalLimiter],
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleHandoff = useCallback(async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${getApiBaseUrl()}/api/chatbot/handoff`, {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // ignore
    }

    const userMessages = messages.filter((m) => m.role === "user");
    const summary = userMessages[0]?.content?.slice(0, 120) || "";
    const transcript = messages
      .filter((m) => m.id !== "greeting")
      .map((m) => {
        const label = m.role === "user" ? "[You]" : "[MISD Support Bot]";
        return `${label}\n${m.content}`;
      })
      .join("\n\n");

    navigate("/SubmitTicket", {
      state: { chatPrefill: { summary, description: transcript } },
    });
  }, [messages, sessionId, navigate]);

  return {
    messages,
    inputText,
    setInputText,
    isTyping,
    shouldHandoff,
    sessionId,
    cooldownUntilMs,
    cooldownLabel,
    showSuggestions,
    messagesEndRef,
    inputRef,
    sendMessage,
    handleKeyDown,
    handleHandoff,
  };
}
