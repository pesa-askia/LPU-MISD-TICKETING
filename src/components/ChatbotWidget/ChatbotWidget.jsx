import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, Send, User, Bot, ArrowRight } from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import "./ChatbotWidget.css";

const GREETING = "Hi! I'm the MISD Support Bot. How can I help you today? I can assist with LMS, Microsoft 365, Student Portal, ERP, hardware, and software issues.";

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function ChatbotWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", content: GREETING, id: "greeting" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [shouldHandoff, setShouldHandoff] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || isTyping) return;

      const userMsg = { role: "user", content: text.trim(), id: Date.now().toString() };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsTyping(true);

      try {
        const token = localStorage.getItem("authToken");
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${getApiBaseUrl()}/api/chatbot/message`, {
          method: "POST",
          headers,
          body: JSON.stringify({ message: text.trim(), sessionId }),
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.error || "Bot unavailable");

        const botMsg = {
          role: "bot",
          content: data.reply,
          id: `bot_${Date.now()}`,
        };
        setMessages((prev) => [...prev, botMsg]);

        if (data.shouldHandoff) setShouldHandoff(true);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            content: "Sorry, I'm having trouble connecting. Please try again or submit a ticket directly.",
            id: `err_${Date.now()}`,
            isError: true,
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping, sessionId]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleHandoff = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${getApiBaseUrl()}/api/chatbot/handoff`, {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId }),
      });
    } catch (_) {
      // non-critical — still navigate
    }

    // Build transcript summary for pre-fill
    const userMessages = messages.filter((m) => m.role === "user");
    const summary = userMessages[0]?.content?.slice(0, 120) || "";
    const transcript = messages
      .filter((m) => m.id !== "greeting")
      .map((m) => `[${m.role === "user" ? "User" : "Bot"}]: ${m.content}`)
      .join("\n");

    setIsOpen(false);
    navigate("/SubmitTicket", {
      state: { chatPrefill: { summary, description: transcript } },
    });
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        className="chatbot-fab"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Toggle support chat"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <Bot size={18} />
              <span>MISD Support Bot</span>
            </div>
            <button
              className="chatbot-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chatbot-msg chatbot-msg--${msg.role}${msg.isError ? " chatbot-msg--error" : ""}`}
              >
                <div className="chatbot-msg-avatar">
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className="chatbot-msg-bubble">{msg.content}</div>
              </div>
            ))}

            {isTyping && (
              <div className="chatbot-msg chatbot-msg--bot">
                <div className="chatbot-msg-avatar">
                  <Bot size={14} />
                </div>
                <div className="chatbot-msg-bubble chatbot-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {shouldHandoff && !isTyping && (
              <div className="chatbot-handoff-banner">
                <p>Let me connect you with a support technician.</p>
                <button className="chatbot-handoff-btn" onClick={handleHandoff}>
                  Fill out a support ticket <ArrowRight size={14} />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input-row">
            <textarea
              ref={inputRef}
              className="chatbot-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              disabled={isTyping}
            />
            <button
              className="chatbot-send"
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isTyping}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>

          {/* Manual handoff link */}
          {!shouldHandoff && (
            <div className="chatbot-footer">
              <button className="chatbot-human-link" onClick={handleHandoff}>
                Talk to a human instead
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default ChatbotWidget;
