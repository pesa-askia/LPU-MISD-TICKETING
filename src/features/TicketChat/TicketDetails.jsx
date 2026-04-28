import { Clock, FileText, ChevronDown, ChevronUp } from "lucide-react";

export default function TicketDetails({
  ticket,
  adminView,
  expandedSummary,
  onToggleSummary,
  expandedTimeline,
  onToggleTimeline,
  timelineHistory = [],
  onCloseTicket,
  isTicketClosed,
  formatDateTime,
}) {
  const statusText = ticket?.status || ticket?.Status || "Open";
  const calcRemaining = (dueAtValue) => {
    if (!dueAtValue) return "—";
    const dueMs = Date.parse(dueAtValue);
    if (Number.isNaN(dueMs)) return "—";
    const ms = dueMs - Date.now();
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

  const currentSnapshot = (() => {
    const priority = ticket?.Priority || ticket?.priority || null;
    const startedAt =
      ticket?.timer_started_at || ticket?.timerStartedAt || ticket?.started_at;
    const dueAt = ticket?.sla_due_at || ticket?.slaDueAt || ticket?.due_at;
    const stoppedAt =
      ticket?.timer_stopped_at || ticket?.timerStoppedAt || ticket?.stopped_at;
    const slaMinutes = ticket?.sla_minutes ?? ticket?.slaMinutes ?? null;
    const durationSeconds =
      ticket?.timer_duration_seconds ?? ticket?.timerDurationSeconds ?? null;
    const slaMet =
      ticket?.sla_met !== undefined
        ? ticket.sla_met
        : ticket?.slaMet !== undefined
          ? ticket.slaMet
          : null;
    const closedAt = ticket?.closed_at || ticket?.closedAt || null;

    const hasAny =
      !!priority ||
      !!startedAt ||
      !!dueAt ||
      !!stoppedAt ||
      slaMinutes !== null ||
      durationSeconds !== null ||
      slaMet !== null;
    if (!hasAny) return null;

    return {
      key: closedAt ? `current-closed-${closedAt}` : "current-active",
      source: "current",
      priority,
      timer_started_at: startedAt,
      sla_due_at: dueAt,
      remaining: calcRemaining(dueAt),
      sla_minutes: slaMinutes,
      timer_stopped_at: stoppedAt,
      timer_duration_seconds: durationSeconds,
      duration: formatDurationSeconds(durationSeconds),
      sla_met: slaMet,
      closed_at: closedAt,
    };
  })();

  const historySnapshots = (
    Array.isArray(timelineHistory) ? timelineHistory : []
  )
    .map((row) => ({
      key: row?.id
        ? `hist-${row.id}`
        : `hist-${row?.closed_at || Math.random()}`,
      source: "history",
      priority: row?.priority ?? row?.Priority ?? null,
      timer_started_at: row?.timer_started_at ?? row?.started_at ?? null,
      sla_due_at: row?.sla_due_at ?? row?.due_at ?? null,
      remaining: "—",
      sla_minutes: row?.sla_minutes ?? null,
      timer_stopped_at: row?.timer_stopped_at ?? row?.stopped_at ?? null,
      timer_duration_seconds: row?.timer_duration_seconds ?? null,
      duration: formatDurationSeconds(row?.timer_duration_seconds),
      sla_met: row?.sla_met ?? null,
      closed_at: row?.closed_at ?? null,
    }))
    .filter(
      (s) => s.closed_at || s.timer_stopped_at || s.timer_duration_seconds,
    );

  const snapshots = (() => {
    const closedAt = ticket?.closed_at || ticket?.closedAt || null;
    const topHistoryClosedAt = historySnapshots[0]?.closed_at || null;
    const shouldOmitCurrentBecauseDup =
      closedAt &&
      topHistoryClosedAt &&
      String(closedAt) === String(topHistoryClosedAt);

    const list = [];
    if (currentSnapshot && !shouldOmitCurrentBecauseDup)
      list.push(currentSnapshot);
    list.push(...historySnapshots);
    return list;
  })();

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
          <button
            onClick={onCloseTicket}
            className="text-[10px] font-bold uppercase text-lpu-maroon hover:underline decoration-lpu-gold underline-offset-2 ml-1"
          >
            {isTicketClosed(ticket) ? "Reopen" : "Close"}
          </button>
        </div>

        {/* Right Side: Created Info + Summary Toggle */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right flex flex-col justify-center hidden sm:flex">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">
              Created
            </span>
            <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
              {formatDateTime(ticket.created_at)}
            </span>
          </div>

          <button
            onClick={onToggleTimeline}
            className="bg-white text-lpu-maroon border border-lpu-maroon/30 p-2.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 hover:bg-lpu-maroon hover:text-white hover:border-lpu-maroon transition-all shadow-sm active:scale-95 group shrink-0"
          >
            <Clock
              size={16}
              className="group-hover:rotate-12 transition-transform"
            />
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

      {/* Timeline Section */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-gray-50/50 ${
          expandedTimeline ? "max-h-130 border-t border-gray-100" : "max-h-0"
        }`}
      >
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-130">
          {snapshots.length === 0 ? (
            <div className="text-sm text-gray-500 italic">No timeline yet.</div>
          ) : (
            snapshots.map((s, idx) => (
              <div
                key={s.key || idx}
                className="rounded-xl border border-gray-200 bg-white"
              >
                <div className="px-4 py-2.5 flex items-center justify-between gap-4 border-b border-gray-100">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-600">
                    {s.source === "history"
                      ? "Previous"
                      : s.closed_at
                        ? "Closed"
                        : "Active"}
                  </div>
                  <div className="text-[11px] font-bold text-gray-500 whitespace-nowrap">
                    {s.closed_at ? formatDateTime(s.closed_at) : "—"}
                  </div>
                </div>

                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
                      Priority
                    </span>
                    <span className="text-sm text-gray-900 font-semibold">
                      {s.priority || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
                      Timer started
                    </span>
                    <span className="text-sm text-gray-900 font-semibold">
                      {s.timer_started_at
                        ? formatDateTime(s.timer_started_at)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
                      SLA due
                    </span>
                    <span className="text-sm text-gray-900 font-semibold">
                      {s.sla_due_at ? formatDateTime(s.sla_due_at) : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
                      Remaining
                    </span>
                    <span className="text-sm font-extrabold text-gray-900">
                      {s.remaining || "—"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
                      SLA minutes
                    </span>
                    <span className="text-sm text-gray-900 font-semibold">
                      {s.sla_minutes ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
                      Timer stopped
                    </span>
                    <span className="text-sm text-gray-900 font-semibold">
                      {s.timer_stopped_at
                        ? formatDateTime(s.timer_stopped_at)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
                      Duration
                    </span>
                    <span className="text-sm text-gray-900 font-semibold">
                      {s.duration || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-lpu-maroon/60 uppercase tracking-widest">
                      SLA met
                    </span>
                    <span
                      className={`text-sm font-extrabold ${
                        s.sla_met === true
                          ? "text-emerald-700"
                          : s.sla_met === false
                            ? "text-red-600"
                            : "text-gray-600"
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
