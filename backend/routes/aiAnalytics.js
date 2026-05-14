/* global process */
import express from "express";
import { adminMiddleware } from "../middleware/auth.js";
import { supabase } from "../config/database.js";
import { embedText } from "../services/chatbotService.js";
import { logActivity } from "../services/activityService.js";

const router = express.Router();

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const BATCH_SIZE = 40;
const API_TIMEOUT = 30000;
const VALID_PERIOD_TYPES = ["daily", "weekly", "monthly", "yearly", "custom"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const modelCooldowns = new Map(); // Track rate-limited models to skip them temporarily

async function callGroq(messages, maxTokens = 800) {
  for (const model of MODELS) {
    // Check if model is in cooldown
    const cooldownUntil = modelCooldowns.get(model);
    if (cooldownUntil && Date.now() < cooldownUntil) {
      continue;
    }

    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      try {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.1,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.status === 429) {
          retries++;
          if (retries <= maxRetries) {
            // Increased initial delay and backoff for 429s
            const delay = Math.pow(3, retries) * 2000 + Math.random() * 1000;
            console.warn(`[AI Analytics] ${model} rate limited, retrying in ${Math.round(delay)}ms (attempt ${retries}/${maxRetries})...`);
            await sleep(delay);
            continue;
          }
          // Exhausted retries for this model, put it on cooldown for 5 minutes
          console.warn(`[AI Analytics] ${model} exhausted retries, cooling down for 5m...`);
          modelCooldowns.set(model, Date.now() + 300000);
          break; // Move to next model
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Groq error ${res.status}`);
        return data.choices[0].message.content;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          console.warn(`[AI Analytics] ${model} timed out, trying next...`);
          break; // Move to next model
        }
        throw err;
      }
    }
  }
  throw new Error("All Groq models failed or rate limited");
}

function parseJson(raw) {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?|\n?```$/gm, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function getPeriodRange(periodType, periodKey, customStart, customEnd) {
  switch (periodType) {
    case "daily": {
      if (!periodKey) throw new Error("period_key required for daily");
      return {
        since: new Date(periodKey + "T00:00:00.000Z"),
        until: new Date(periodKey + "T23:59:59.999Z"),
        key: periodKey,
      };
    }
    case "weekly": {
      if (!periodKey) throw new Error("period_key required for weekly");
      const m = periodKey.match(/^(\d{4})-W(\d{2})$/);
      if (!m) throw new Error("Invalid week format, expected YYYY-Www");
      const year = parseInt(m[1], 10);
      const week = parseInt(m[2], 10);
      // ISO 8601: week 1 is the week containing Jan 4
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const week1MonMs = Date.UTC(year, 0, 4 - (jan4Day - 1));
      const since = new Date(week1MonMs + (week - 1) * 7 * 86400000);
      const until = new Date(since.getTime() + 7 * 86400000 - 1);
      return { since, until, key: periodKey };
    }
    case "monthly": {
      if (!periodKey) throw new Error("period_key required for monthly");
      const [year, month] = periodKey.split("-").map(Number);
      return {
        since: new Date(Date.UTC(year, month - 1, 1)),
        until: new Date(Date.UTC(year, month, 1) - 1),
        key: periodKey,
      };
    }
    case "yearly": {
      if (!periodKey) throw new Error("period_key required for yearly");
      const year = parseInt(periodKey, 10);
      return {
        since: new Date(Date.UTC(year, 0, 1)),
        until: new Date(Date.UTC(year + 1, 0, 1) - 1),
        key: periodKey,
      };
    }
    case "custom": {
      if (!customStart || !customEnd) throw new Error("customStart and customEnd required");
      const since = new Date(customStart + "T00:00:00.000Z");
      const until = new Date(customEnd + "T23:59:59.999Z");
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
    const { data } = await supabase.rpc("search_knowledge_base", {
      query_embedding: embedding,
      match_threshold: 0.80,
      match_count: 1,
    });
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

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

    // Check if already analyzed for this exact period
    const { data: existing } = await supabase
      .from("ai_insights")
      .select("id")
      .eq("period_type", period_type)
      .eq("period_key", resolvedKey)
      .maybeSingle();

    if (existing && !force) {
      return res.json({
        success: false,
        alreadyAnalyzed: true,
        error: "This period has already been analyzed. Use Force Analyze to re-run.",
      });
    }

    // Force: delete existing entry for this period before inserting new
    if (existing) {
      await supabase
        .from("ai_insights")
        .delete()
        .eq("period_type", period_type)
        .eq("period_key", resolvedKey);
    }

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
      return res.json({ success: true, message: "No closed tickets in selected period", ticketCount: 0, results: null });
    }

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

    const batches = [];
    for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
      batches.push(tickets.slice(i, i + BATCH_SIZE));
    }

    const rawProblems = {};
    const rawSolutions = {};

    for (const batch of batches) {
      const ticketLines = batch.map((t) => {
        const summary = (t.Summary || t.Description || "").slice(0, 100).replace(/\n+/g, " ");
        const msgs = msgsByTicket[t.id] || { user: [], admin: [] };
        const userLines = msgs.user.map((m) => `  U:"${m}"`).join("\n");
        const adminLines = msgs.admin.map((m) => `  A:"${m}"`).join("\n");
        return `[${t.Category || "General"}|${t.Department || "?"}] "${summary}"\n${userLines}${adminLines ? "\n" + adminLines : ""}`;
      }).join("\n\n");

      const userPrompt = `Analyze these closed IT support tickets.

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

      try {
        const raw = await callGroq(
          [
            { role: "system", content: "IT support analyst. Extract problems from ticket summary and all messages. Extract solutions ONLY when actual admin fix messages exist — never fabricate solutions or descriptions. Issue/problem titles must be specific (max 5 words) drawn from actual user messages, not category names. Category must be one of: LMS, Hardware, Software, Microsoft 365, Student Portal, ERP, Network, Others. All descriptions strictly from provided data — omit if insufficient. Return compact JSON. Max 8 problems, 6 solutions." },
            { role: "user", content: userPrompt },
          ],
          1200,
        );
        const parsed = parseJson(raw);
        if (!parsed) continue;

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

        // Significantly increased delay between batches to respect Groq RPM limits
        if (batches.length > 1) await sleep(4000 + Math.random() * 2000);
      } catch (err) {
        console.error("[AI Analytics] Batch error:", err.message);
      }
    }

    // Feedback — only from actual satisfaction_comment fields
    let satisfiedThemes = [];
    let dissatisfiedThemes = [];

    const satisfiedComments = tickets
      .filter((t) => t.satisfaction === true && t.satisfaction_comment?.trim())
      .map((t) => t.satisfaction_comment.trim());
    const dissatisfiedComments = tickets
      .filter((t) => t.satisfaction === false && t.satisfaction_comment?.trim())
      .map((t) => t.satisfaction_comment.trim());

    const totalFeedbackComments = satisfiedComments.length + dissatisfiedComments.length;

    if (totalFeedbackComments >= 3) {
      // Pacing before feedback analysis — increased significantly
      await sleep(4000);

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
        const raw = await callGroq(
          [
            { role: "system", content: "Summarize feedback into themes with counts. Only from provided comments, no invention. Return JSON with theme+count objects. Max 6 themes each." },
            { role: "user", content: fbPrompt },
          ],
          500,
        );
        const parsed = parseJson(raw);
        if (parsed) {
          satisfiedThemes = (parsed.satisfied_themes || [])
            .filter((t) => t?.theme?.trim())
            .slice(0, 6);
          dissatisfiedThemes = (parsed.dissatisfied_themes || [])
            .filter((t) => t?.theme?.trim())
            .slice(0, 6);
        }
      } catch (err) {
        console.error("[AI Analytics] Feedback analysis error:", err.message);
      }
    }

    // Hard safety: never return themes when no actual comments exist
    if (satisfiedComments.length === 0) satisfiedThemes = [];
    if (dissatisfiedComments.length === 0) dissatisfiedThemes = [];

    const problemsList = Object.values(rawProblems).sort((a, b) => b.count - a.count);
    const solutionsList = Object.values(rawSolutions).sort((a, b) => b.count - a.count);

    let finalProblems = problemsList.slice(0, 12);
    let finalSolutions = solutionsList.slice(0, 8);

    if (batches.length > 1 && (finalProblems.length > 0 || finalSolutions.length > 0)) {
      // Pacing before consolidation — increased significantly
      await sleep(4000);

      const consolidatePrompt = `Consolidate these IT support analysis results. Merge near-duplicate entries. Keep top ranked only. Preserve or combine descriptions from merged entries.
Category must be one of: LMS, Hardware, Software, Microsoft 365, Student Portal, ERP, Network, Others.

Problems: ${JSON.stringify(finalProblems.slice(0, 20))}
Solutions: ${JSON.stringify(finalSolutions.slice(0, 15))}

Return ONLY valid JSON:
{"problems":[{"category":"string","issue":"string","count":N,"description":"string"}],"solutions":[{"category":"string","problem":"string","solution":"string","count":N,"description":"string"}]}`;

      try {
        const raw = await callGroq(
          [
            { role: "system", content: "Consolidate and deduplicate analysis results. Category must be one of: LMS, Hardware, Software, Microsoft 365, Student Portal, ERP, Network, Others. Preserve descriptions from source entries. Return JSON. Max 12 problems, 8 solutions." },
            { role: "user", content: consolidatePrompt },
          ],
          1400,
        );
        const parsed = parseJson(raw);
        if (parsed) {
          if (parsed.problems?.length) finalProblems = parsed.problems.sort((a, b) => (b.count || 0) - (a.count || 0));
          if (parsed.solutions?.length) finalSolutions = parsed.solutions.sort((a, b) => (b.count || 0) - (a.count || 0));
        }
      } catch (err) {
        console.error("[AI Analytics] Consolidation error:", err.message);
      }
    }

    let suggestedKbEntries = [];
    if (finalProblems.length > 0 || finalSolutions.length > 0) {
      // Pacing before KB suggestions — increased significantly
      await sleep(4000);

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
        const raw = await callGroq(
          [
            { role: "system", content: "Generate specific Q&A knowledge base entries for IT support. Each answer must be a complete, actionable resolution. Never end with 'contact IT support' or escalation advice. Return JSON." },
            { role: "user", content: kbPrompt },
          ],
          900,
        );
        const parsed = parseJson(raw);
        if (parsed?.kb_suggestions) {
          const boilerplateRegex = /if (none of these|this doesn.t|these steps don.t)|contact (it support|your it|the it)|for further assistance|for additional (help|support)/i;
          suggestedKbEntries = parsed.kb_suggestions
            .filter((e) => e.question?.trim() && e.answer?.trim())
            .map((e) => ({
              ...e,
              answer: e.answer
                .split(/(?<=[.!?])\s+/)
                .filter((s) => !boilerplateRegex.test(s))
                .join(" ")
                .trim(),
            }))
            .filter((e) => e.answer.length > 0)
            .slice(0, 6);
        }
      } catch (err) {
        console.error("[AI Analytics] KB suggestions error:", err.message);
      }
    }

    // Filter out suggestions that already exist in the knowledge base (semantic dedup)
    const dedupedKb = [];
    for (const entry of suggestedKbEntries) {
      const isDup = await isKbDuplicate(entry.question);
      if (!isDup) dedupedKb.push(entry);
      // Small delay to avoid embedding API rate limits
      await sleep(200);
    }
    suggestedKbEntries = dedupedKb;

    const finalResults = {
      problems: finalProblems,
      solutions: finalSolutions,
      satisfied_themes: satisfiedThemes,
      dissatisfied_themes: dissatisfiedThemes,
      suggested_kb_entries: suggestedKbEntries,
      feedback_comment_count: totalFeedbackComments,
    };

    const { data: insight, error: insightErr } = await supabase
      .from("ai_insights")
      .insert({
        period_type,
        period_key: resolvedKey,
        scope: { period_type, period_key: resolvedKey, force },
        ticket_count: tickets.length,
        results: finalResults,
        knowledge_added_count: 0,
        created_by: adminId,
      })
      .select("id")
      .single();

    if (insightErr) console.error("[AI Analytics] Insight save error:", insightErr.message);

    logActivity({
      adminId,
      actionType: "AI_ANALYSIS_RUN",
      targetId: String(insight?.id || ""),
      targetLabel: (() => {
        const periodLabels = {
          daily: `day of ${resolvedKey}`,
          weekly: `week ${resolvedKey.replace(/^\d{4}-/, "")} ${resolvedKey.slice(0, 4)}`,
          monthly: new Date(resolvedKey + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          yearly: `year ${resolvedKey}`,
          custom: `${resolvedKey.replace("/", " to ")}`,
        };
        const period = periodLabels[period_type] || resolvedKey;
        const verb = force ? "Force analyzed" : "Analyzed";
        return `${verb} ${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} for ${period}`;
      })(),
      metadata: {
        period_key: resolvedKey,
        force,
        ticket_count: tickets.length,
        problems_found: finalProblems.length,
        solutions_found: finalSolutions.length,
        kb_suggestions: suggestedKbEntries.length,
      },
    });

    return res.json({
      success: true,
      ticketCount: tickets.length,
      results: finalResults,
      insightId: insight?.id || null,
    });
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

  const text = `Q: ${question.trim()}\nA: ${answer.trim()}`;
  const resolvedTitle = title?.trim() || question.trim().slice(0, 80);

  try {
    const embedding = await embedText(text);
    const { data, error } = await supabase
      .from("knowledge_base")
      .insert({
        content: text,
        metadata: { source: "ai_analysis", title: resolvedTitle },
        embedding,
      })
      .select("id, content, metadata")
      .single();

    if (error) throw error;

    logActivity({
      adminId,
      actionType: "KNOWLEDGE_ADDED",
      targetId: String(data.id),
      targetLabel: resolvedTitle,
      metadata: { source: "ai_analysis", title: resolvedTitle },
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
