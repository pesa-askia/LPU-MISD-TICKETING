import { useLayoutEffect, useRef } from "react";
import { Send } from "lucide-react";

const MAX_HEIGHT = 160;

export default function ChatInput({ text, onTextChange, onSend }) {
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      const isTouchDevice =
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches;

      if (isTouchDevice) {
        return;
      }

      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-3 bg-white border-t border-gray-100 shrink-0">
      <div className="flex items-end gap-2 p-1 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-lpu-gold focus-within:ring-1 focus-within:ring-lpu-gold transition-all shadow-sm">
        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-gray-400 resize-none overflow-y-auto wrap-break-word leading-5"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="type your message here..."
        />
        <button
          className="p-2.5 bg-lpu-maroon text-white rounded-xl hover:bg-lpu-red active:scale-95 transition-all shadow-[4px_4px_10px_rgba(125,0,6,0.12)] shrink-0"
          onClick={onSend}
          aria-label="send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
