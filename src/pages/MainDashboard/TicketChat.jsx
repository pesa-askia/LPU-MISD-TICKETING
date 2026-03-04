import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ticketchat.css";
import { supabase } from "../../Supabaseclient";

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
  const [messages, setMessages] = useState(() => loadMessages(id));
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  // Fetch ticket from Supabase
  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from("Tickets")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.error("Error fetching ticket:", error);
          setError(error.message || "Failed to load ticket");
        } else {
          setTicket(data);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
    setMessages(loadMessages(id));
  }, [id]);

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

  if (error) {
    return (
      <div className="wrapper">
        <div className="card" style={{ textAlign: "center", color: "#d32f2f", padding: "40px" }}>
          <h2>Error Loading Ticket</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} style={{ marginTop: "20px", padding: "10px 20px", cursor: "pointer" }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (loading || !ticket) {
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
            &larr;
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
            <div className="details-col">
              <strong>Summary</strong>
              <div>{ticket.Summary}</div>
            </div>
            <div className="details-col">
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
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
