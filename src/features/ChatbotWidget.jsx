import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, Send, User, Bot, ArrowRight } from "lucide-react";
import { getApiBaseUrl } from "../utils/apiBaseUrl";

const GREETING =
  "Hi! I'm the MISD Support Bot. How can I help you today? I can assist with LMS, Microsoft 365, Student Portal, ERP, hardware, and software issues.";

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

      const userMsg = {
        role: "user",
        content: text.trim(),
        id: Date.now().toString(),
      };
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
            content:
              "Sorry, I'm having trouble connecting. Please try again or submit a ticket directly.",
            id: `err_${Date.now()}`,
            isError: true,
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping, sessionId],
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
    } catch (_) {}

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
        className={`fixed z-1002 w-13 h-13 rounded-full bg-lpu-maroon text-white flex items-center justify-center shadow-lg transition-all hover:bg-lpu-red hover:scale-105 active:scale-95 
          ${isOpen ? "bottom-7 right-7" : "bottom-7 right-7 max-md:bottom-20.5 max-md:right-4"}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Toggle support chat"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed z-999 flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200
          bottom-22.5 right-7 w-85 max-h-130 
          max-md:bottom-37 max-md:right-4 max-md:left-4 max-md:w-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 px-4 bg-lpu-maroon text-white shrink-0">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Bot size={18} />
              <span>MISD Support Bot</span>
            </div>
            <button
              className="text-white opacity-80 hover:opacity-100 transition-opacity"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3.5 px-3 flex flex-col gap-2.5 bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 items-start max-w-[90%] ${msg.role === "user" ? "flex-row-reverse self-end" : ""}`}
              >
                <div
                  className={`shrink-0 w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] 
                  ${msg.role === "user" ? "bg-lpu-maroon text-white" : "bg-gray-200 text-gray-600"}`}
                >
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div
                  className={`p-2 px-3 rounded-xl text-[13.5px] leading-relaxed whitespace-pre-wrap wrap-break-word border 
                  ${
                    msg.role === "user"
                      ? "bg-lpu-maroon text-white border-transparent"
                      : msg.isError
                        ? "bg-red-50 border-red-400 text-red-700"
                        : "bg-white border-gray-100 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-2 items-start max-w-[90%]">
                <div className="shrink-0 w-6.5 h-6.5 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
                  <Bot size={14} />
                </div>
                <div className="flex items-center gap-1 p-2.5 px-3.5 bg-white border border-gray-100 rounded-xl">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}

            {/* Handoff Banner */}
            {shouldHandoff && !isTyping && (
              <div className="bg-[#fffdf5] border border-lpu-gold rounded-lg p-2.5 px-3 text-[13px] text-amber-900">
                <p className="mb-2">
                  Let me connect you with a support technician.
                </p>
                <button
                  className="inline-flex items-center gap-1.5 bg-lpu-maroon text-white rounded-md p-2 px-3.5 text-xs font-semibold hover:bg-lpu-red transition-colors"
                  onClick={handleHandoff}
                >
                  Fill out a support ticket <ArrowRight size={14} />
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex items-end gap-2 p-2.5 px-3 border-t border-gray-100 bg-white shrink-0">
            <textarea
              ref={inputRef}
              className="flex-1 resize-none border border-gray-300 rounded-lg p-2 text-[13.5px] leading-tight outline-none focus:border-lpu-maroon max-h-25 overflow-y-auto disabled:bg-gray-50"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              disabled={isTyping}
            />
            <button
              className="shrink-0 w-8.5 h-8.5 rounded-full bg-lpu-maroon text-white flex items-center justify-center transition-colors hover:bg-lpu-red disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isTyping}
            >
              <Send size={16} />
            </button>
          </div>

          {/* Manual handoff footer */}
          {!shouldHandoff && (
            <div className="p-1.5 pb-2.5 bg-white text-center shrink-0">
              <button
                className="text-gray-400 text-xs underline hover:text-lpu-maroon transition-colors"
                onClick={handleHandoff}
              >
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
