import { ChevronDown, ChevronUp } from "lucide-react";

export default function TicketDetails({
  ticket,
  adminView,
  expandedSummary,
  onToggleSummary,
  onCloseTicket,
  isTicketClosed,
  formatDateTime,
}) {
  const statusText = ticket?.status || ticket?.Status || "Open";
  const summaryText = ticket?.Summary || "-";

  return (
    <div className="ticket-details">
      <div className="details-row details-main-row">
        <div className="details-col ticket-no-col">
          <strong>Ticket No.</strong>
          <div className="ticket-no-value">No. {ticket.id}</div>
        </div>

        <div className="ticket-status-row inline-status">
          <strong>Status:</strong>
          <span className="status-pill">{statusText}</span>
          {adminView && (
            <button
              type="button"
              onClick={onCloseTicket}
              className="close-ticket-btn"
            >
              {isTicketClosed(ticket) ? "Reopen Ticket" : "Close Ticket"}
            </button>
          )}
        </div>

        <button
          type="button"
          className={`details-col summary summary-toggle ${expandedSummary ? "expanded" : ""}`}
          onClick={onToggleSummary}
          aria-expanded={expandedSummary}
        >
          <strong>Summary</strong>
          <div className="summary-preview">{summaryText}</div>
          <div className="summary-indicator">
            {expandedSummary ? "Hide details" : "View details"}
            {expandedSummary ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </div>
        </button>
      </div>
      <div className={`details-extra ${expandedSummary ? "open" : ""}`}>
        <div className="details-row details-grid-row">
          <div className="details-col">
            <strong>Department</strong>
            <div>{ticket.Department}</div>
          </div>
          <div className="details-col">
            <strong>Type</strong>
            <div>{ticket.Type}</div>
          </div>
          <div className="details-col">
            <strong>Category</strong>
            <div>{ticket.Category}</div>
          </div>
          <div className="details-col">
            <strong>Site</strong>
            <div>{ticket.Site}</div>
          </div>
          <div className="details-col">
            <strong>Created At</strong>
            <div>{formatDateTime(ticket.created_at)}</div>
          </div>
          <div className="details-col">
            <strong>Closed At</strong>
            <div>{formatDateTime(ticket.closed_at)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
