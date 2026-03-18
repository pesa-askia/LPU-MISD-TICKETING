import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./ticketchat.css";
import { supabase } from "../../supabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { Send, ArrowLeft, Download, Image as ImageIcon, X } from "lucide-react";
import { realtimeSupabase } from "../../realtimeSupabaseClient";
import { useTicketsCache } from "../../context/TicketsCacheContext";

export default function TicketChat({ adminView = false } = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const { getTicket, setTicket: cacheTicket } = useTicketsCache();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedSummary, setExpandedSummary] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const scrollRef = useRef(null);
  const userIdRef = useRef(null);
  const seenMessageIdsRef = useRef(new Set());
  const [viewerId, setViewerId] = useState(null);
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
          <div className="details-row">
            <div className="details-col">
              <strong>Ticket No.</strong>
              <div>No. {ticket.id}</div>
            </div>
            <div
              className={`details-col summary ${expandedSummary ? "expanded" : ""}`}
              onClick={() => setExpandedSummary(!expandedSummary)}
              style={{ cursor: "pointer" }}
            >
              <strong>Summary</strong>
              <div>{ticket.Summary}</div>
            </div>
            <div
              className={`details-col description ${expandedDescription ? "expanded" : ""}`}
              onClick={() => setExpandedDescription(!expandedDescription)}
              style={{ cursor: "pointer" }}
            >
              <strong>Description</strong>
              <div>{ticket.Description}</div>
            </div>
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
          </div>
        </div>

        {(() => {
          const attachments = parseAttachments();
          if (attachments.length === 0) return null;

          return (
            <div
              style={{
                marginTop: "5px",
                paddingTop: "15px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px" }}>
                📎 Attachments ({attachments.length})
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                  gap: "10px",
                }}
              >
                {attachments.map((attachment, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "10px",
                      backgroundColor: "#f9f9f9",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                    }}
                  >
                    {isImageFile(attachment.name) ? (
                      <img
                        src={attachment.data}
                        alt={attachment.name}
                        style={{
                          maxWidth: "70px",
                          maxHeight: "70px",
                          objectFit: "cover",
                          marginBottom: "8px",
                          borderRadius: "3px",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedImage(attachment)}
                        title="Click to view full size"
                      />
                    ) : (
                      <ImageIcon
                        size={35}
                        style={{ marginBottom: "8px", color: "#999" }}
                      />
                    )}
                    <small
                      style={{
                        textAlign: "center",
                        fontSize: "10px",
                        wordBreak: "break-word",
                        marginBottom: "6px",
                      }}
                    >
                      {attachment.name}
                    </small>
                    <button
                      type="button"
                      onClick={() => downloadAttachment(attachment)}
                      style={{
                        padding: "3px 6px",
                        fontSize: "10px",
                        background: "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "2px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                    >
                      <Download size={10} />
                      Get
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="chat-messages" ref={scrollRef} aria-live="polite">
          {messages.map((m) => (
            // Messenger-like alignment: YOUR messages on the right, others on the left
            <div
              key={m.id}
              className={`msg ${
                viewerId && m.senderId === viewerId ? "msg-right" : "msg-left"
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
