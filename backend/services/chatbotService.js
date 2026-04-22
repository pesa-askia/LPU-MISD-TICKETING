import { supabase } from "../config/database.js";
import https from "https";
import http from "http";
import { URL } from "url";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

const SYSTEM_PROMPT = `You are the MISD IT Support Assistant for LPU (Lyceum of the Philippines University).
You MUST answer ONLY from the provided context below.
If no context is provided or the answer is not in the context, you MUST reply exactly with: I don't have information about that. Please contact support staff directly.
NEVER use your own training knowledge. NEVER make up emails, phone numbers, URLs, or procedures.
Only answer IT support questions relevant to LPU MISD.`;

const BOT_HANDOFF_SIGNALS = [
  "i don't have information about that",
  "please contact support staff",
  "i cannot help",
  "i can't help",
  "beyond my knowledge",
  "unable to assist",
  "please reach out",
  "speak with a technician",
];

const USER_HANDOFF_TRIGGERS = [
  "talk to human", "talk to a human", "talk to agent",
  "talk to a person", "real person", "live agent",
  "human support", "contact support", "speak to someone",
  "transfer me", "escalate",
];

function detectHandoffSignal(botReply) {
  const lower = botReply.toLowerCase();
  return BOT_HANDOFF_SIGNALS.some((s) => lower.includes(s));
}

function detectUserHandoffRequest(msg) {
  const lower = msg.toLowerCase();
  return USER_HANDOFF_TRIGGERS.some((t) => lower.includes(t));
}

function httpRequest(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function embedText(text, taskType = "RETRIEVAL_QUERY") {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const payload = JSON.stringify({
    model: "models/gemini-embedding-001",
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: 768,
  });

  const { status, body } = await httpRequest(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    payload
  );

  if (status < 200 || status >= 300) {
    throw new Error(`Gemini Embedding ${status}: ${body.slice(0, 200)}`);
  }

  const data = JSON.parse(body);
  return data.embedding.values;
}

async function searchKnowledge(query, matchCount = 5) {
  const embedding = await embedText(query, "RETRIEVAL_QUERY");

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_count: matchCount,
    filter: {},
  });

  if (error) throw new Error(`Knowledge search failed: ${error.message}`);
  return data || [];
}

async function callCerebras(messages) {
  if (!CEREBRAS_API_KEY) throw new Error("CEREBRAS_API_KEY not set");

  const payload = JSON.stringify({
    model: "llama3.1-8b",
    messages,
    max_tokens: 512,
    temperature: 0.3,
  });

  const { status, body } = await httpRequest(
    "https://api.cerebras.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    payload
  );

  if (status < 200 || status >= 300) {
    throw new Error(`Cerebras ${status}: ${body.slice(0, 300)}`);
  }

  const data = JSON.parse(body);
  return data.choices?.[0]?.message?.content || "";
}

async function appendToSession(sessionId, userId, userMessage, botReply, status) {
  try {
    const newMessages = [
      { role: "user", content: userMessage, timestamp: new Date().toISOString() },
      { role: "bot", content: botReply, timestamp: new Date().toISOString() },
    ];

    const { data: existing } = await supabase
      .from("chatbot_sessions")
      .select("messages")
      .eq("session_id", sessionId)
      .single();

    const merged = [...(existing?.messages || []), ...newMessages];

    const { error } = await supabase.from("chatbot_sessions").upsert(
      { session_id: sessionId, user_id: userId, messages: merged, status, updated_at: new Date().toISOString() },
      { onConflict: "session_id" }
    );

    if (error) console.warn("[Chatbot] session save failed:", error.message);
  } catch (err) {
    console.warn("[Chatbot] session save error (non-fatal):", err.message);
  }
}

export async function sendChatMessage(userMessage, sessionId, userId) {
  if (detectUserHandoffRequest(userMessage)) {
    const botReply = "Of course! I'll connect you with a support technician. Please fill out the ticket form and a human will assist you shortly.";
    await appendToSession(sessionId, userId, userMessage, botReply, "transferred");
    return { reply: botReply, sessionId, shouldHandoff: true };
  }

  // Search knowledge base
  let context = "";
  try {
    const results = await searchKnowledge(userMessage);
    if (results.length > 0) {
      context = results.map((r) => r.content).join("\n\n");
    }
  } catch (err) {
    console.warn("[Chatbot] knowledge search failed (non-fatal):", err.message);
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: context
        ? `Context from knowledge base:\n${context}\n\nUser question: ${userMessage}`
        : `No context available.\n\nUser question: ${userMessage}`,
    },
  ];

  const botReply = await callCerebras(messages);
  const shouldHandoff = detectHandoffSignal(botReply);

  await appendToSession(sessionId, userId, userMessage, botReply, shouldHandoff ? "transferred" : "active");

  return { reply: botReply, sessionId, shouldHandoff };
}

export async function markSessionTransferred(sessionId) {
  await supabase
    .from("chatbot_sessions")
    .update({ status: "transferred", updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
}

export async function getSession(sessionId) {
  const { data, error } = await supabase
    .from("chatbot_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export function buildTranscript(messages) {
  return messages
    .map((m) => `[${m.role === "user" ? "User" : "Bot"}]: ${m.content}`)
    .join("\n");
}
