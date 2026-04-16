import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./ticketchat.css";
import { useLoading } from "../../context/LoadingContext";
import {
  Send,
  ArrowLeft,
  Download,
  Image as ImageIcon,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { realtimeSupabase } from "../../realtimeSupabaseClient";
import { useTicketsCache } from "../../context/TicketsCacheContext";

export default function TicketChat({ adminView = false } = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const {
    getTicket,
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
  const userIdRef = useRef(null);
  const seenMessageIdsRef = useRef(new Set());
  const [viewerId, setViewerId] = useState(null);
  const [viewerEmail, setViewerEmail] = useState("");

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

  // Load existing messages + subscribe to realtime updates
  useEffect(() => {
    const ticketId = Number(id);
    if (!ticketId || Number.isNaN(ticketId)) return;

    let isCancelled = false;

    const loadMessages = async () => {
      try {
        const res = await realtimeSupabase
          .from("ticket_messages")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true });

        if (res.error) {
          console.error("[Chat] Error loading messages:", res.error);
          return;
        }
        if (isCancelled) return;

        const mapped = (res.data || []).map((row) => {
          seenMessageIdsRef.current.add(row.id);
          return {
            id: row.id,
            senderId: row.sender_id,
            senderRole: row.sender_role,
            senderName: row.sender_name || null,
            senderEmail: row.sender_email || null,
            text: row.message_text,
            time: row.created_at,
          };
        });
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
            const next = [
              ...prev,
              {
                id: row.id,
                senderId: row.sender_id,
                senderRole: row.sender_role,
                senderName: row.sender_name || null,
                senderEmail: row.sender_email || null,
                text: row.message_text,
                time: row.created_at,
              },
            ];
            cacheMessages(ticketId, next);
            return next;
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
  }, [id]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId,
        senderRole,
        senderName,
        senderEmail,
        text: trimmed,
        time: new Date().toISOString(),
        pending: true,
      },
    ]);

    try {
      const { data, error } = await realtimeSupabase
        .from("ticket_messages")
        .insert([
          {
            ticket_id: Number(id),
            sender_id: senderId,
            sender_role: senderRole,
            sender_name: senderName,
            sender_email: senderEmail || null,
            message_text: trimmed,
          },
        ])
        .select("*");

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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    id: row.id,
                    senderId: row.sender_id,
                    senderRole: row.sender_role,
                    senderName: row.sender_name || senderName,
                    senderEmail: row.sender_email || senderEmail || null,
                    text: row.message_text,
                    time: row.created_at,
                  }
                : m,
            ),
          );
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

  const parseAttachments = () => {
    if (!ticket.attachments) return [];
    try {
      const parsed = JSON.parse(ticket.attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Error parsing attachments:", e);
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
      <div className="wrapper">
        <div
          className="card"
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
      <div className="wrapper">
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <h2>Loading Ticket Details...</h2>
        </div>
      </div>
    );
  }

  const attachments = parseAttachments();
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
    <div className="wrapper">
      <div className="card chat-card">
        <div className="chat-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} />
          </button>
          {adminView ? (
            <div className="assignee">
              <div className="avatar">{headerInitial || "S"}</div>
              <div>
                <div className="assignee-name">{creatorName}</div>
                <div className="assignee-email">
                  {creatorEmail || "Email unavailable"}
                </div>
              </div>
            </div>
          ) : (
            <div className="assignee-group">
              {adminParticipants.length > 0 ? (
                adminParticipants.map((participant) => {
                  const initial = (participant.name || participant.email || "A")
                    .trim()
                    .charAt(0)
                    .toUpperCase();

                  return (
                    <div key={participant.id} className="assignee">
                      <div className="avatar">{initial || "A"}</div>
                      <div>
                        <div className="assignee-name">{participant.name}</div>
                        {participant.email && (
                          <div className="assignee-email">
                            {participant.email}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  className="assignee assignee-skeleton"
                  aria-label="Awaiting admin reply"
                >
                  <div className="avatar skeleton-circle" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ticket-details">
          <div className="details-row details-main-row">
            <div className="details-col ticket-no-col">
              <strong>Ticket No.</strong>
              <div className="ticket-no-value">No. {ticket.id}</div>
            </div>

            <div className="ticket-status-row inline-status">
              <strong>Status:</strong>
              <span className="status-pill">
                {ticket.status || ticket.Status || "Open"}
              </span>
              {adminView && (
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  className="close-ticket-btn"
                >
                  {isTicketClosed(ticket) ? "Reopen Ticket" : "Close Ticket"}
                </button>
              )}
            </div>

            <button
              type="button"
              className={`details-col summary summary-toggle ${expandedSummary ? "expanded" : ""}`}
              onClick={() => setExpandedSummary((prev) => !prev)}
              aria-expanded={expandedSummary}
            >
              <strong>Summary</strong>
              <div className="summary-preview">{ticket.Summary || "-"}</div>
              <div className="summary-indicator">
                {expandedSummary ? "Hide details" : "View details"}
                {expandedSummary ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </div>
            </button>

            {attachments.length > 0 && (
              <div className="attachments-compact inline-attachments">
                <h4 className="attachments-title">
                  Attachments ({attachments.length})
                </h4>
                <div className="attachments-list">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="attachment-chip">
                      {isImageFile(attachment.name) ? (
                        <img
                          src={getAttachmentSrc(attachment)}
                          alt={attachment.name}
                          className="attachment-thumb"
                          onClick={() => setSelectedImage(attachment)}
                          title="Click to view full size"
                        />
                      ) : (
                        <ImageIcon size={22} style={{ color: "#999" }} />
                      )}
                      <small className="attachment-name">
                        {attachment.name}
                      </small>
                      <button
                        type="button"
                        onClick={() => downloadAttachment(attachment)}
                        className="attachment-download-btn"
                      >
                        <Download size={10} />
                        Get
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className={`details-extra ${expandedSummary ? "open" : ""}`}>
            <div className="details-row details-grid-row">
              <div className="details-col">
                <strong>Department</strong>
                <div>{ticket.Department}</div>
              </div>
              <div className="details-col">
                <strong>Type</strong>
                <div>{ticket.Type}</div>
              </div>
              <div className="details-col">
                <strong>Category</strong>
                <div>{ticket.Category}</div>
              </div>
              <div className="details-col">
                <strong>Site</strong>
                <div>{ticket.Site}</div>
              </div>
              <div className="details-col">
                <strong>Created At</strong>
                <div>{formatDateTime(ticket.created_at)}</div>
              </div>
              <div className="details-col">
                <strong>Closed At</strong>
                <div>{formatDateTime(ticket.closed_at)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="chat-messages" ref={scrollRef} aria-live="polite">
          {messages.map((m) => {
            const isOwn = viewerId && m.senderId === viewerId;
            const isAdminMessage = adminView && m.senderRole === "admin";
            const alignRight = adminView ? isAdminMessage : isOwn;
            const isOtherAdmin = adminView && isAdminMessage && !isOwn;
            const hasIdentity = Boolean(m.senderName || m.senderEmail);
            const displayName = isOwn
              ? "You"
              : hasIdentity
                ? getDisplayName(m.senderName, m.senderEmail, m.senderRole)
                : "";
            const showMeta = isOwn || hasIdentity;

            return (
              <div
                key={m.id}
                className={`msg ${alignRight ? "msg-right" : "msg-left"} ${isOtherAdmin ? "msg-other-admin" : ""}`}
              >
                <div className="msg-content">
                  {showMeta && (
                    <div className="message-meta">
                      <span className="message-name">{displayName}</span>
                    </div>
                  )}
                  <div className="bubble">{m.text}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="chat-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Start typing..."
          />
          <button className="send-btn" onClick={handleSend} aria-label="send">
            <Send size={15} />
          </button>
        </div>
      </div>

      {selectedImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            style={{
              position: "relative",
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "20px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "#333",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "35px",
                height: "35px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} />
            </button>
            <img
              src={getAttachmentSrc(selectedImage)}
              alt={selectedImage.name}
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
              }}
            />
            <div style={{ marginTop: "15px", textAlign: "center" }}>
              <p
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "14px",
                }}
              >
                {selectedImage.name}
              </p>
              <button
                onClick={() => downloadAttachment(selectedImage)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  margin: "0 auto",
                }}
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
