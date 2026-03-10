import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./ticketchat.css";
import { supabase } from "../../supabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { Send, ArrowLeft, Download, Image as ImageIcon, X } from "lucide-react";

function loadMessages(ticketId) {
  const key = `ticket_chat_${ticketId}`;
  const raw = localStorage.getItem(key);
  if (raw) return JSON.parse(raw);
  return [
    {
      id: Date.now() - 60000,
      sender: "assignee",
      text: "Hello, we received your ticket.",
      time: new Date().toISOString(),
    },
    {
      id: Date.now() - 30000,
      sender: "user",
      text: "Thanks, any update?",
      time: new Date().toISOString(),
    },
  ];
}

function saveMessages(ticketId, msgs) {
  localStorage.setItem(`ticket_chat_${ticketId}`, JSON.stringify(msgs));
}

export default function TicketChat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const [messages, setMessages] = useState(() => loadMessages(id));
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedSummary, setExpandedSummary] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const scrollRef = useRef(null);
  // Fetch ticket from Supabase
  useEffect(() => {
    const fetchTicket = async () => {
      try {
        showLoading();
        setError(null);

        // Get user ID from JWT token
        const token = localStorage.getItem("authToken");
        if (!token) {
          setError("You must be logged in to view tickets.");
          hideLoading();
          return;
        }

        const decoded = jwtDecode(token);
        const userId = decoded.id;

        // Fetch ticket and verify ownership
        const { data, error } = await supabase
          .from("Tickets")
          .select("*")
          .eq("id", id)
          .eq("created_by", userId)
          .single();

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
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred");
      } finally {
        hideLoading();
      }
    };

    fetchTicket();
    setMessages(loadMessages(id));
  }, [id, showLoading, hideLoading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    if (!text.trim()) return;
    const m = {
      id: Date.now(),
      sender: "user",
      text: text.trim(),
      time: new Date().toISOString(),
    };
    const next = [...messages, m];
    setMessages(next);
    saveMessages(id, next);
    setText("");
    setTimeout(() => {
      const reply = {
        id: Date.now() + 1,
        sender: "assignee",
        text: "Thanks for the message — we'll check it.",
        time: new Date().toISOString(),
      };
      const updated = [...next, reply];
      setMessages(updated);
      saveMessages(id, updated);
    }, 800);
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
            <div
              key={m.id}
              className={`msg ${m.sender === "user" ? "msg-right" : "msg-left"}`}
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
