import express from "express";
import { adminMiddleware } from "../middleware/auth.js";
import { supabase } from "../config/database.js";
import { embedText } from "../services/chatbotService.js";
import { logActivity } from "../services/activityService.js";

const router = express.Router();

function chunkText(text, maxChars = 500) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks = [];

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      chunks.push(para);
    } else {
      // Split long paragraphs by sentence
      const sentences = para.split(/(?<=[.?!])\s+/);
      let current = "";
      for (const s of sentences) {
        if ((current + " " + s).length > maxChars && current) {
          chunks.push(current.trim());
          current = s;
        } else {
          current += (current ? " " : "") + s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }

  return chunks;
}

// GET /api/knowledge — list all entries (paginated)
router.get("/", adminMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("knowledge_base")
    .select("id, content, metadata", { count: "exact" })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error)
    return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data, total: count });
});

// POST /api/knowledge — add knowledge entry (auto-embeds)
router.post("/", adminMiddleware, async (req, res) => {
  const { text, title } = req.body;
  if (!text?.trim())
    return res.status(400).json({ success: false, error: "text required" });

  const chunks = chunkText(text.trim());
  if (chunks.length === 0)
    return res.status(400).json({ success: false, error: "no valid text" });

  const inserted = [];
  const errors = [];

  for (const chunk of chunks) {
    try {
      const embedding = await embedText(chunk);
      const metadata = {
        source: "manual",
        title: title?.trim() || "Knowledge Entry",
      };

      const { data, error } = await supabase
        .from("knowledge_base")
        .insert({ content: chunk, metadata, embedding })
        .select("id, content, metadata")
        .single();

      if (error) errors.push(error.message);
      else inserted.push(data);
    } catch (err) {
      console.error("[Knowledge API Error]:", err.message); // Force it to print to terminal
      errors.push(err.message);
    }
  }

  if (inserted.length === 0) {
    console.error(
      "[Knowledge API Fatal]: All chunks failed:",
      errors.join("; "),
    ); // Print final failure
    return res.status(500).json({ success: false, error: errors.join("; ") });
  }

  const adminId = req.user?.id || req.user?.sub;
  logActivity({
    adminId,
    actionType: "KNOWLEDGE_ADDED",
    targetType: "knowledge",
    targetId: inserted[0]?.id,
    targetLabel: title?.trim() || "Knowledge Entry",
    metadata: { chunks: inserted.length, title: title?.trim() || "Knowledge Entry" },
  });

  res.json({
    success: true,
    inserted,
    chunks: inserted.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// PUT /api/knowledge/:id — update a knowledge entry (re-embeds)
router.put("/:id", adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { text, title } = req.body;

  if (!text?.trim())
    return res.status(400).json({ success: false, error: "text required" });

  const trimmedText = text.trim();
  const resolvedTitle = title?.trim() || "Knowledge Entry";

  const { data: existing, error: fetchError } = await supabase
    .from("knowledge_base")
    .select("metadata")
    .eq("id", id)
    .single();

  if (fetchError)
    return res.status(404).json({ success: false, error: fetchError.message });

  try {
    const embedding = await embedText(trimmedText);
    const updatedMetadata = {
      ...(existing?.metadata || {}),
      source: existing?.metadata?.source || "manual",
      title: resolvedTitle,
    };

    const { data, error } = await supabase
      .from("knowledge_base")
      .update({ content: trimmedText, metadata: updatedMetadata, embedding })
      .eq("id", id)
      .select("id, content, metadata")
      .single();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    const adminId = req.user?.id || req.user?.sub;
    logActivity({
      adminId,
      actionType: "KNOWLEDGE_EDITED",
      targetType: "knowledge",
      targetId: id,
      targetLabel: resolvedTitle,
      metadata: { title: resolvedTitle },
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[Knowledge API Update Error]:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/knowledge/:id
router.delete("/:id", adminMiddleware, async (req, res) => {
  const { id } = req.params;

  const { data: existing } = await supabase
    .from("knowledge_base")
    .select("metadata")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
  if (error)
    return res.status(500).json({ success: false, error: error.message });

  const adminId = req.user?.id || req.user?.sub;
  const title = existing?.metadata?.title || "Knowledge Entry";
  logActivity({
    adminId,
    actionType: "KNOWLEDGE_DELETED",
    targetType: "knowledge",
    targetId: id,
    targetLabel: title,
    metadata: { title },
  });

  res.json({ success: true });
});

// DELETE /api/knowledge/bulk — delete by title/source group
router.delete("/bulk/by-title", adminMiddleware, async (req, res) => {
  const { title } = req.body;
  if (!title)
    return res.status(400).json({ success: false, error: "title required" });

  const { error } = await supabase
    .from("knowledge_base")
    .delete()
    .eq("metadata->>title", title);

  if (error)
    return res.status(500).json({ success: false, error: error.message });

  const adminId = req.user?.id || req.user?.sub;
  logActivity({
    adminId,
    actionType: "KNOWLEDGE_BULK_DELETED",
    targetType: "knowledge",
    targetLabel: title,
    metadata: { title },
  });

  res.json({ success: true });
});

export default router;
