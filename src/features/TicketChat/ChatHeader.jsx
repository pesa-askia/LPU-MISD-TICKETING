import { ArrowLeft, Bot } from "lucide-react";

export default function ChatHeader({
  adminView,
  creatorName,
  creatorEmail,
  headerInitial,
  adminParticipants,
  isBotTicket,
  onBack,
}) {
  const participants = Array.isArray(adminParticipants)
    ? adminParticipants
    : [];
  const hasAdmins = participants.length > 0;

  return (
    <div className="chat-header">
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={15} />
      </button>
      {adminView ? (
        <div className="assignee">
          <div className="avatar">{headerInitial || "S"}</div>
          <div>
            <div className="assignee-name">{creatorName}</div>
            <div className="assignee-email">
              {creatorEmail || "Email unavailable"}
            </div>
          </div>
        </div>
      ) : (
        <div className="assignee-group">
          {isBotTicket && (
            <div className="assignee">
              <div className="avatar avatar-bot">
                <Bot size={18} />
              </div>
              <div>
                <div className="assignee-name">MISD Support Bot</div>
                <div className="assignee-email">Automated assistant</div>
              </div>
            </div>
          )}
          {hasAdmins ? (
            participants.map((participant) => {
              const initial = (participant.name || participant.email || "A")
                .trim()
                .charAt(0)
                .toUpperCase();

              return (
                <div key={participant.id} className="assignee">
                  <div className="avatar">{initial || "A"}</div>
                  <div>
                    <div className="assignee-name">{participant.name}</div>
                    {participant.email && (
                      <div className="assignee-email">{participant.email}</div>
                    )}
                  </div>
                </div>
              );
            })
          ) : !isBotTicket ? (
            <div
              className="assignee assignee-skeleton"
              aria-label="Awaiting admin reply"
            >
              <div className="avatar skeleton-circle" />
              <div className="skeleton-lines">
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
