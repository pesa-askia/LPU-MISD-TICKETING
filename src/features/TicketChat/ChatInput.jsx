import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Send, Paperclip, X, FileText } from "lucide-react";

const MAX_HEIGHT = 160;
const MAX_FILES = 5;

const isImageName = (name) => /\.(jpe?g|png|gif|webp|svg)$/i.test(name);
const getPreviewKey = (file) => `${file.name}:${file.size}:${file.lastModified}`;

export default function ChatInput({
  text,
  onTextChange,
  onSend,
  disabled = false,
  placeholder,
  pendingAttachments = [],
  onAddAttachments,
  onRemoveAttachment,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewCache = useRef({});
  const [attachmentPreviews, setAttachmentPreviews] = useState({});

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
      if (isTouchDevice) return;
      e.preventDefault();
      onSend();
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length && onAddAttachments) onAddAttachments(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    const nextPreviews = {};

    pendingAttachments.forEach((file) => {
      if (!isImageName(file.name)) return;
      const key = getPreviewKey(file);
      if (!previewCache.current[key]) {
        previewCache.current[key] = URL.createObjectURL(file);
      }
      nextPreviews[key] = previewCache.current[key];
    });

    Object.entries(previewCache.current).forEach(([key, url]) => {
      if (!nextPreviews[key]) {
        URL.revokeObjectURL(url);
        delete previewCache.current[key];
      }
    });

    const updatePreviews = setTimeout(() => {
      setAttachmentPreviews(nextPreviews);
    }, 0);

    return () => clearTimeout(updatePreviews);
  }, [pendingAttachments]);

  useEffect(() => {
    const cache = previewCache.current;
    return () => {
      Object.values(cache).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const canAddMore = pendingAttachments.length < MAX_FILES;

  return (
    <div className="px-4 py-3 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 shrink-0 transition-colors duration-300">
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pendingAttachments.map((file, idx) => {
            const preview = attachmentPreviews[getPreviewKey(file)];
            return preview ? (
              <div key={idx} className="relative group w-14 h-14">
                <div className="w-full h-full rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
                  <img src={preview} alt={file.name} className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(idx)}
                  aria-label="remove"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 dark:bg-zinc-800 hover:bg-gray-900 dark:hover:bg-zinc-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <X size={9} />
                </button>
              </div>
            ) : (
              <div
                key={idx}
                className="flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-gray-600 dark:text-zinc-400"
              >
                <FileText size={12} className="text-gray-400 dark:text-zinc-500 shrink-0" />
                <span className="max-w-28 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(idx)}
                  aria-label="remove"
                  className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-700 focus-within:border-lpu-gold focus-within:ring-1 focus-within:ring-lpu-gold transition-all"
      >
        <button
          type="button"
          onClick={() => canAddMore && fileInputRef.current?.click()}
          disabled={disabled || !canAddMore}
          aria-label="attach file"
          className="flex items-center justify-center w-8 h-8 rounded-xl text-gray-400 dark:text-zinc-500 hover:text-lpu-maroon dark:hover:text-lpu-gold hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all shrink-0 disabled:opacity-30"
        >
          <Paperclip size={18} strokeWidth={1.75} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />

        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 min-w-0 bg-transparent py-1.5 text-sm focus:outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500 text-gray-800 dark:text-zinc-100 resize-none overflow-y-auto wrap-break-word leading-5"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "type your message here..."}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={onSend}
          disabled={disabled}
          aria-label="send message"
          className="flex items-center justify-center w-8 h-8 bg-lpu-maroon text-white rounded-xl hover:bg-lpu-gold hover:text-lpu-maroon dark:hover:bg-lpu-gold dark:hover:text-lpu-maroon active:scale-95 transition-all shrink-0 disabled:opacity-40 shadow-sm cursor-pointer"
        >
          <Send size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
