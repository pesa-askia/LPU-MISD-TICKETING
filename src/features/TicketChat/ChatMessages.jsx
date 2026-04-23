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

  return (
    <div className="chat-messages" ref={scrollRef} aria-live="polite">
      {messages.map((m) => {
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
                  {showName && timeLabel && (
                    <span className="message-sep">-</span>
                  )}
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
      })}
    </div>
  );
}
