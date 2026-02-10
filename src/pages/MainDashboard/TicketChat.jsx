import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PLACEHOLDER } from "./Tickets";
import "./ticketchat.css";

function loadMessages(ticketId) {
    const key = `ticket_chat_${ticketId}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    // default conversation
    return [
        { id: Date.now() - 60000, sender: "assignee", text: "Hello, we received your ticket.", time: new Date().toISOString() },
        { id: Date.now() - 30000, sender: "user", text: "Thanks, any update?", time: new Date().toISOString() },
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
    const scrollRef = useRef(null);

    useEffect(() => {
        setMessages(loadMessages(id));
    }, [id]);

    const ticket = PLACEHOLDER.find((p) => p.id === id) || { id, category: "-", date: "-", status: "Open" };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    function handleSend() {
        if (!text.trim()) return;
        const m = { id: Date.now(), sender: "user", text: text.trim(), time: new Date().toISOString() };
        const next = [...messages, m];
        setMessages(next);
        saveMessages(id, next);
        setText("");
        // simulate reply
        setTimeout(() => {
            const reply = { id: Date.now() + 1, sender: "assignee", text: "Thanks for the message — we'll check it.", time: new Date().toISOString() };
            const updated = [...next, reply];
            setMessages(updated);
            saveMessages(id, updated);
        }, 800);
    }

    return (
        <div className="wrapper">
            <div className="card chat-card">
                <div className="chat-header">
                    <button className="back-btn" onClick={() => navigate(-1)}>&larr;</button>
                    <div className="assignee">
                        <div className="avatar">A</div>
                        <div>
                            <div className="assignee-name">Assignee</div>
                            <div className="assignee-email">assignee@email.com</div>
                        </div>
                    </div>
                </div>

                <div className="ticket-details">
                    <div className="details-row">
                        <div className="details-col"><strong>Ticket No.</strong><div>No. {ticket.id}</div></div>
                        <div className="details-col"><strong>Category</strong><div>{ticket.category}</div></div>
                        <div className="details-col"><strong>Date</strong><div>{ticket.date}</div></div>
                        <div className="details-col"><strong>Status</strong><div>{ticket.status}</div></div>
                    </div>
                </div>

                <div className="chat-messages" ref={scrollRef} aria-live="polite">
                    {messages.map((m) => (
                        <div key={m.id} className={`msg ${m.sender === "user" ? "msg-right" : "msg-left"}`}>
                            <div className="bubble">{m.text}</div>
                        </div>
                    ))}
                </div>

                <div className="chat-input">
                    <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Start typing..." />
                    <button className="send-btn" onClick={handleSend} aria-label="send">&gt;</button>
                </div>
            </div>
        </div>
    );
}
