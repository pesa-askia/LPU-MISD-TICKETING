import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./ticketchat.css";
import { supabase } from "../../supabaseClient";
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
  const { getTicket, setTicket: cacheTicket, setMessages: cacheMessages } = useTicketsCache();
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
      ticketData?.status ?? ticketData?.Status ?? ticketData?.state ?? ticketData?.State;
    return String(statusValue || "").toLowerCase().includes("closed");
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
      const { data, error } = await supabase
        .from("Tickets")
        .eq("id", ticket.id)
        .update(payload);

      if (error) {
        console.error("Error updating ticket:", error);
        alert(error.message || "Failed to update ticket status");
        return;
      }

      // data may have the updated row in Supabase wrapper response or null
      const updatedData = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (updatedData) {
        setTicket(updatedData);
        cacheTicket(id, updatedData);
      } else {
        // fallback: update existing ticket object
        const fallback = { ...ticket, ...payload };
        setTicket(fallback);
        cacheTicket(id, fallback);
      }
    } catch (err) {
      console.error("Unexpected error updating ticket:", err);
      alert("Unexpected error updating ticket status");
    } finally {
      hideLoading();
    }
  };

  // Fetch ticket from Supabase
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

        // Get user ID from JWT token
        const token = localStorage.getItem("authToken");
        if (!token) {
          setError("You must be logged in to view tickets.");
          hideLoading();
          return;
        }

        const decoded = jwtDecode(token);
        const userId = decoded.id;
        userIdRef.current = userId;
        setViewerId(userId);

        // Fetch ticket (user: verify ownership; admin: can view any ticket)
        let q = supabase.from("Tickets").select("*").eq("id", id);
        if (!adminView) q = q.eq("created_by", userId);
        const { data, error } = await q.single();

        if (error) {
          console.error("Error fetching ticket:", error);
          if (error.code === "PGRST116") {
            setError(
              "Ticket not found or you don't have permission to view this ticket.",
            );
          } else {
            setError(error.message || "Failed to load ticket");
          }
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
        console.log("[Chat] Loading messages from Supabase for ticket", ticketId);

        const res = await realtimeSupabase
          .from("ticket_messages")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true });

        if (res.error) {
          console.error("[Chat] Error loading messages:", res.error);
          return;
        }

        const data = res.data;

        if (isCancelled) return;

        console.log("[Chat] Loaded messages from Supabase:", data);

        const mapped = (data || []).map((row) => {
          seenMessageIdsRef.current.add(row.id);
          return {
            id: row.id,
            senderId: row.sender_id,
            senderRole: row.sender_role,
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
        if (status === "CHANNEL_ERROR") {
          console.error("Realtime channel error for ticket_messages");
        }
      });

    return () => {
      isCancelled = true;
      realtimeSupabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;

    const senderId = userIdRef.current;
    if (!senderId) {
      console.warn("Missing sender ID, cannot send message");
      alert("Session error: please log in again and retry.");
      return;
    }

    setText("");

    // Optimistic UI: show the message immediately
    const tempId =
      (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const optimisticMessage = {
      id: tempId,
      senderId,
      senderRole: adminView ? "admin" : "user",
      text: trimmed,
      time: new Date().toISOString(),
      pending: true,
    };

    console.log("[Chat] Adding optimistic message", optimisticMessage);
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const { data, error } = await realtimeSupabase
        .from("ticket_messages")
        .insert([
          {
            ticket_id: Number(id),
            sender_id: senderId,
            sender_role: adminView ? "admin" : "user",
            message_text: trimmed,
          },
        ])
        .select("*");

      if (error) {
        console.error("Error sending message:", error);
        alert(error.message || "Failed to send message");
        // Revert text so user can retry
        setText(trimmed);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      if (data && data[0]) {
        console.log("[Chat] Insert confirmed from Supabase:", data[0]);
        const row = data[0];
        if (!seenMessageIdsRef.current.has(row.id)) {
          seenMessageIdsRef.current.add(row.id);
          // Replace optimistic message with server-confirmed message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                  id: row.id,
                  senderId: row.sender_id,
                  senderRole: row.sender_role,
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

  const downloadAttachment = (attachment) => {
    const link = document.createElement("a");
    link.href = attachment.data;
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

  if (error) {
    return (
      <div className="wrapper">
        <div
          className="card"
          style={{ textAlign: "center", color: "#d32f2f", padding: "40px" }}
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

  return (
    <div className="wrapper">
      <div className="card chat-card">
        <div className="chat-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} />
          </button>
          <div className="assignee">
            <div className="avatar">A</div>
            <div>
              <div className="assignee-name">{ticket.Department}</div>
              <div className="assignee-email">support@email.com</div>
            </div>
          </div>
        </div>

        <div className="ticket-details">
          <div className="details-row details-main-row">
            <div className="details-col ticket-no-col">
              <strong>Ticket No.</strong>
              <div className="ticket-no-value">No. {ticket.id}</div>
            </div>

            <div className="ticket-status-row inline-status">
              <strong>Status:</strong>
              <span className="status-pill">{ticket.status || ticket.Status || "Open"}</span>
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
                {expandedSummary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              <div className={`summary-full ${expandedSummary ? "open" : ""}`}>
                <div className="summary-full-content">{ticket.Description || "No details provided."}</div>
              </div>
            </button>

            {attachments.length > 0 && (
              <div className="attachments-compact inline-attachments">
                <h4 className="attachments-title">Attachments ({attachments.length})</h4>
                <div className="attachments-list">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="attachment-chip">
                      {isImageFile(attachment.name) ? (
                        <img
                          src={attachment.data}
                          alt={attachment.name}
                          className="attachment-thumb"
                          onClick={() => setSelectedImage(attachment)}
                          title="Click to view full size"
                        />
                      ) : (
                        <ImageIcon size={22} style={{ color: "#999" }} />
                      )}
                      <small className="attachment-name">{attachment.name}</small>
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
          {messages.map((m) => (
            // Messenger-like alignment: YOUR messages on the right, others on the left
            <div
              key={m.id}
              className={`msg ${viewerId && m.senderId === viewerId ? "msg-right" : "msg-left"
                }`}
            >
              <div className="bubble">{m.text}</div>
            </div>
          ))}
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
              src={selectedImage.data}
              alt={selectedImage.name}
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
              }}
            />
            <div style={{ marginTop: "15px", textAlign: "center" }}>
              <p style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
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
