import express from "express";
import { adminMiddleware } from "../middleware/auth.js";
import { supabase } from "../config/database.js";
import { embedText } from "../services/chatbotService.js";

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

  res.json({
    success: true,
    inserted,
    chunks: inserted.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// DELETE /api/knowledge/:id
router.delete("/:id", adminMiddleware, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
  if (error)
    return res.status(500).json({ success: false, error: error.message });

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
  res.json({ success: true });
});

export default router;
