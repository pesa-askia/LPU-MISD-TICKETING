import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, User, Send, ArrowRight, ArrowLeft } from "lucide-react";
import { useChatbotContext } from "../../context/ChatbotContext";
import { CHATBOT_SUGGESTIONS } from "../../hooks/useChatbot";

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
    inputRef,
    sendMessage,
    handleKeyDown,
    handleHandoff,
  } = useChatbotContext();

  const lastBotId = useMemo(
    () => [...messages].reverse().find((m) => m.role === "bot")?.id ?? null,
    [messages],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages, messagesEndRef, inputRef]);

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-lpu-maroon text-white shrink-0 shadow-md">
        <button
          className="text-white opacity-80 hover:opacity-100 transition-opacity p-1 rounded"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 font-semibold">
          <Bot size={20} />
          <span>MISD Support Bot</span>
        </div>
        <span className="ml-auto text-xs opacity-60 font-normal hidden sm:block">
          Powered by AI — for urgent issues, submit a ticket
        </span>
      </div>
      {/* Messages */}
      <div className="flex-1 px-4 py-5 flex flex-col gap-3 max-w-3xl w-full mx-auto">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-2">
            <div
              className={`flex gap-2.5 items-start max-w-[75%] ${msg.role === "user" ? "flex-row-reverse self-end" : ""}`}
            >
              <div
                className={`shrink-0 w-7.5 h-7.5 rounded-full flex items-center justify-center
                ${msg.role === "user" ? "bg-lpu-maroon text-white" : "bg-gray-200 text-gray-600"}`}
              >
                {msg.role === "user" ? <User size={15} /> : <Bot size={15} />}
              </div>
              <div
                className={`p-2.5 px-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap wrap-break-word border
                ${
                  msg.role === "user"
                    ? "bg-lpu-maroon text-white border-transparent rounded-tr-sm"
                    : msg.isError
                      ? "bg-red-50 border-red-400 text-red-700 rounded-tl-sm"
                      : "bg-white border-gray-100 text-gray-800 shadow-sm rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
            {/* Dynamic suggestions — only on latest bot message, not while typing */}
            {msg.role === "bot" &&
              msg.id === lastBotId &&
              !isTyping &&
              msg.suggestions?.length > 0 && (
                <div className="flex flex-wrap gap-2 ml-10">
                  {msg.suggestions.map((s) => (
                    <button
                      key={s}
                      className="text-xs px-3 py-1.5 rounded-full border border-lpu-maroon/60 text-lpu-maroon hover:bg-lpu-maroon hover:text-white hover:border-lpu-maroon transition-colors"
                      onClick={() => sendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
          </div>
        ))}

        {/* Suggestion Chips */}
        {showSuggestions && (
          <div className="flex flex-wrap gap-2 mt-1 ml-10">
            {CHATBOT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="text-xs px-3 py-1.5 rounded-full border border-lpu-maroon text-lpu-maroon hover:bg-lpu-maroon hover:text-white transition-colors"
                onClick={() => sendMessage(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-2.5 items-start max-w-[75%]">
            <div className="shrink-0 w-7.5 h-7.5 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
              <Bot size={15} />
            </div>
            <div className="flex items-center gap-1 p-3 px-4 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}

        {/* Handoff Banner */}
        {shouldHandoff && !isTyping && (
          <div className="bg-[#fffdf5] border border-lpu-gold rounded-xl p-3.5 px-4 text-sm text-amber-900 max-w-[75%]">
            <p className="mb-2.5">
              Let me connect you with a support technician.
            </p>
            <button
              className="inline-flex items-center gap-1.5 bg-lpu-maroon text-white rounded-lg p-2.5 px-4 text-xs font-semibold hover:bg-lpu-red transition-colors"
              onClick={handleHandoff}
            >
              Fill out a support ticket <ArrowRight size={14} />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      {/* Input + Footer */}
      <div className="sticky bottom-0 shrink-0 border-t border-gray-200 bg-white shadow-[0_-1px_6px_rgba(0,0,0,0.05)] z-10">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-end gap-3 p-3 px-4">
            <textarea
              ref={inputRef}
              className="flex-1 resize-none border border-gray-300 rounded-xl p-2.5 px-3.5 text-sm leading-snug outline-none focus:border-lpu-maroon max-h-32 overflow-y-auto disabled:bg-gray-50 transition-colors"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={cooldownLabel || "Type a message..."}
              rows={1}
              disabled={
                isTyping || (cooldownUntilMs && Date.now() < cooldownUntilMs)
              }
            />
            <button
              className="shrink-0 w-10 h-10 rounded-full bg-lpu-maroon text-white flex items-center justify-center transition-colors hover:bg-lpu-red disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => sendMessage(inputText)}
              disabled={
                !inputText.trim() ||
                isTyping ||
                (cooldownUntilMs && Date.now() < cooldownUntilMs)
              }
            >
              <Send size={17} />
            </button>
          </div>

          {!shouldHandoff && (
            <div className="pb-3 text-center">
              <button
                className="text-gray-400 text-xs underline hover:text-lpu-maroon transition-colors"
                onClick={handleHandoff}
              >
                Talk to a human instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
