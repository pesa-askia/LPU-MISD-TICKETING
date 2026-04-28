import React from "react";

/**
 * parses chatbot transcripts to display multi-turn conversations.
 */
function parseChatbotTranscript(text) {
  if (!text) return null;
  if (!text.includes("[You]") && !text.includes("[MISD Support Bot]"))
    return null;

  const lines = text.split("\n");
  let i = 0;
  const entries = [];
  while (i < lines.length) {
    const line = lines[i].trim();
    let role = null;
    if (line === "[You]") role = "user";
    else if (line === "[MISD Support Bot]") role = "bot";

    if (role) {
      i++;
      const contentLines = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "[You]" &&
        lines[i].trim() !== "[MISD Support Bot]"
      ) {
        contentLines.push(lines[i]);
        i++;
      }
      const content = contentLines.join("\n").trim();
      if (content) entries.push({ role, content });
    } else {
      i++;
    }
  }
  return entries.length > 0 ? entries : null;
}

export default function ChatMessages({
  messages,
  viewerId,
  adminView,
  getDisplayName,
  scrollRef,
  nowMs,
  getAttachmentSrc,
  isImageFile,
  onOpenAttachment,
  onDownloadAttachment,
  transcriptCreatorName,
}) {
  const formatTimeAgo = (value) => {
    if (!value) return "";
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return "";
    const diffMs = Math.max(0, nowMs - timestamp);
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(value).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  const renderBubble = (
    m,
    content,
    role,
    alignRight,
    isTranscript = false,
    itemKey,
  ) => {
    const isBot = role === "bot" || m.senderRole === "bot";
    const isAdmin = role === "admin" || m.senderRole === "admin";

    /**
     * identity logic:
     * 1. 'isOwn' (maroon) is ONLY the current human viewer.
     * 2. on admin side, transcripts are never 'own' (bot is red, student is white).
     */
    const isOwn = isTranscript
      ? !adminView && role === "user"
      : m.senderId === viewerId;

    const isOtherAdmin = adminView && isAdmin && !isOwn;

    // branding color logic
    let bubbleClass = "bg-white text-gray-800 border-gray-100";
    let labelColor = "text-gray-500";

    if (isOwn) {
      labelColor = "text-lpu-maroon";
      bubbleClass = "bg-lpu-maroon text-white border-lpu-maroon";
    } else if (adminView && (isBot || isOtherAdmin)) {
      // admin side: bot and colleagues are lpu-red
      labelColor = "text-lpu-red";
      bubbleClass = "bg-lpu-red text-white border-lpu-red";
    } else {
      // user side: bot/admins are standard white/gray (same as everyone else)
      labelColor = "text-gray-500";
      bubbleClass = "bg-white text-gray-800 border-gray-100";
    }

    const displayName = isTranscript
      ? role === "user"
        ? adminView
          ? transcriptCreatorName || "Student"
          : "You"
        : "Stella"
      : isOwn
        ? "You"
        : getDisplayName(m.senderName, m.senderEmail, m.senderRole, m.senderId);

    return (
      <div
        key={itemKey}
        className={`flex w-full mb-6 animate-in fade-in slide-in-from-bottom-1 duration-300 ${alignRight ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${alignRight ? "items-end" : "items-start"}`}
        >
          <div className="flex items-center gap-2 mb-1 px-1">
            <span
              className={`text-[11px] font-black tracking-tight ${labelColor}`}
            >
              {displayName}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              {formatTimeAgo(m.time)}
            </span>
          </div>

          {/* high-intensity bottom-right shadow on both sides */}
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border shadow-[12px_12px_24px_rgba(0,0,0,0.18)] ${bubbleClass} ${alignRight ? "rounded-tr-none" : "rounded-tl-none"}`}
          >
            <p className="whitespace-pre-wrap break-words">{content}</p>
          </div>

          {!isTranscript && m.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {m.attachments.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => onOpenAttachment(file)}
                  className="h-20 w-32 rounded-lg overflow-hidden border border-gray-200 shadow-[8px_8px_16px_rgba(0,0,0,0.12)] hover:border-lpu-maroon transition-all"
                >
                  <img
                    src={getAttachmentSrc(file)}
                    className="h-full w-full object-cover"
                    alt="attachment"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderedMessages = messages.flatMap((m, messageIndex) => {
    const transcript = parseChatbotTranscript(m.text);
    if (!transcript) {
      const isOwn = m.senderId === viewerId;
      const isAdmin = m.senderRole === "admin";
      const alignRight = adminView ? isOwn || isAdmin : isOwn;
      const itemKey = m.id || `message-${messageIndex}`;
      return [
        renderBubble(m, m.text, m.senderRole, alignRight, false, itemKey),
      ];
    }

    return transcript.map((entry, entryIndex) => {
      const alignRight = adminView
        ? entry.role === "bot"
        : entry.role === "user";
      const itemKey = `transcript-${m.id || messageIndex}-${entryIndex}`;
      return renderBubble(
        m,
        entry.content,
        entry.role,
        alignRight,
        true,
        itemKey,
      );
    });
  });

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-6 space-y-2 scroll-smooth no-scrollbar"
      ref={scrollRef}
    >
      {renderedMessages}
    </div>
  );
}
