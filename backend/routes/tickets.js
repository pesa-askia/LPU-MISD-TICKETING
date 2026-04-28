import express from "express";
import { supabase } from "../config/database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const router = express.Router();

// POST /api/tickets/upload — upload an attachment to Storage via service_role (bypasses RLS)
router.post("/upload", authMiddleware, async (req, res) => {
  try {
    const { fileName, fileType, fileData } = req.body;
    if (!fileName || !fileData) {
      return res
        .status(400)
        .json({
          success: false,
          message: "fileName and fileData are required",
        });
    }

    const buffer = Buffer.from(fileData, "base64");
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `tickets/${req.user.id}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from("ticket-attachments")
      .upload(path, buffer, {
        contentType: fileType || "application/octet-stream",
        upsert: false,
      });

    if (error)
      return res.status(400).json({ success: false, message: error.message });

    const {
      data: { publicUrl },
    } = supabase.storage.from("ticket-attachments").getPublicUrl(path);

    return res.json({
      success: true,
      url: publicUrl,
      name: fileName,
      size: buffer.byteLength,
      type: fileType,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/tickets — tickets owned by the authenticated user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("Tickets")
      .select("*")
      .eq("created_by", req.user.id)
      .order("id", { ascending: false });

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/tickets/admin — all tickets (admin only)
router.get("/admin", adminMiddleware, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("Tickets")
      .select("*")
      .order("id", { ascending: false });

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/tickets/:id — single ticket (owner or admin)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket ID" });
    }

    let query = supabase.from("Tickets").select("*").eq("id", ticketId);
    if (req.user.app_role !== "admin")
      query = query.eq("created_by", req.user.id);

    const { data, error } = await query;
    if (error)
      return res.status(400).json({ success: false, message: error.message });
    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found or access denied" });
    }
    return res.json({ success: true, data: data[0] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/tickets/:id/admin-names — admin name lookup for a ticket (owner or admin)
router.get("/:id/admin-names", authMiddleware, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket ID" });
    }

    if (req.user?.app_role !== "admin") {
      const { data: ticketRows, error: ticketError } = await supabase
        .from("Tickets")
        .select("id")
        .eq("id", ticketId)
        .eq("created_by", req.user.id)
        .limit(1);

      if (ticketError) {
        return res
          .status(400)
          .json({ success: false, message: ticketError.message });
      }
      if (!ticketRows || ticketRows.length === 0) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Ticket not found or access denied",
          });
      }
    }

    const { data: messages, error: messageError } = await supabase
      .from("ticket_messages")
      .select("sender_id")
      .eq("ticket_id", ticketId)
      .eq("sender_role", "admin");

    if (messageError) {
      return res
        .status(400)
        .json({ success: false, message: messageError.message });
    }

    const adminIds = Array.from(
      new Set((messages || []).map((m) => m.sender_id).filter(Boolean)),
    );

    if (adminIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data: admins, error: adminError } = await supabase
      .from("admin_users")
      .select("id, full_name, email")
      .in("id", adminIds);

    if (adminError) {
      return res
        .status(400)
        .json({ success: false, message: adminError.message });
    }

    return res.status(200).json({ success: true, data: admins || [] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/tickets — create a new ticket
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      Summary,
      Description,
      Type,
      Department,
      Category,
      Site,
      attachments,
    } = req.body;

    if (!Summary || !Description) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Summary and Description are required",
        });
    }

    const { data, error } = await supabase
      .from("Tickets")
      .insert([
        {
          Summary,
          Description,
          Type,
          Department,
          Category,
          Site,
          created_by: req.user.id,
          status: "Open",
          created_at: new Date().toISOString(),
          attachments:
            attachments && attachments.length > 0
              ? JSON.stringify(attachments)
              : null,
        },
      ])
      .select();

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    return res.status(201).json({ success: true, data: data[0] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// PATCH /api/tickets/:id/status — open or close ticket (admin only)
router.patch("/:id/status", adminMiddleware, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket ID" });
    }

    const { status, closed_at } = req.body;
    if (!status)
      return res
        .status(400)
        .json({ success: false, message: "status is required" });

    const { data, error } = await supabase
      .from("Tickets")
      .update({ status, closed_at: closed_at ?? null })
      .eq("id", ticketId)
      .select();

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.json({ success: true, data: data[0] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// PATCH /api/tickets/:id/assignees — update assignee slots (admin only)
router.patch("/:id/assignees", adminMiddleware, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket ID" });
    }

    const { Assignee1, Assignee2, Assignee3 } = req.body;
    const callerId = req.user?.id;
    const isTicketAdmin = Number(req.user?.admin_level) === 1;

    if (isTicketAdmin) {
      const assignees = [Assignee1, Assignee2, Assignee3].filter(Boolean);
      if (assignees.some((id) => id !== callerId)) {
        return res.status(403).json({
          success: false,
          message: "Ticket admins can only assign tickets to themselves",
        });
      }
    }

    const { data, error } = await supabase
      .from("Tickets")
      .update({
        Assignee1: Assignee1 ?? null,
        Assignee2: Assignee2 ?? null,
        Assignee3: Assignee3 ?? null,
      })
      .eq("id", ticketId)
      .select();

    if (error)
      return res.status(400).json({ success: false, message: error.message });
    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.json({ success: true, data: data[0] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
