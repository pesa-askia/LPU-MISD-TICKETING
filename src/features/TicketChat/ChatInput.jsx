import { Send } from "lucide-react";

export default function ChatInput({ text, onTextChange, onSend }) {
  return (
    <div className="chat-input">
      <input
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder="Start typing..."
      />
      <button className="send-btn" onClick={onSend} aria-label="send">
        <Send size={15} />
      </button>
    </div>
  );
}
