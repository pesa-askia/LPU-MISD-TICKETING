function parseChatbotTranscript(text) {
  if (
    !text ||
    (!text.startsWith("[You]\n") && !text.startsWith("[MISD Support Bot]\n"))
  )
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
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  };

  const getMessageAttachments = (message) =>
    Array.isArray(message.attachments) ? message.attachments : [];

  const renderNormalMessage = (m) => {
    const isOwn = viewerId && m.senderId === viewerId;
    const isAdminMessage = adminView && m.senderRole === "admin";
    const alignRight = adminView ? isAdminMessage : isOwn;
    const isOtherAdmin = adminView && isAdminMessage && !isOwn;
    const hasIdentity = Boolean(m.senderName || m.senderEmail);
    const displayName = isOwn
      ? "You"
      : hasIdentity
        ? getDisplayName(m.senderName, m.senderEmail, m.senderRole)
        : "";
    const timeLabel = formatTimeAgo(m.time);
    const showName = isOwn || hasIdentity;
    const showMeta = showName || Boolean(timeLabel);
    const attachments = getMessageAttachments(m);
    const hasAttachments = attachments.length > 0;

    return (
      <div
        key={m.id}
        className={`msg ${alignRight ? "msg-right" : "msg-left"} ${isOtherAdmin ? "msg-other-admin" : ""}`}
      >
        <div className="msg-content">
          {showMeta && (
            <div className="message-meta">
              {showName && (
                <span className="message-name">{displayName}</span>
              )}
              {showName && timeLabel && <span className="message-sep">-</span>}
              {timeLabel && (
                <span className="message-time">{timeLabel}</span>
              )}
            </div>
          )}
          <div className="bubble">{m.text}</div>
          {hasAttachments && (
            <div className="message-attachments">
              {attachments.map((attachment, index) => {
                const name = attachment?.name || "Attachment";
                const src = getAttachmentSrc(attachment);
                const isImage = isImageFile(name);

                if (isImage && src) {
                  return (
                    <button
                      key={`${m.id}-attachment-${index}`}
                      type="button"
                      className="message-attachment-thumb"
                      onClick={() => onOpenAttachment(attachment)}
                      title="Click to view full size"
                    >
                      <img src={src} alt={name} />
                    </button>
                  );
                }

                return (
                  <div
                    key={`${m.id}-attachment-${index}`}
                    className="message-attachment-file"
                  >
                    <span className="message-attachment-name">{name}</span>
                    <button
                      type="button"
                      className="message-attachment-action"
                      onClick={() => onDownloadAttachment(attachment)}
                    >
                      Get
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderedMessages = messages.flatMap((m) => {
    const parsedTranscript = parseChatbotTranscript(m.text);
    if (!parsedTranscript) return [renderNormalMessage(m)];

    const timeLabel = formatTimeAgo(m.time);
    return parsedTranscript.map((entry, idx) => {
      // Admin sees: student on left, bot on right. User sees: self on right, bot on left.
      const alignRight = adminView
        ? entry.role === "bot"
        : entry.role === "user";
      const displayName =
        entry.role === "user"
          ? adminView
            ? (transcriptCreatorName || "Student")
            : "You"
          : "MISD Support Bot";
      // Only show time on last entry to avoid clutter
      const isLast = idx === parsedTranscript.length - 1;
      return (
        <div
          key={`${m.id}-t-${idx}`}
          className={`msg ${alignRight ? "msg-right" : "msg-left"}`}
        >
          <div className="msg-content">
            <div className="message-meta">
              <span className="message-name">{displayName}</span>
              {isLast && timeLabel && (
                <>
                  <span className="message-sep">-</span>
                  <span className="message-time">{timeLabel}</span>
                </>
              )}
            </div>
            <div className="bubble">{entry.content}</div>
          </div>
        </div>
      );
    });
  });

  return (
    <div className="chat-messages" ref={scrollRef} aria-live="polite">
      {renderedMessages}
    </div>
  );
}
