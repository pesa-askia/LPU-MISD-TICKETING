import { supabase } from "../config/database.js";

// Configuration Constants
const CONFIG = {
  SEARCH_THRESHOLD: 0.5, // LOWERED from 0.7 for more flexibility
  SEARCH_COUNT: 5,
  API_TIMEOUT: 20000,
  EMBEDDING_MODEL: "models/gemini-embedding-001",
  CHAT_MODEL: "openrouter/free",
};

const SYSTEM_PROMPT = `You are the MISD IT Support Assistant for LPU (Lyceum of the Philippines University).
You MUST answer ONLY from the provided context. If the answer is not in the context, reply exactly with: I don't have information about that. Please contact support staff directly.
NEVER make up information.`;

/**
 * Utility: Fetch with Timeout
 * Prevents the backend from hanging indefinitely if an API is slow.
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 1. Generate Vector Embeddings
 * Corrected: Explicitly requesting 768 dimensions from the model.
 * This preserves semantic meaning better than manual slicing.
 */
export async function embedText(text) {
  // Use gemini-embedding-001 - it is the most stable for v1beta
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001", // Corrected model string
      content: { parts: [{ text }] },
      outputDimensionality: 768, // This keeps your DB happy
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const vector = data?.embedding?.values;

  if (!vector || vector.length !== 768) {
    throw new Error(`Invalid vector dimension: ${vector?.length || 0}`);
  }

  return vector;
}

/**
 * NEW: Clean and Expand User Query
 * This turns a messy user question into a clear searchable concept.
 */
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
        model: "google/gemini-flash-1.5-8b", // Use a very fast model for this
        messages: [
          {
            role: "system",
            content:
              "Rewrite this IT support question into a 1-sentence technical search query. Focus on the core intent.",
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        max_tokens: 50,
      }),
    });
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || userMessage;
  } catch {
    return userMessage; // Fallback to original if API fails
  }
}

async function searchKnowledge(userMessage) {
  try {
    // Optional: Use expanded query for better matching
    // const expandedQuery = await expandQuery(userMessage);

    const queryEmbedding = await embedText(userMessage);

    const { data, error } = await supabase.rpc("search_knowledge_base", {
      query_embedding: queryEmbedding,
      match_threshold: CONFIG.SEARCH_THRESHOLD, // Now 0.5
      match_count: CONFIG.SEARCH_COUNT,
    });

    if (error) throw error;

    // Debugging: Log what was found to your terminal
    if (!data || data.length === 0) {
      console.log(
        `[Search] No results found for: "${userMessage}" at ${CONFIG.SEARCH_THRESHOLD} threshold.`,
      );
    } else {
      console.log(`[Search] Found ${data.length} relevant chunks.`);
    }

    return data || [];
  } catch (err) {
    console.error("[Chatbot] Knowledge Search Failure:", err.message);
    return [];
  }
}

/**
 * 3. Chat Completion via OpenRouter
 * Improved: Using system role for context injection and safe property access.
 */
async function callLLM(context, userMessage) {
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  if (context) {
    messages.push({
      role: "system",
      content: `Knowledge Base Context:\n${context}`,
    });
  }

  messages.push({ role: "user", content: userMessage });

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": CONFIG.APP_URL,
      "X-Title": "LPU MISD Chatbot",
    },
    body: JSON.stringify({
      model: CONFIG.CHAT_MODEL,
      messages,
      temperature: 0.1,
    }),
  });

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("LLM returned an empty or invalid response.");
  }

  return reply;
}

/**
 * 4. Improved Handoff Detection (Regex based)
 */
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

/**
 * 5. Primary Service Export
 */
export async function sendChatMessage(userMessage, sessionId, userId = null) {
  const results = await searchKnowledge(userMessage);
  const context = results.map((r) => r.content).join("\n\n");

  let botReply;
  try {
    botReply = await callLLM(context, userMessage);
  } catch (err) {
    console.error("[Chatbot] LLM processing error:", err.message);
    botReply =
      "I'm having trouble connecting to my brain right now. Please contact IT support staff directly.";
  }

  const shouldHandoff = detectHandoffSignal(botReply);

  // Parallel logging to prevent blocking the UI response
  Promise.all([
    // Log message history
    supabase.from("chatbot_messages").insert([
      { session_id: sessionId, role: "user", content: userMessage },
      { session_id: sessionId, role: "assistant", content: botReply },
    ]),
    // Upsert session status
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

  return { reply: botReply, sessionId, shouldHandoff };
}

// 6. Manual Handoff Export
export async function markSessionTransferred(sessionId) {
  await supabase
    .from("chatbot_sessions")
    .update({ status: "transferred", updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
}

// 7. Get Session Export
export async function getSession(sessionId) {
  const { data, error } = await supabase
    .from("chatbot_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error) throw error;
  return data;
}
