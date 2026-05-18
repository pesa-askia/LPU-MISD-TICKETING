/* global process */
import express from "express";
import { adminMiddleware } from "../middleware/auth.js";
import { supabase } from "../config/database.js";
import { embedText } from "../services/chatbotService.js";
import { logActivity } from "../services/activityService.js";

const router = express.Router();

// ── constants ────────────────────────────────────────────────────────────────

const GROQ_URL         = "https://api.groq.com/openai/v1/chat/completions";
const API_TIMEOUT      = 45000;
const VALID_PERIOD_TYPES = ["daily", "weekly", "monthly", "yearly", "custom"];

// Free-tier limits per model. batchSize tuned so one batch ≈ 70–80 % of TPM.
const MODEL_CONFIG = [
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", tpm: 30000, rpm: 30, batchSize: 60 },
  { id: "llama-3.3-70b-versatile",                   tpm: 12000, rpm: 30, batchSize: 25 },
  { id: "llama-3.1-8b-instant",                      tpm: 6000,  rpm: 30, batchSize: 10 },
];
const TOTAL_TPM = MODEL_CONFIG.reduce((s, m) => s + m.tpm, 0); // 48 000

// ── helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── per-model TPM tracking (sliding 60-second window) ────────────────────────

const modelUsage     = new Map(MODEL_CONFIG.map((m) => [m.id, []]));
const modelCooldowns = new Map(MODEL_CONFIG.map((m) => [m.id, 0]));

function getWindowedUsage(modelId) {
  const now  = Date.now();
  const kept = (modelUsage.get(modelId) || []).filter((u) => now - u.ts < 60_000);
  modelUsage.set(modelId, kept);
  return kept.reduce((s, u) => s + u.tokens, 0);
}

function recordUsage(modelId, tokens) {
  (modelUsage.get(modelId) || []).push({ ts: Date.now(), tokens });
}

// ── background job store ─────────────────────────────────────────────────────

const jobs            = new Map(); // jobId → job object
const runningByPeriod = new Map(); // "type:key" → jobId

function makeJobId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanOldJobs() {
  const cutoff = Date.now() - 2 * 60 * 60_000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

// ── Groq API ─────────────────────────────────────────────────────────────────

async function callGroqModel(modelId, messages, maxTokens = 800) {
  if (Date.now() < modelCooldowns.get(modelId)) {
    throw new Error(`${modelId} in cooldown`);
  }

  for (let attempt = 0; attempt <= 2; attempt++) {
    const ctrl    = new AbortController();
    const timerId = setTimeout(() => ctrl.abort(), API_TIMEOUT);
    try {
      const res = await fetch(GROQ_URL, {
        method : "POST",
        headers: {
          Authorization  : `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type" : "application/json",
        },
        body  : JSON.stringify({
          model          : modelId,
          messages,
          temperature    : 0.1,
          max_tokens     : maxTokens,
          response_format: { type: "json_object" },
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timerId);

      if (res.status === 429) {
        if (attempt < 2) {
          const delay = Math.pow(3, attempt + 1) * 2000 + Math.random() * 1000;
          console.warn(`[AI] ${modelId} 429, retry ${attempt + 1}/2 in ${Math.round(delay)}ms`);
          await sleep(delay);
          continue;
        }
        modelCooldowns.set(modelId, Date.now() + 300_000);
        throw new Error("Rate limited");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Groq ${res.status}`);

      recordUsage(modelId, data.usage?.total_tokens ?? maxTokens);
      return data.choices[0].message.content;
    } catch (err) {
      clearTimeout(timerId);
      if (err.name === "AbortError") throw new Error("Timeout");
      throw err;
    }
  }
}

// Pick best model with TPM headroom; fall back to any non-cooldown model.
async function callGroq(messages, maxTokens = 800) {
  const estimated = maxTokens + 500;

  for (const cfg of MODEL_CONFIG) {
    if (Date.now() < modelCooldowns.get(cfg.id)) continue;
    if (getWindowedUsage(cfg.id) + estimated <= cfg.tpm) {
      try { return await callGroqModel(cfg.id, messages, maxTokens); }
      catch (e) {
        if (!e.message.includes("cooldown") && !e.message.includes("Rate limited")) throw e;
      }
    }
  }

  for (const cfg of MODEL_CONFIG) {
    if (Date.now() < modelCooldowns.get(cfg.id)) continue;
    try { return await callGroqModel(cfg.id, messages, maxTokens); }
    catch (e) {
      if (!e.message.includes("cooldown") && !e.message.includes("Rate limited")) throw e;
    }
  }

  throw new Error("All Groq models failed or rate limited");
}

// ── batch helpers ─────────────────────────────────────────────────────────────

function parseJson(raw) {
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\n?|\n?```$/gm, "").trim());
  } catch { return null; }
}

function buildTicketLines(batch, msgsByTicket) {
  return batch.map((t) => {
    const summary   = (t.Summary || t.Description || "").slice(0, 100).replace(/\n+/g, " ");
    const msgs      = msgsByTicket[t.id] || { user: [], admin: [] };
    const userPart  = msgs.user.map((m) => `  U:"${m}"`).join("\n");
    const adminPart = msgs.admin.length ? "\n" + msgs.admin.map((m) => `  A:"${m}"`).join("\n") : "";
    return `[${t.Category || "General"}|${t.Department || "?"}] "${summary}"\n${userPart}${adminPart}`;
  }).join("\n\n");
}

const BATCH_SYSTEM = `IT support analyst. Extract problems from ticket summary and all messages. Extract solutions ONLY when actual admin fix messages exist — never fabricate solutions or descriptions. Issue/problem titles must be specific (max 5 words) drawn from actual user messages, not category names. Category must be one of: LMS, Hardware, Software, Microsoft 365, Student Portal, ERP, Network, Others. All descriptions strictly from provided data — omit if insufficient. Return compact JSON. Max 8 problems, 6 solutions.`;

function buildBatchPrompt(ticketLines) {
  return `Analyze these closed IT support tickets.

RULES:
- PROBLEMS: identify based on ticket summary, user messages, AND admin messages where they describe the issue
- SOLUTIONS: ONLY include an entry if you can quote or directly paraphrase an actual admin message that describes a fix, workaround, or step taken to resolve the issue. If you cannot, DO NOT include that entry at all. Never fabricate solution descriptions.
- Do NOT write descriptions like "No admin messages provided a solution" — if there is no solution, exclude the entry entirely
- Merge similar problems and solutions across tickets
- For "category" in BOTH problems and solutions, use ONLY one of: LMS, Hardware, Software, Microsoft 365, Student Portal, ERP, Network, Others — pick the closest match to the ticket's category shown in brackets
- "issue" must be a specific brief title (max 5 words) drawn from what users actually described in their messages — NOT a category restatement like "LMS issue", "Hardware problem", "ERP access". Look at the actual U: message lines and ticket summaries. Examples of good titles: "Cannot log in to LMS", "Printer not connecting", "Email not syncing on Teams". Only as specific as the data allows. If you cannot produce a specific title, OMIT the entry entirely — never use "Unknown", "Unidentified", "Other issue", or any placeholder.
- "problem" in solutions follows the same rule — specific brief title (max 5 words) from actual ticket content. If you cannot produce a specific title, OMIT the entry entirely — never use "Unknown", "Unidentified", or placeholders.
- "description" for problems: 2-5 sentences. Quote or paraphrase what users actually said. Do NOT use generic filler like "from various departments", "from different locations", "multiple users reported". If the data is insufficient for a real description, omit the field entirely.
- "description" for solutions: 2-5 sentences describing exactly what the admin did or advised, quoting or paraphrasing the A: messages. If you have no concrete admin fix to describe, omit the field entirely. Never fabricate.

TICKETS:
${ticketLines}

Return ONLY valid JSON:
{"problems":[{"category":"LMS|Hardware|Software|Microsoft 365|Student Portal|ERP|Network|Others","issue":"specific title max 5 words","count":1,"description":"sentences based on actual ticket data only"}],"solutions":[{"category":"LMS|Hardware|Software|Microsoft 365|Student Portal|ERP|Network|Others","problem":"specific title max 5 words","solution":"string","count":1,"description":"sentences based on actual admin messages only"}]}`;
}

function mergeBatchResult(parsed, rawProblems, rawSolutions) {
  for (const p of parsed.problems || []) {
    const key = `${p.category}|||${p.issue}`;
    if (!rawProblems[key]) {
      rawProblems[key] = { category: p.category, issue: p.issue, count: 0, description: p.description || "" };
    } else if (!rawProblems[key].description && p.description) {
      rawProblems[key].description = p.description;
    }
    rawProblems[key].count += Math.max(1, p.count || 1);
  }
  for (const s of (parsed.solutions || []).slice(0, 6)) {
    const key = `${s.category}|||${s.problem}`;
    if (!rawSolutions[key]) {
      rawSolutions[key] = { category: s.category, problem: s.problem, solution: s.solution, count: 0, description: s.description || "" };
    } else if (!rawSolutions[key].description && s.description) {
      rawSolutions[key].description = s.description;
    }
    rawSolutions[key].count += Math.max(1, s.count || 1);
  }
}

// Split tickets across model queues proportional to TPM capacity.
function distributeTickets(tickets) {
  const queues = [];
  let offset   = 0;
  for (let i = 0; i < MODEL_CONFIG.length; i++) {
    const cfg    = MODEL_CONFIG[i];
    const isLast = i === MODEL_CONFIG.length - 1;
    const count  = isLast
      ? tickets.length - offset
      : Math.round(tickets.length * cfg.tpm / TOTAL_TPM);
    const slice  = tickets.slice(offset, offset + Math.max(0, count));
    offset      += count;
    const batches = [];
    for (let j = 0; j < slice.length; j += cfg.batchSize) {
      batches.push(slice.slice(j, j + cfg.batchSize));
    }
    queues.push({ config: cfg, batches });
  }
  return queues;
}

// Process one model's queue sequentially, respecting its TPM window.
async function processModelQueue(cfg, batches, msgsByTicket, rawProblems, rawSolutions, job) {
  const minDelay = Math.ceil(60_000 / cfg.rpm); // 2 000 ms for rpm=30

  for (const batch of batches) {
    // ~220 tokens per ticket (input) + 800 prompt overhead + 1200 max output
    const estimated = batch.length * 220 + 800 + 1200;

    // Wait until TPM window has room (max 2 min, then try anyway)
    for (let waited = 0; waited < 120_000; waited += 3000) {
      if (getWindowedUsage(cfg.id) + estimated <= cfg.tpm) break;
      await sleep(3000);
    }

    const ticketLines = buildTicketLines(batch, msgsByTicket);
    try {
      const raw    = await callGroqModel(cfg.id, [
        { role: "system", content: BATCH_SYSTEM },
        { role: "user",   content: buildBatchPrompt(ticketLines) },
      ], 1200);
      const parsed = parseJson(raw);
      if (parsed) mergeBatchResult(parsed, rawProblems, rawSolutions);
    } catch (err) {
      console.error(`[AI] ${cfg.id} batch error:`, err.message);
    }

    job.batchesDone++;

    // Pace outgoing tokens to stay inside TPM window (80 % of theoretical rate)
    const tpmDelay = Math.ceil((estimated / cfg.tpm) * 60_000 * 0.8);
    await sleep(Math.max(minDelay, tpmDelay));
  }
}

// ── period helpers ────────────────────────────────────────────────────────────

function getPeriodRange(periodType, periodKey, customStart, customEnd) {
  switch (periodType) {
    case "daily": {
      if (!periodKey) throw new Error("period_key required for daily");
      return {
        since: new Date(periodKey + "T00:00:00.000Z"),
        until: new Date(periodKey + "T23:59:59.999Z"),
        key  : periodKey,
      };
    }
    case "weekly": {
      if (!periodKey) throw new Error("period_key required for weekly");
      const m = periodKey.match(/^(\d{4})-W(\d{2})$/);
      if (!m) throw new Error("Invalid week format, expected YYYY-Www");
      const year    = parseInt(m[1], 10);
      const week    = parseInt(m[2], 10);
      const jan4    = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const week1Ms = Date.UTC(year, 0, 4 - (jan4Day - 1));
      const since   = new Date(week1Ms + (week - 1) * 7 * 86_400_000);
      const until   = new Date(since.getTime() + 7 * 86_400_000 - 1);
      return { since, until, key: periodKey };
    }
    case "monthly": {
      if (!periodKey) throw new Error("period_key required for monthly");
      const [year, month] = periodKey.split("-").map(Number);
      return {
        since: new Date(Date.UTC(year, month - 1, 1)),
        until: new Date(Date.UTC(year, month, 1) - 1),
        key  : periodKey,
      };
    }
    case "yearly": {
      if (!periodKey) throw new Error("period_key required for yearly");
      const year = parseInt(periodKey, 10);
      return {
        since: new Date(Date.UTC(year, 0, 1)),
        until: new Date(Date.UTC(year + 1, 0, 1) - 1),
        key  : periodKey,
      };
    }
    case "custom": {
      if (!customStart || !customEnd) throw new Error("customStart and customEnd required");
      const since = new Date(customStart + "T00:00:00.000Z");
      const until = new Date(customEnd   + "T23:59:59.999Z");
      if (since > until) throw new Error("Start date must be before end date");
      return { since, until, key: `${customStart}/${customEnd}` };
    }
    default:
      throw new Error(`Invalid period type: ${periodType}`);
  }
}

async function isKbDuplicate(question) {
  try {
    const embedding = await embedText(`Q: ${question}`);
    const { data }  = await supabase.rpc("search_knowledge_base", {
      query_embedding: embedding,
      match_threshold: 0.80,
      match_count    : 1,
    });
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}

// ── background analysis job ───────────────────────────────────────────────────

async function runAnalysisJob(jobId, periodLockKey, params) {
  const { period_type, period_key: resolvedKey, force, adminId, since, until } = params;
  const job = jobs.get(jobId);

  try {
    // Fetch tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from("Tickets")
      .select("id, Summary, Description, Category, Department, satisfaction, satisfaction_comment, closed_at")
      .eq("status", "Closed")
      .not("closed_at", "is", null)
      .gte("closed_at", since.toISOString())
      .lte("closed_at", until.toISOString())
      .order("closed_at", { ascending: false })
      .limit(500);

    if (ticketsError) throw ticketsError;

    if (!tickets || tickets.length === 0) {
      job.status = "done";
      job.result = { ticketCount: 0, results: null };
      return;
    }

    job.ticketCount = tickets.length;

    // Fetch messages
    const ticketIds = tickets.map((t) => t.id);
    const { data: allMessages } = await supabase
      .from("ticket_messages")
      .select("ticket_id, message_text, sender_role, created_at")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: true });

    const msgsByTicket = {};
    for (const msg of allMessages || []) {
      if (!msgsByTicket[msg.ticket_id]) msgsByTicket[msg.ticket_id] = { user: [], admin: [] };
      const role = msg.sender_role === "admin" ? "admin" : "user";
      const text = (msg.message_text || "").replace(/\n+/g, " ").trim();
      if (!text) continue;
      if (role === "user" && msgsByTicket[msg.ticket_id].user.length < 2) {
        msgsByTicket[msg.ticket_id].user.push(text.slice(0, 120));
      } else if (role === "admin") {
        msgsByTicket[msg.ticket_id].admin.push(text.slice(0, 150));
      }
    }

    // Distribute tickets proportionally across 3 model queues and run in parallel
    const queues       = distributeTickets(tickets);
    const totalBatches = queues.reduce((s, q) => s + q.batches.length, 0);
    job.batchesTotal   = totalBatches;
    job.batchesDone    = 0;
    job.phase          = "batching";

    const rawProblems  = {};
    const rawSolutions = {};

    await Promise.all(
      queues.map(({ config, batches }) =>
        processModelQueue(config, batches, msgsByTicket, rawProblems, rawSolutions, job)
      )
    );

    // Feedback analysis
    job.phase = "feedback";
    let satisfiedThemes    = [];
    let dissatisfiedThemes = [];

    const satisfiedComments    = tickets
      .filter((t) => t.satisfaction === true  && t.satisfaction_comment?.trim())
      .map((t) => t.satisfaction_comment.trim());
    const dissatisfiedComments = tickets
      .filter((t) => t.satisfaction === false && t.satisfaction_comment?.trim())
      .map((t) => t.satisfaction_comment.trim());
    const totalFeedbackComments = satisfiedComments.length + dissatisfiedComments.length;

    if (totalFeedbackComments >= 3) {
      const fbPrompt = `Generalize these user feedback comments into short themes. Group similar sentiments and count how many comments belong to each theme.
STRICT RULES:
- Only use what is explicitly stated in the comments below. Do not invent or infer.
- If a category shows "(none)", you MUST return [] for that array.
- If comments are too sparse or vague, return [] rather than guessing.
- "count" must reflect how many of the provided comments match that theme (total across both lists should sum to total comments in that category).

Satisfied (${satisfiedComments.length} comments):
${satisfiedComments.slice(0, 30).map((c, i) => `${i + 1}. "${c}"`).join("\n") || "(none)"}

Dissatisfied (${dissatisfiedComments.length} comments):
${dissatisfiedComments.slice(0, 30).map((c, i) => `${i + 1}. "${c}"`).join("\n") || "(none)"}

Return ONLY valid JSON:
{"satisfied_themes":[{"theme":"string","count":N}],"dissatisfied_themes":[{"theme":"string","count":N}]}`;

      try {
        const raw    = await callGroq([
          { role: "system", content: "Summarize feedback into themes with counts. Only from provided comments, no invention. Return JSON with theme+count objects. Max 6 themes each." },
          { role: "user",   content: fbPrompt },
        ], 500);
        const parsed = parseJson(raw);
        if (parsed) {
          satisfiedThemes    = (parsed.satisfied_themes    || []).filter((t) => t?.theme?.trim()).slice(0, 6);
          dissatisfiedThemes = (parsed.dissatisfied_themes || []).filter((t) => t?.theme?.trim()).slice(0, 6);
        }
      } catch (err) {
        console.error("[AI] Feedback error:", err.message);
      }
    }

    if (satisfiedComments.length    === 0) satisfiedThemes    = [];
    if (dissatisfiedComments.length === 0) dissatisfiedThemes = [];

    // Consolidation pass
    job.phase = "consolidating";
    let finalProblems  = Object.values(rawProblems).sort((a, b) => b.count - a.count).slice(0, 12);
    let finalSolutions = Object.values(rawSolutions).sort((a, b) => b.count - a.count).slice(0, 8);

    if (totalBatches > 1 && (finalProblems.length > 0 || finalSolutions.length > 0)) {
      const consolidatePrompt = `Consolidate these IT support analysis results. Merge near-duplicate entries. Keep top ranked only. Preserve or combine descriptions from merged entries.
Category must be one of: LMS, Hardware, Software, Microsoft 365, Student Portal, ERP, Network, Others.

Problems: ${JSON.stringify(finalProblems.slice(0, 20))}
Solutions: ${JSON.stringify(finalSolutions.slice(0, 15))}

Return ONLY valid JSON:
{"problems":[{"category":"string","issue":"string","count":N,"description":"string"}],"solutions":[{"category":"string","problem":"string","solution":"string","count":N,"description":"string"}]}`;

      try {
        const raw    = await callGroq([
          { role: "system", content: "Consolidate and deduplicate analysis results. Category must be one of: LMS, Hardware, Software, Microsoft 365, Student Portal, ERP, Network, Others. Preserve descriptions from source entries. Return JSON. Max 12 problems, 8 solutions." },
          { role: "user",   content: consolidatePrompt },
        ], 1400);
        const parsed = parseJson(raw);
        if (parsed) {
          if (parsed.problems?.length)  finalProblems  = parsed.problems.sort((a, b)  => (b.count || 0) - (a.count || 0));
          if (parsed.solutions?.length) finalSolutions = parsed.solutions.sort((a, b) => (b.count || 0) - (a.count || 0));
        }
      } catch (err) {
        console.error("[AI] Consolidation error:", err.message);
      }
    }

    // KB suggestions
    job.phase = "kb";
    let suggestedKbEntries = [];

    if (finalProblems.length > 0 || finalSolutions.length > 0) {
      const kbPrompt = `Based on these common IT support patterns, generate knowledge base Q&A entries.
Each entry: one specific question (as a user would ask), one clear actionable answer.
RULES:
- Only generate entries where there is a known solution from the data below
- Do NOT include entries for problems with no recorded solution
- Do NOT end answers with generic escalation phrases like "If none of these steps work, contact IT support", "contact your IT department", or any similar fallback. Answers must be complete self-contained resolutions.
- Questions must be specific — not "What is the hardware issue?" but "How do I fix my printer not connecting to the network?"

Problems/Solutions (only use entries with actual solutions):
${finalSolutions.slice(0, 6).map((s) => `- [${s.category}] ${s.problem}: ${s.solution}`).join("\n")}

Generate 3-6 Q&A pairs only for entries with real solutions above. Return ONLY valid JSON:
{"kb_suggestions":[{"question":"string","answer":"string","title":"string"}]}`;

      try {
        const raw    = await callGroq([
          { role: "system", content: "Generate specific Q&A knowledge base entries for IT support. Each answer must be a complete, actionable resolution. Never end with 'contact IT support' or escalation advice. Return JSON." },
          { role: "user",   content: kbPrompt },
        ], 900);
        const parsed = parseJson(raw);
        if (parsed?.kb_suggestions) {
          const boilerplateRe = /if (none of these|this doesn.t|these steps don.t)|contact (it support|your it|the it)|for further assistance|for additional (help|support)/i;
          suggestedKbEntries = parsed.kb_suggestions
            .filter((e) => e.question?.trim() && e.answer?.trim())
            .map((e) => ({
              ...e,
              answer: e.answer
                .split(/(?<=[.!?])\s+/)
                .filter((s) => !boilerplateRe.test(s))
                .join(" ")
                .trim(),
            }))
            .filter((e) => e.answer.length > 0)
            .slice(0, 6);
        }
      } catch (err) {
        console.error("[AI] KB suggestions error:", err.message);
      }
    }

    // KB semantic dedup
    const dedupedKb = [];
    for (const entry of suggestedKbEntries) {
      if (!(await isKbDuplicate(entry.question))) dedupedKb.push(entry);
      await sleep(200);
    }
    suggestedKbEntries = dedupedKb;

    const finalResults = {
      problems             : finalProblems,
      solutions            : finalSolutions,
      satisfied_themes     : satisfiedThemes,
      dissatisfied_themes  : dissatisfiedThemes,
      suggested_kb_entries : suggestedKbEntries,
      feedback_comment_count: totalFeedbackComments,
    };

    const { data: insight, error: insightErr } = await supabase
      .from("ai_insights")
      .insert({
        period_type,
        period_key           : resolvedKey,
        scope                : { period_type, period_key: resolvedKey, force },
        ticket_count         : tickets.length,
        results              : finalResults,
        knowledge_added_count: 0,
        created_by           : adminId,
      })
      .select("id")
      .single();

    if (insightErr) console.error("[AI] Insight save error:", insightErr.message);

    const periodLabels = {
      daily  : `day of ${resolvedKey}`,
      weekly : `week ${resolvedKey.replace(/^\d{4}-/, "")} ${resolvedKey.slice(0, 4)}`,
      monthly: new Date(resolvedKey + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      yearly : `year ${resolvedKey}`,
      custom : resolvedKey.replace("/", " to "),
    };
    logActivity({
      adminId,
      actionType : "AI_ANALYSIS_RUN",
      targetId   : String(insight?.id || ""),
      targetLabel: `${force ? "Force analyzed" : "Analyzed"} ${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} for ${periodLabels[period_type] || resolvedKey}`,
      metadata   : {
        period_key     : resolvedKey,
        force,
        ticket_count   : tickets.length,
        problems_found : finalProblems.length,
        solutions_found: finalSolutions.length,
        kb_suggestions : suggestedKbEntries.length,
      },
    });

    job.status = "done";
    job.result = { ticketCount: tickets.length, results: finalResults, insightId: insight?.id || null };
  } catch (err) {
    console.error("[AI] Job failed:", err.message);
    job.status = "failed";
    job.error  = err.message;
  } finally {
    runningByPeriod.delete(periodLockKey);
  }
}

// ── routes ────────────────────────────────────────────────────────────────────

// GET /api/ai-analytics/status
router.get("/status", adminMiddleware, async (req, res) => {
  try {
    const { count: totalClosed, error: countErr } = await supabase
      .from("Tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "Closed");
    if (countErr) throw countErr;

    const { data: lastRun } = await supabase
      .from("ai_insights")
      .select("id, run_at, ticket_count, period_type, period_key")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({ success: true, totalClosed: totalClosed || 0, lastRun: lastRun || null });
  } catch (err) {
    console.error("[AI Analytics] Status error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ai-analytics/results?period_type=X&period_key=Y[&customStart=&customEnd=]
router.get("/results", adminMiddleware, async (req, res) => {
  const { period_type, period_key, customStart, customEnd } = req.query;
  try {
    let query = supabase.from("ai_insights").select("*");
    if (period_type && VALID_PERIOD_TYPES.includes(period_type)) {
      const { key: resolvedKey } = getPeriodRange(period_type, period_key, customStart, customEnd);
      query = query.eq("period_type", period_type).eq("period_key", resolvedKey);
    } else {
      query = query.order("run_at", { ascending: false }).limit(1);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    res.json({ success: true, data: data || null });
  } catch (err) {
    console.error("[AI Analytics] Results error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ai-analytics/check?period_type=X&period_key=Y[&customStart=&customEnd=]
router.get("/check", adminMiddleware, async (req, res) => {
  const { period_type, period_key, customStart, customEnd } = req.query;
  if (!period_type || !VALID_PERIOD_TYPES.includes(period_type)) {
    return res.status(400).json({ success: false, error: "Valid period_type required" });
  }
  try {
    const { since, until, key: resolvedKey } = getPeriodRange(period_type, period_key, customStart, customEnd);
    const [{ data }, { count: ticketCount }] = await Promise.all([
      supabase
        .from("ai_insights")
        .select("id")
        .eq("period_type", period_type)
        .eq("period_key", resolvedKey)
        .maybeSingle(),
      supabase
        .from("Tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "Closed")
        .not("closed_at", "is", null)
        .gte("closed_at", since.toISOString())
        .lte("closed_at", until.toISOString()),
    ]);
    res.json({ success: true, analyzed: !!data, ticketCount: ticketCount || 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ai-analytics/job/:jobId
router.get("/job/:jobId", adminMiddleware, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: "Job not found" });
  res.json({
    success     : true,
    status      : job.status,
    phase       : job.phase       || null,
    batchesDone : job.batchesDone  || 0,
    batchesTotal: job.batchesTotal || 0,
    ticketCount : job.ticketCount  || null,
    result      : job.status === "done"   ? job.result : null,
    error       : job.status === "failed" ? job.error  : null,
  });
});

// POST /api/ai-analytics/analyze
router.post("/analyze", adminMiddleware, async (req, res) => {
  const { period_type, period_key, customStart, customEnd, force = false } = req.body;
  const adminId = req.user?.id || req.user?.sub;

  if (!period_type || !VALID_PERIOD_TYPES.includes(period_type)) {
    return res.status(400).json({ success: false, error: "Valid period_type required" });
  }
  if (period_type === "custom") {
    return res.status(400).json({ success: false, error: "Custom range is view-only. Analysis requires a fixed period." });
  }

  try {
    const { since, until, key: resolvedKey } = getPeriodRange(period_type, period_key, customStart, customEnd);
    const periodLockKey = `${period_type}:${resolvedKey}`;

    // Check already analyzed
    const { data: existing } = await supabase
      .from("ai_insights")
      .select("id")
      .eq("period_type", period_type)
      .eq("period_key", resolvedKey)
      .maybeSingle();

    if (existing && !force) {
      return res.json({ success: false, alreadyAnalyzed: true, error: "This period has already been analyzed. Use Force Analyze to re-run." });
    }

    // Return existing running job for same period instead of launching duplicate
    if (runningByPeriod.has(periodLockKey)) {
      const existingJobId = runningByPeriod.get(periodLockKey);
      if (jobs.get(existingJobId)?.status === "running") {
        return res.json({ success: true, jobId: existingJobId });
      }
    }

    // Force: remove existing DB entry before re-running
    if (existing) {
      await supabase
        .from("ai_insights")
        .delete()
        .eq("period_type", period_type)
        .eq("period_key", resolvedKey);
    }

    cleanOldJobs();
    const jobId = makeJobId();
    jobs.set(jobId, {
      status      : "running",
      phase       : "starting",
      batchesDone : 0,
      batchesTotal: 0,
      ticketCount : null,
      result      : null,
      error       : null,
      createdAt   : Date.now(),
    });
    runningByPeriod.set(periodLockKey, jobId);

    runAnalysisJob(jobId, periodLockKey, {
      period_type,
      period_key: resolvedKey,
      force,
      adminId,
      since,
      until,
      customStart,
      customEnd,
    }).catch((err) => {
      console.error("[AI] Unhandled job error:", err.message);
      const j = jobs.get(jobId);
      if (j) { j.status = "failed"; j.error = err.message; }
      runningByPeriod.delete(periodLockKey);
    });

    res.json({ success: true, jobId });
  } catch (err) {
    console.error("[AI Analytics] Analyze error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai-analytics/add-knowledge — admin approves a suggested Q&A entry
router.post("/add-knowledge", adminMiddleware, async (req, res) => {
  const { question, answer, title } = req.body;
  const adminId = req.user?.id || req.user?.sub;

  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ success: false, error: "question and answer required" });
  }

  const text          = `Q: ${question.trim()}\nA: ${answer.trim()}`;
  const resolvedTitle = title?.trim() || question.trim().slice(0, 80);

  try {
    const embedding     = await embedText(text);
    const { data, error } = await supabase
      .from("knowledge_base")
      .insert({
        content : text,
        metadata: { source: "ai_analysis", title: resolvedTitle },
        embedding,
      })
      .select("id, content, metadata")
      .single();

    if (error) throw error;

    logActivity({
      adminId,
      actionType : "KNOWLEDGE_ADDED",
      targetId   : String(data.id),
      targetLabel: resolvedTitle,
      metadata   : { source: "ai_analysis", title: resolvedTitle },
    });

    const { data: latestInsight } = await supabase
      .from("ai_insights")
      .select("id, knowledge_added_count")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestInsight?.id) {
      await supabase
        .from("ai_insights")
        .update({ knowledge_added_count: (latestInsight.knowledge_added_count || 0) + 1 })
        .eq("id", latestInsight.id);
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("[AI Analytics] Add KB error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
