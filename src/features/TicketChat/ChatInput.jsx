import React from "react";
import { Send } from "lucide-react";

export default function ChatInput({ text, onTextChange, onSend }) {
  return (
    <div className="p-3 bg-white border-t border-gray-100 shrink-0">
      <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-lpu-gold focus-within:ring-1 focus-within:ring-lpu-gold transition-all shadow-sm">
        <input
          className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-gray-400"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
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
