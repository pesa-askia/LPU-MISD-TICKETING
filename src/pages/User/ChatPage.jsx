import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useChatbotContext } from "../../context/useChatbotContext";
import { CHATBOT_SUGGESTIONS } from "../../hooks/useChatbot";
import ChatHeader from "../../features/TicketChat/ChatHeader";
import ChatInput from "../../features/TicketChat/ChatInput";

export default function ChatPage() {
  const navigate = useNavigate();

  const {
    messages,
    inputText,
    setInputText,
    isTyping,
    shouldHandoff,
    cooldownUntilMs,
    cooldownLabel,
    showSuggestions,
    messagesEndRef,
    sendMessage,
    handleHandoff,
  } = useChatbotContext();

  const lastBotId = useMemo(
    () => [...messages].reverse().find((m) => m.role === "bot")?.id ?? null,
    [messages],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesEndRef]);

  useEffect(() => {
    if (shouldHandoff) handleHandoff();
  }, [shouldHandoff, handleHandoff]);

  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!cooldownUntilMs) return;
    const initialTick = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initialTick);
      clearInterval(timer);
    };
  }, [cooldownUntilMs]);

  const isCoolingDown = cooldownUntilMs && now < cooldownUntilMs;

  return (
    <div className="flex flex-col w-full h-full max-h-full overflow-hidden bg-gray-50">
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-5xl mx-auto bg-white sm:my-2 sm:rounded-2xl border-t-[6px] border-t-lpu-maroon overflow-hidden shadow-md">
        <ChatHeader
          isBotTicket={true}
          onBack={() => navigate(-1)}
          onTalkToHuman={!shouldHandoff ? handleHandoff : undefined}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth no-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col">
              <div
                className={`flex w-full mb-4 animate-in fade-in slide-in-from-bottom-1 duration-300 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span
                      className={`text-[11px] font-black tracking-tight ${msg.role === "user" ? "text-lpu-maroon" : "text-gray-500"}`}
                    >
                      {msg.role === "user" ? "You" : "Stella"}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border shadow-[12px_12px_24px_rgba(0,0,0,0.18)] ${msg.role === "user"
                        ? "bg-lpu-maroon text-white border-lpu-maroon rounded-tr-none"
                        : msg.isError
                          ? "bg-red-50 border-red-400 text-red-700 rounded-tl-none"
                          : "bg-white text-gray-800 border-gray-100 rounded-tl-none"
                      }`}
                  >
                    <p className="whitespace-pre-wrap wrap-break-word">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>

              {msg.role === "bot" &&
                msg.id === lastBotId &&
                !isTyping &&
                msg.suggestions?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ml-2 mb-3">
                    {msg.suggestions.map((s) => (
                      <button
                        key={s}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-lpu-maroon/60 text-lpu-maroon hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold transition-colors leading-tight"
                        onClick={() => sendMessage(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ))}

          {showSuggestions && (
            <div className="flex flex-wrap gap-1.5 mt-0.5 ml-2 mb-3">
              {CHATBOT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="text-[11.5px] px-2.5 py-1 rounded-full border border-lpu-maroon text-lpu-maroon hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold transition-colors leading-tight"
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {isTyping && (
            <div className="flex w-full mb-4 justify-start">
              <div className="flex flex-col max-w-[85%] sm:max-w-[70%] items-start">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[11px] font-black tracking-tight text-gray-500">
                    Stella
                  </span>
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-white border border-gray-100 shadow-[12px_12px_24px_rgba(0,0,0,0.18)] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}

          {shouldHandoff && !isTyping && (
            <div className="bg-[#fffdf5] border border-lpu-gold rounded-xl p-3.5 px-4 text-sm text-amber-900 max-w-[75%] mb-4">
              <p className="mb-2.5">
                Let me connect you with a support technician.
              </p>
              <button
                className="inline-flex items-center gap-1.5 bg-lpu-maroon text-white rounded-lg p-2.5 px-4 text-xs font-semibold hover:bg-lpu-gold hover:text-lpu-maroon transition-colors"
                onClick={handleHandoff}
              >
                Fill out a support ticket <ArrowRight size={14} />
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          text={inputText}
          onTextChange={setInputText}
          onSend={() => sendMessage(inputText)}
          disabled={isTyping || isCoolingDown}
          placeholder={cooldownLabel || undefined}
        />
      </div>
    </div>
  );
}
