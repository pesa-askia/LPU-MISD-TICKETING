import { supabase } from "../config/database.js";

const CONFIG = {
  SEARCH_THRESHOLD: 0.5,
  SEARCH_COUNT: 5,
  API_TIMEOUT: 20000,
  EMBEDDING_MODEL: "models/gemini-embedding-001",
  GROQ_URL: "https://api.groq.com/openai/v1/chat/completions",
  MODELS: [
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant",
  ],
};

const SYSTEM_PROMPT = `You are "Stella," the MISD IT Support Assistant for LPU.

CORE DIRECTIVES:
1. TONE: Professional, helpful, and natural. Do not start with "I'd be happy to help."
2. GROUNDING: Answer using the KNOWLEDGE BASE context. For technical questions, stick to the KB. For simple conversational follow-ups (e.g. "what are we talking about?", "can you repeat that?"), reference the conversation history instead.
3. SYNTHESIS: Rephrase into clear conversational steps. Never copy-paste "A:" or "Answer:" labels.
4. ACCURACY: If a technical answer is not in the KB, say: "I don't have specific information on that. Please contact MISD support directly."

OUTPUT FORMAT — respond with valid JSON only, no other text:
{
  "answer": "your full response here",
  "suggestions": ["short follow-up question 1", "short follow-up question 2"]
}

SUGGESTION RULES:
- Generate exactly 2 follow-up questions a student would naturally ask next about this topic.
- They can be different aspects or deeper steps of the SAME topic — not required to be different topics.
- Do NOT repeat anything from ALREADY DISCUSSED.
- Max 10 words each. Must be a specific, actionable question.
- Only use an empty array if the knowledge base has zero relevant content at all.`;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function embedText(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API Error: ${response.status} - ${err}`);
  }
  const data = await response.json();
  const vector = data?.embedding?.values;
  if (!vector || vector.length !== 768)
    throw new Error(`Invalid vector dimension: ${vector?.length || 0}`);
  return vector;
}

async function expandQuery(userMessage) {
  try {
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5-8b",
        messages: [
          {
            role: "system",
            content:
              "Rewrite this IT support question into a 1-sentence technical search query. Focus on the core intent.",
          },
          { role: "user", content: userMessage },
        ],
        max_tokens: 50,
      }),
    });
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || userMessage;
  } catch {
    return userMessage;
  }
}

async function searchKnowledge(userMessage) {
  try {
    const queryEmbedding = await embedText(userMessage);
    const { data, error } = await supabase.rpc("search_knowledge_base", {
      query_embedding: queryEmbedding,
      match_threshold: CONFIG.SEARCH_THRESHOLD,
      match_count: CONFIG.SEARCH_COUNT,
    });
    if (error) throw error;
    if (!data || data.length === 0)
      console.log(`[Search] No results for: "${userMessage}" at ${CONFIG.SEARCH_THRESHOLD} threshold.`);
    else
      console.log(`[Search] Found ${data.length} relevant chunks.`);
    return data || [];
  } catch (err) {
    console.error("[Chatbot] Knowledge Search Failure:", err.message);
    return [];
  }
}

// Calls Groq with JSON mode enforced — model MUST return valid JSON
async function callLLM(messages) {
  let lastError;
  for (const modelId of CONFIG.MODELS) {
    try {
      console.log(`[Chatbot] Attempting with model: ${modelId}`);
      const response = await fetchWithTimeout(CONFIG.GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: 0.1,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
      });
      const data = await response.json();
      if (response.status === 429) {
        console.warn(`[Chatbot] Model ${modelId} rate limited. Trying next...`);
        lastError = data.error?.message || "Rate limit exceeded";
        continue;
      }
      if (!response.ok)
        throw new Error(data.error?.message || `Groq failed with status ${response.status}`);
      return data.choices[0].message.content;
    } catch (err) {
      console.error(`[Chatbot] Error with ${modelId}:`, err.message);
      lastError = err;
    }
  }
  throw new Error(`All models exhausted. Last error: ${lastError}`);
}

function parseJsonReply(raw) {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?|\n?```$/gm, "").trim();
    const parsed = JSON.parse(cleaned);
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s) => typeof s === "string" && s.trim().length > 3)
          .map((s) => s.trim())
          .slice(0, 2)
      : [];
    if (!answer) {
      console.warn("[Chatbot] JSON parsed but 'answer' field missing. Raw:", cleaned.slice(0, 200));
    }
    return { answer, suggestions };
  } catch (e) {
    // JSON parse failed — model didn't follow JSON format despite response_format
    console.warn("[Chatbot] JSON parse failed:", e.message, "| Raw:", raw.slice(0, 200));
    return { answer: raw.trim(), suggestions: [] };
  }
}

// Last-resort: pull question-like sentences from RAG chunk text.
// Works even if the LLM doesn't cooperate.
function extractChunkQuestions(chunks, skipText) {
  const skipLower = (skipText || "").toLowerCase();
  const seen = new Set();
  const out = [];
  for (const chunk of chunks) {
    const lines = chunk.content.split(/[.\n]+/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const clean = line.replace(/^(?:Q:|Question:|•|-|\*|\d+\.)\s*/i, "").trim();
      if (clean.length < 10 || clean.length > 100) continue;
      const lower = clean.toLowerCase();
      if (seen.has(lower) || skipLower.includes(lower.slice(0, 20))) continue;
      seen.add(lower);
      // Prefer explicit questions; accept short instructional phrases too
      const asQ = clean.endsWith("?") ? clean : `How do I ${clean.toLowerCase()}?`;
      out.push(asQ);
      if (out.length >= 2) return out;
    }
  }
  return out;
}

function detectHandoffSignal(text) {
  const signals = [
    "contact support",
    "staff",
    "human",
    "technician",
    "can't help",
    "don't have information",
  ];
  return signals.some((s) => new RegExp(`\\b${s}\\b`, "i").test(text));
}

export async function sendChatMessage(userMessage, sessionId, userId = null, history = []) {
  const results = await searchKnowledge(userMessage);
  const context = results.map((r) => r.content).join("\n\n");

  const historyMessages = history
    .slice(-20)
    .filter((m) => m.role === "user" || m.role === "bot")
    .map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.content,
    }));

  const discussedTopics = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .concat(userMessage)
    .join(" | ");

  // Build a plain-text summary of the conversation so the LLM can reference it
  // for conversational follow-ups even when KB results are noisy/irrelevant.
  const conversationSummary = historyMessages.length > 0
    ? historyMessages
        .map((m) => `${m.role === "assistant" ? "Stella" : "User"}: ${m.content}`)
        .join("\n")
    : "No prior conversation.";

  const systemContent =
    `${SYSTEM_PROMPT}\n\n` +
    `CONVERSATION SO FAR (use this for any follow-up or meta questions like "what are we talking about"):\n${conversationSummary}\n\n` +
    `ALREADY DISCUSSED (do not suggest these): ${discussedTopics || "none"}\n\n` +
    `KNOWLEDGE BASE (use only for technical questions; ignore if the user is asking about the conversation itself):\n${context}`;

  const llmMessages = [
    { role: "system", content: systemContent },
    ...historyMessages,
    { role: "user", content: userMessage },
  ];

  let botReply = "I'm having trouble connecting right now. Please contact IT support staff directly.";
  let suggestions = [];

  try {
    const raw = await callLLM(llmMessages);
    console.log("[Chatbot] Raw LLM response:", raw.slice(0, 400));
    const parsed = parseJsonReply(raw);
    if (parsed.answer) botReply = parsed.answer;
    suggestions = parsed.suggestions;
    // If model returned empty suggestions, extract from RAG chunks directly
    if (suggestions.length === 0 && results.length > 0) {
      suggestions = extractChunkQuestions(results, discussedTopics);
      console.log("[Chatbot] Fallback chunk suggestions:", suggestions);
    }
    console.log("[Chatbot] Final suggestions:", suggestions);
  } catch (err) {
    console.error("[Chatbot] LLM processing error:", err.message);
    if (results.length > 0) {
      suggestions = extractChunkQuestions(results, discussedTopics);
    }
  }

  const shouldHandoff = detectHandoffSignal(botReply);

  Promise.all([
    supabase.from("chatbot_messages").insert([
      { session_id: sessionId, role: "user", content: userMessage },
      { session_id: sessionId, role: "assistant", content: botReply },
    ]),
    supabase.from("chatbot_sessions").upsert(
      {
        session_id: sessionId,
        user_id: userId,
        status: shouldHandoff ? "transferred" : "active",
        last_message_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    ),
  ]).catch((err) => console.error("[Chatbot] Logging failure:", err.message));

  return { reply: botReply, suggestions, sessionId, shouldHandoff };
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
  if (error) throw error;
  return data;
}
