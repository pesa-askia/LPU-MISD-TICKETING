import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./ticketchat.css";
import { useLoading } from "../../context/LoadingContext";
import { realtimeSupabase } from "../../realtimeSupabaseClient";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import ChatHeader from "./TicketChat/ChatHeader";
import TicketDetails from "./TicketChat/TicketDetails";
import ChatMessages from "./TicketChat/ChatMessages";
import ChatInput from "./TicketChat/ChatInput";
import AttachmentViewer from "./TicketChat/AttachmentViewer";

export default function TicketChat({ adminView = false } = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const {
    getTicket,
    getMessages,
    setTicket: cacheTicket,
    setMessages: cacheMessages,
  } = useTicketsCache();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedSummary, setExpandedSummary] = useState(false);
  const scrollRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const userIdRef = useRef(null);
  const seenMessageIdsRef = useRef(new Set());
  const [viewerId, setViewerId] = useState(null);
  const [viewerEmail, setViewerEmail] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const normalizeTicketId = (value) => {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  };

  const ticketKey = normalizeTicketId(id);
  const cachedMessages = getMessages(ticketKey);

  const getDisplayName = (name, email, role) => {
    const trimmedName = (name || "").trim();
    if (trimmedName) return trimmedName;
    const trimmedEmail = (email || "").trim();
    if (trimmedEmail) return trimmedEmail.split("@")[0];
    return role === "admin" ? "Admin" : "Student";
  };

  const getStoredProfile = () => {
    const storedName = (localStorage.getItem("userFullName") || "").trim();
    const storedEmail = (localStorage.getItem("userEmail") || "").trim();
    const email = storedEmail || viewerEmail || "";
    const name = storedName || (email ? email.split("@")[0] : "");
    return { name, email };
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const isTicketClosed = (ticketData) => {
    if (!ticketData) return false;
    if (ticketData.closed_at) return true;
    const statusValue =
      ticketData?.status ??
      ticketData?.Status ??
      ticketData?.state ??
      ticketData?.State;
    return String(statusValue || "")
      .toLowerCase()
      .includes("closed");
  };

  const handleCloseTicket = async () => {
    if (!adminView) {
      alert("Only admins can update ticket status.");
      return;
    }
    if (!ticket) return;

    try {
      showLoading();
      const now = new Date().toISOString();
      const nextClosed = !isTicketClosed(ticket);
      const payload = nextClosed
        ? { status: "Closed", closed_at: now }
        : { status: "Open", closed_at: null };

      const { data, error } = await realtimeSupabase
        .from("Tickets")
        .update(payload)
        .eq("id", ticket.id)
        .select();

      if (error) {
        alert(error.message || "Failed to update ticket status");
        return;
      }

      const updated = (Array.isArray(data) && data[0]) || {
        ...ticket,
        ...payload,
      };
      setTicket(updated);
      cacheTicket(id, updated);
    } catch (err) {
      console.error("Unexpected error updating ticket:", err);
      alert("Unexpected error updating ticket status");
    } finally {
      hideLoading();
    }
  };

  // Fetch ticket directly from Supabase (RLS enforces ownership)
  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setError(null);

        const cached = getTicket(id);
        if (cached) {
          setTicket(cached);
        } else {
          showLoading();
        }

        const token = localStorage.getItem("authToken");
        if (!token) {
          setError("You must be logged in to view tickets.");
          hideLoading();
          return;
        }

        const decoded = jwtDecode(token);
        userIdRef.current = decoded.id;
        setViewerId(decoded.id);
        setViewerEmail(decoded.email || "");

        let q = realtimeSupabase.from("Tickets").select("*").eq("id", id);
        if (!adminView) q = q.eq("created_by", decoded.id);
        const { data, error } = await q.single();

        if (error) {
          setError(
            error.code === "PGRST116"
              ? "Ticket not found or you don't have permission to view this ticket."
              : error.message || "Failed to load ticket",
          );
        } else if (!data) {
          setError(
            "Ticket not found or you don't have permission to view this ticket.",
          );
        } else {
          setTicket(data);
          cacheTicket(id, data);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred");
      } finally {
        hideLoading();
      }
    };

    fetchTicket();
  }, [id, adminView, getTicket, cacheTicket, showLoading, hideLoading]);

  useEffect(() => {
    if (!ticketKey) return;
    const cached = getMessages(ticketKey);
    if (Array.isArray(cached) && cached.length > 0) {
      setMessages(cached);
    }
  }, [ticketKey, getMessages]);

  // Load existing messages + subscribe to realtime updates
  useEffect(() => {
    const ticketId = ticketKey;
    if (!ticketId) return;

    let isCancelled = false;

    const mapRow = (row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderRole: row.sender_role,
      senderName: row.sender_name || null,
      senderEmail: row.sender_email || null,
      text: row.message_text,
      attachments: parseMessageAttachments(row.attachments),
      time: row.created_at,
    });

    const isMissingColumn = (err, column) => {
      if (!err) return false;
      const message = String(err.message || "").toLowerCase();
      const details = String(err.details || "").toLowerCase();
      return (
        err.code === "42703" ||
        message.includes(column) ||
        details.includes(column)
      );
    };

    const loadMessages = async () => {
      try {
        let res = await realtimeSupabase
          .from("ticket_messages")
          .select(
            "id, sender_id, sender_role, sender_name, sender_email, message_text, attachments, created_at",
          )
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false })
          .range(0, 99);

        if (res.error && isMissingColumn(res.error, "attachments")) {
          res = await realtimeSupabase
            .from("ticket_messages")
            .select(
              "id, sender_id, sender_role, sender_name, sender_email, message_text, created_at",
            )
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: false })
            .range(0, 99);
        }

        if (res.error) {
          console.error("[Chat] Error loading messages:", res.error);
          return;
        }
        if (isCancelled) return;

        const mapped = (res.data || [])
          .map((row) => {
            seenMessageIdsRef.current.add(row.id);
            return mapRow(row);
          })
          .reverse();
        setMessages(mapped);
      } catch (err) {
        console.error("Unexpected error loading messages:", err);
      }
    };

    loadMessages();

    const channel = realtimeSupabase
      .channel(`ticket_messages_${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row || seenMessageIdsRef.current.has(row.id)) return;
          seenMessageIdsRef.current.add(row.id);
          setMessages((prev) => {
            return [...prev, mapRow(row)];
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR")
          console.error("Realtime channel error for ticket_messages");
      });

    return () => {
      isCancelled = true;
      realtimeSupabase.removeChannel(channel);
    };
  }, [ticketKey]);

  useEffect(() => {
    if (!ticketKey) return;
    if (cachedMessages === messages) return;
    cacheMessages(ticketKey, messages);
  }, [ticketKey, messages, cachedMessages, cacheMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateStickiness = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      isAtBottomRef.current = distanceFromBottom < 120;
    };

    updateStickiness();
    el.addEventListener("scroll", updateStickiness);
    return () => el.removeEventListener("scroll", updateStickiness);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;

    const senderId = userIdRef.current;
    if (!senderId) {
      alert("Session error: please log in again and retry.");
      return;
    }

    const senderRole = adminView ? "admin" : "user";
    const storedProfile = getStoredProfile();
    const senderName = getDisplayName(
      storedProfile.name,
      storedProfile.email,
      senderRole,
    );
    const senderEmail = storedProfile.email || "";

    setText("");

    const tempId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setMessages((prev) => {
      const next = [
        ...prev,
        {
          id: tempId,
          senderId,
          senderRole,
          senderName,
          senderEmail,
          text: trimmed,
          attachments: [],
          time: new Date().toISOString(),
          pending: true,
        },
      ];
      return next;
    });

    try {
      const { data, error } = await realtimeSupabase
        .from("ticket_messages")
        .insert([
          {
            ticket_id: normalizeTicketId(id),
            sender_id: senderId,
            sender_role: senderRole,
            sender_name: senderName,
            sender_email: senderEmail || null,
            message_text: trimmed,
            ticket_owner_id: ticket?.created_by || null,
          },
        ])
        .select(
          "id, sender_id, sender_role, sender_name, sender_email, message_text, attachments, created_at",
        );

      if (error) {
        alert(error.message || "Failed to send message");
        setText(trimmed);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      if (data && data[0]) {
        const row = data[0];
        if (!seenMessageIdsRef.current.has(row.id)) {
          seenMessageIdsRef.current.add(row.id);
          setMessages((prev) => {
            return prev.map((m) =>
              m.id === tempId
                ? {
                    id: row.id,
                    senderId: row.sender_id,
                    senderRole: row.sender_role,
                    senderName: row.sender_name || senderName,
                    senderEmail: row.sender_email || senderEmail || null,
                    text: row.message_text,
                    attachments: parseMessageAttachments(row.attachments),
                    time: row.created_at,
                  }
                : m,
            );
          });
        }
      }
    } catch (err) {
      console.error("Unexpected error sending message:", err);
      setText(trimmed);
    }
  }

  const getAttachmentSrc = (attachment) =>
    attachment.url || attachment.data || "";

  const downloadAttachment = async (attachment) => {
    const src = getAttachmentSrc(attachment);
    if (!src) return;

    if (attachment.url) {
      try {
        const res = await fetch(attachment.url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(src, "_blank");
      }
      return;
    }

    // Legacy base64 path
    const link = document.createElement("a");
    link.href = src;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isImageFile = (filename) => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
  };

  const parseMessageAttachments = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const adminParticipants = useMemo(() => {
    if (adminView) return [];
    const unique = new Map();
    for (const msg of messages) {
      if (msg.senderRole !== "admin") continue;
      const name = (msg.senderName || "").trim();
      const email = (msg.senderEmail || "").trim();
      if (!name && !email) continue;
      const key = msg.senderId || email || name;
      if (unique.has(key)) continue;
      unique.set(key, {
        id: key,
        name: name || (email ? email.split("@")[0] : "Admin"),
        email,
      });
    }
    return Array.from(unique.values());
  }, [messages, adminView]);

  if (error) {
    return (
      <div className={`chat-wrapper${adminView ? " chat-wrapper-admin" : ""}`}>
        <div
          className="chat-card"
          style={{
            textAlign: "center",
            color: "#d32f2f",
            padding: "40px",
          }}
        >
          <h2>Error Loading Ticket</h2>
          <p>{error}</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className={`chat-wrapper${adminView ? " chat-wrapper-admin" : ""}`}>
        <div
          className="chat-card"
          style={{ textAlign: "center", padding: "40px" }}
        >
          <h2>Loading Ticket Details...</h2>
        </div>
      </div>
    );
  }

  const creatorName = (() => {
    const name = (ticket.created_by_name || "").trim();
    if (name) return name;
    const email = (ticket.created_by_email || "").trim();
    if (email) return email.split("@")[0];
    return ticket.Department || "Student";
  })();
  const creatorEmail = (ticket.created_by_email || "").trim();
  const headerInitial = creatorName.trim().charAt(0).toUpperCase();

  return (
    <div className={`chat-wrapper${adminView ? " chat-wrapper-admin" : ""}`}>
      <div className="chat-card">
        <ChatHeader
          adminView={adminView}
          creatorName={creatorName}
          creatorEmail={creatorEmail}
          headerInitial={headerInitial}
          adminParticipants={adminParticipants}
          onBack={() => navigate(-1)}
        />

        <TicketDetails
          ticket={ticket}
          adminView={adminView}
          expandedSummary={expandedSummary}
          onToggleSummary={() => setExpandedSummary((prev) => !prev)}
          onCloseTicket={handleCloseTicket}
          isTicketClosed={isTicketClosed}
          formatDateTime={formatDateTime}
        />

        <ChatMessages
          messages={messages}
          viewerId={viewerId}
          adminView={adminView}
          getDisplayName={getDisplayName}
          scrollRef={scrollRef}
          nowMs={nowMs}
          getAttachmentSrc={getAttachmentSrc}
          isImageFile={isImageFile}
          onOpenAttachment={setSelectedImage}
          onDownloadAttachment={downloadAttachment}
        />

        <ChatInput text={text} onTextChange={setText} onSend={handleSend} />
      </div>

      <AttachmentViewer
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
        getAttachmentSrc={getAttachmentSrc}
        onDownload={downloadAttachment}
      />
    </div>
  );
}
