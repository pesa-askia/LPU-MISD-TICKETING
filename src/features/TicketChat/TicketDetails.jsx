import { FileText, ChevronDown, ChevronUp } from "lucide-react";

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

  return (
    <div className="bg-white border-b border-gray-100 shrink-0 overflow-hidden">
      {/* Main Header Row */}
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Left Side: Identity & Status */}
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-lpu-maroon text-sm">
            #{ticket.id}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              statusText.toLowerCase() === "open"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {statusText}
          </span>
          {adminView && (
            <button
              onClick={onCloseTicket}
              className="text-[10px] font-bold uppercase text-lpu-maroon hover:underline decoration-lpu-gold underline-offset-2 ml-1"
            >
              {isTicketClosed(ticket) ? "Reopen" : "Close"}
            </button>
          )}
        </div>

        {/* Right Side: Created Info + Summary Toggle */}
        <div className="flex items-center gap-4">
          <div className="text-right flex flex-col justify-center">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">
              Created
            </span>
            <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
              {formatDateTime(ticket.created_at)}
            </span>
          </div>

          <button
            onClick={onToggleSummary}
            className="bg-lpu-maroon text-white p-2.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 hover:bg-lpu-red transition-all shadow-sm active:scale-95 group shrink-0"
          >
            <FileText
              size={16}
              className="group-hover:rotate-12 transition-transform"
            />
            <span className="hidden sm:inline font-bold uppercase text-xs tracking-tight">
              Summary
            </span>
            {expandedSummary ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Toggleable Metadata Section */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-gray-50/50 ${
          expandedSummary ? "max-h-40 border-t border-gray-100" : "max-h-0"
        }`}
      >
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
              Type
            </span>
            <span className="text-sm text-gray-900 font-semibold">
              {ticket.Type || "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
              Department
            </span>
            <span className="text-sm text-gray-900 font-semibold">
              {ticket.Department || "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
              Category
            </span>
            <span className="text-sm text-gray-900 font-semibold">
              {ticket.Category || "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
              Site
            </span>
            <span className="text-sm text-gray-900 font-semibold">
              {ticket.Site || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
