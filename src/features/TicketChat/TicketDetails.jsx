import { useEffect, useState } from "react";
import { Clock, FileText, ChevronDown, ChevronUp } from "lucide-react";

export default function TicketDetails({
  ticket,
  expandedSummary,
  onToggleSummary,
  expandedTimeline,
  onToggleTimeline,
  timelineHistory = [],
  onCloseTicket,
  isTicketClosed,
  formatDateTime,
}) {
  const statusText = ticket?.status || "Open";
  const [now, setNow] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, []);

  const calcRemaining = (dueAtValue) => {
    if (now === null) return "...";
    if (!dueAtValue) return "—";
    const dueMs = Date.parse(dueAtValue);
    if (Number.isNaN(dueMs)) return "—";
    const ms = dueMs - now;
    const abs = Math.abs(ms);
    const mins = Math.floor(abs / 60000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const text = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
    return ms < 0 ? `${text} overdue` : text;
  };

  const formatDurationSeconds = (seconds) => {
    if (typeof seconds !== "number") return "—";
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  // Active SLA = the open record in ticket_sla_history (no timer_stopped_at)
  const currentSnapshot = (() => {
    const active = Array.isArray(timelineHistory)
      ? timelineHistory.find((r) => !r.timer_stopped_at)
      : null;
    if (!active) return null;

    const dueAt = active.sla_due_at ?? null;
    const durationSeconds = active.timer_duration_seconds ?? null;
    return {
      key: "current-active",
      source: "current",
      priority: active.priority ?? null,
      timer_started_at: active.timer_started_at ?? null,
      sla_due_at: dueAt,
      remaining: calcRemaining(dueAt),
      sla_minutes: active.sla_minutes ?? null,
      timer_stopped_at: null,
      timer_duration_seconds: durationSeconds,
      duration: formatDurationSeconds(durationSeconds),
      sla_met: null,
      closed_at: null,
    };
  })();

  const historySnapshots = (
    Array.isArray(timelineHistory) ? timelineHistory : []
  )
    .filter((row) => !!row?.timer_stopped_at)
    .map((row, idx) => ({
      key: row?.id ? `hist-${row.id}` : `hist-${row?.closed_at || idx}`,
      source: "history",
      priority: row?.priority ?? null,
      timer_started_at: row?.timer_started_at ?? null,
      sla_due_at: row?.sla_due_at ?? null,
      remaining: "—",
      sla_minutes: row?.sla_minutes ?? null,
      timer_stopped_at: row?.timer_stopped_at ?? null,
      timer_duration_seconds: row?.timer_duration_seconds ?? null,
      duration: formatDurationSeconds(row?.timer_duration_seconds),
      sla_met: row?.sla_met ?? null,
      closed_at: row?.closed_at ?? null,
    }));

  const snapshots = [
    ...(currentSnapshot ? [currentSnapshot] : []),
    ...historySnapshots,
  ];

  return (
    <div className="bg-white dark:!bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shrink-0 overflow-hidden transition-colors duration-300">
      {/* Main Header Row */}
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Left Side: Identity & Status */}
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-lpu-maroon dark:text-lpu-gold text-sm">
            #{ticket.ticket_number || ticket.id}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${statusText.toLowerCase() === "open"
              ? "bg-green-100 text-green-700 dark:!bg-green-900/40 dark:text-green-400"
              : "bg-gray-100 text-gray-600 dark:!bg-zinc-800 dark:text-zinc-400"
              }`}
          >
            {statusText}
          </span>
          <button
            onClick={onCloseTicket}
            className="text-[10px] font-bold uppercase text-lpu-maroon dark:text-lpu-gold hover:underline decoration-lpu-gold dark:decoration-lpu-maroon underline-offset-2 ml-1"
          >
            {isTicketClosed(ticket) ? "Reopen" : "Close"}
          </button>
        </div>

        {/* Right Side: Created Info + Summary Toggle */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right hidden sm:flex flex-col justify-center">
            <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase leading-none mb-0.5">
              Created
            </span>
            <span className="text-xs text-gray-600 dark:text-zinc-300 font-medium whitespace-nowrap">
              {formatDateTime(ticket.created_at)}
            </span>
          </div>

          <button
            onClick={onToggleTimeline}
            className="bg-white dark:!bg-zinc-800 text-lpu-maroon dark:text-lpu-gold border border-lpu-maroon/30 dark:border-lpu-gold/30 p-2.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold dark:hover:bg-lpu-gold! dark:hover:text-lpu-maroon dark:hover:border-lpu-gold transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
          >
            <Clock size={16} />
            <span className="hidden sm:inline font-bold uppercase text-xs tracking-tight">
              Timeline
            </span>
            {expandedTimeline ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>

          <button
            onClick={onToggleSummary}
            className="bg-lpu-maroon dark:!bg-lpu-maroon text-white dark:text-white border border-lpu-maroon p-2.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold dark:hover:bg-lpu-gold! dark:hover:text-lpu-maroon dark:hover:border-lpu-gold transition-all shadow-lg shadow-lpu-maroon/20 dark:shadow-none active:scale-95 shrink-0 cursor-pointer"
          >
            <FileText size={16} />
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

      {/* Timeline Section */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-gray-50/50 dark:!bg-zinc-950/30 ${expandedTimeline ? "max-h-130 border-t border-gray-100 dark:border-zinc-800" : "max-h-0"
          }`}
      >
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-130">
          {snapshots.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-zinc-500 italic">No timeline yet.</div>
          ) : (
            snapshots.map((s, idx) => (
              <div
                key={s.key || idx}
                className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:!bg-zinc-800 shadow-sm transition-colors duration-300"
              >
                <div className="px-4 py-2.5 flex items-center justify-between gap-4 border-b border-gray-100 dark:border-zinc-800">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-600 dark:text-zinc-400">
                    {s.source === "history"
                      ? "Previous"
                      : s.closed_at
                        ? "Closed"
                        : "Active"}
                  </div>
                  <div className="text-[11px] font-bold text-gray-500 dark:text-zinc-500 whitespace-nowrap">
                    {s.closed_at ? formatDateTime(s.closed_at) : "—"}
                  </div>
                </div>

                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/50 dark:!bg-zinc-900/50 rounded-b-xl">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
                      Priority
                    </span>
                    <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
                      {s.priority || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
                      Timer started
                    </span>
                    <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
                      {s.timer_started_at
                        ? formatDateTime(s.timer_started_at)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
                      SLA due
                    </span>
                    <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
                      {s.sla_due_at ? formatDateTime(s.sla_due_at) : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
                      Remaining
                    </span>
                    <span className="text-sm font-extrabold text-gray-900 dark:text-zinc-100">
                      {s.remaining || "—"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
                      SLA minutes
                    </span>
                    <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
                      {s.sla_minutes ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
                      Timer stopped
                    </span>
                    <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
                      {s.timer_stopped_at
                        ? formatDateTime(s.timer_stopped_at)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
                      Duration
                    </span>
                    <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
                      {s.duration || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
                      SLA met
                    </span>
                    <span
                      className={`text-sm font-extrabold ${s.sla_met === true
                        ? "text-emerald-700 dark:text-emerald-500"
                        : s.sla_met === false
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-zinc-500"
                        }`}
                    >
                      {s.sla_met === true
                        ? "Yes"
                        : s.sla_met === false
                          ? "No"
                          : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-gray-50/50 dark:!bg-zinc-950/30 ${expandedSummary ? "max-h-40 border-t border-gray-100 dark:border-zinc-800" : "max-h-0"
          }`}
      >
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/50 dark:!bg-zinc-900/50">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
              Type
            </span>
            <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
              {ticket.Type || "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
              Department
            </span>
            <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
              {ticket.Department || "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
              Category
            </span>
            <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
              {ticket.Category || "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-lpu-maroon/60 dark:text-lpu-gold/60 uppercase tracking-widest">
              Site
            </span>
            <span className="text-sm text-gray-900 dark:text-zinc-100 font-semibold">
              {ticket.Site || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
