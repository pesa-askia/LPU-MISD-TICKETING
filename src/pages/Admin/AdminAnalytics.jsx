import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Download, Calendar, X, ChevronRight } from "lucide-react";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import {
  useNavbarActions,
  NavbarActionButton,
} from "../../context/NavbarActionsContext";

// Utility functions
function getStatusValue(ticket) {
  return (
    ticket?.Status ?? ticket?.status ?? ticket?.state ?? ticket?.State ?? ""
  );
}

function isClosed(ticket) {
  if (!ticket) return false;
  if (ticket.closed_at) return true;
  const s = String(getStatusValue(ticket)).toLowerCase();
  return s.includes("closed") || s.includes("resolved") || s.includes("done");
}

function escapeCsv(value) {
  const next = String(value ?? "");
  if (next.includes(",") || next.includes('"') || next.includes("\n")) {
    return `"${next.replaceAll('"', '""')}"`;
  }
  return next;
}

const SLA_PRIORITY_ORDER = ["Low", "Medium", "High"];

function normalizePriorityLabel(ticket) {
  const p = String(ticket?.Priority ?? ticket?.priority ?? "")
    .trim()
    .toLowerCase();
  if (p === "low") return "Low";
  if (p === "medium") return "Medium";
  if (p === "high") return "High";
  return null;
}

function resolutionMinutes(ticket) {
  if (!ticket?.created_at || !ticket?.closed_at) return null;
  const start = new Date(ticket.created_at);
  const end = new Date(ticket.closed_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return ms / (1000 * 60);
}

function formatMinutesOneDecimal(m) {
  if (m == null || Number.isNaN(m)) return "—";
  return `${m.toFixed(1)} min`;
}

function durationMinutesFromSeconds(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds < 0)
    return null;
  return seconds / 60;
}

// Components
function PieChart({ closedCount, openCount }) {
  const total = Math.max(closedCount + openCount, 1);
  const closedAngle = (closedCount / total) * 360;
  const openAngle = 360 - closedAngle;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div
        className="w-56 h-56 rounded-full grid place-items-center shadow-inner"
        style={{
          background: `conic-gradient(#336be3 0deg ${closedAngle}deg, #e6bc23 ${closedAngle}deg ${closedAngle + openAngle
            }deg)`,
        }}
      >
        <div className="w-[140px] h-[140px] rounded-full bg-white dark:bg-zinc-900 grid place-items-center text-6xl font-semibold text-gray-900 dark:text-zinc-100 shadow-md">
          {closedCount + openCount}
        </div>
      </div>
      <div className="w-full flex justify-center gap-8 text-lg font-medium text-gray-700 dark:text-zinc-300">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#336be3] shadow-sm" />
          Closed: <span className="font-bold">{closedCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e6bc23] shadow-sm" />
          Open: <span className="font-bold">{openCount}</span>
        </div>
      </div>
    </div>
  );
}

function SatisfactionPieChart({ satisfiedCount, unsatisfiedCount }) {
  const total = Math.max(satisfiedCount + unsatisfiedCount, 1);
  const satAngle = (satisfiedCount / total) * 360;
  const unsatAngle = 360 - satAngle;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div
        className="w-56 h-56 rounded-full grid place-items-center shadow-inner"
        style={{
          background: `conic-gradient(#16a34a 0deg ${satAngle}deg, #ef4444 ${satAngle}deg ${satAngle + unsatAngle
            }deg)`,
        }}
      >
        <div className="w-[140px] h-[140px] rounded-full bg-white dark:bg-zinc-900 grid place-items-center text-5xl font-semibold text-gray-900 dark:text-zinc-100 shadow-md">
          {satisfiedCount + unsatisfiedCount}
        </div>
      </div>
      <div className="w-full flex justify-center gap-8 text-base font-medium text-gray-700 dark:text-zinc-300">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shadow-sm" />
          Satisfied: <span className="font-bold">{satisfiedCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-sm" />
          Not: <span className="font-bold">{unsatisfiedCount}</span>
        </div>
      </div>
    </div>
  );
}

function DepartmentBarChart({ chartData, onDepartmentBarClick }) {
  const { stats = [], maxTotal = 1 } = chartData || {};

  return (
    <div
      className="flex flex-col gap-3 min-h-[320px]"
      aria-label="Tickets by department bar chart"
    >
      <p className="text-[11px] text-gray-500 dark:text-zinc-500 -mt-1 mb-1">
        Click a bar with tickets to see category and site breakdown.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 items-end min-h-[240px] py-3">
        {stats.map((item) => {
          const isEmpty = item.total === 0;
          const closedHeight = isEmpty ? 0 : (item.closed / maxTotal) * 100;
          const openHeight = isEmpty ? 0 : (item.open / maxTotal) * 100;

          return (
            <div
              key={item.department}
              className={`flex flex-col items-center gap-2 w-full ${!isEmpty && onDepartmentBarClick
                ? "cursor-pointer focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/25 rounded-lg"
                : ""
                }`}
            >
              <div
                role={!isEmpty && onDepartmentBarClick ? "button" : undefined}
                tabIndex={!isEmpty && onDepartmentBarClick ? 0 : undefined}
                className={`group w-full flex flex-col items-center gap-2 ${!isEmpty && onDepartmentBarClick ? "outline-none" : ""
                  }`}
                aria-label={
                  !isEmpty && onDepartmentBarClick
                    ? `${item.department}: ${item.total} tickets — click for category and site breakdown`
                    : undefined
                }
                onClick={(e) => {
                  if (isEmpty || !onDepartmentBarClick) return;
                  onDepartmentBarClick(item.department, e.currentTarget);
                }}
                onKeyDown={(e) => {
                  if (isEmpty || !onDepartmentBarClick) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onDepartmentBarClick(item.department, e.currentTarget);
                  }
                }}
              >
                <div
                  className={`w-full max-w-[70px] xl:max-w-[90px] h-[220px] flex flex-col-reverse rounded-lg overflow-hidden border relative transition-all duration-300 ease-out ${!isEmpty && onDepartmentBarClick
                    ? "hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-black/50 group-hover:border-[var(--color-lpu-maroon)]/30"
                    : "hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-black/50"
                    } ${isEmpty
                      ? "bg-gray-50 dark:bg-zinc-900/50 border-dashed border-gray-300 dark:border-white/10"
                      : "bg-[#f7f8fc] dark:bg-zinc-800/50 border-gray-200 dark:border-white/10"
                    }`}
                  role="img"
                  aria-hidden={!!onDepartmentBarClick}
                  aria-label={
                    !onDepartmentBarClick
                      ? `${item.department}: ${item.total} total, ${item.open} open, ${item.closed} closed`
                      : undefined
                  }
                >
                  {!isEmpty ? (
                    <>
                      <div
                        className="w-full bg-[#336be3] transition-all duration-500 ease-out pointer-events-none"
                        style={{ height: `${closedHeight}%` }}
                        title={`Closed: ${item.closed}`}
                      />
                      <div
                        className="w-full bg-[#e6bc23] transition-all duration-500 ease-out pointer-events-none"
                        style={{ height: `${openHeight}%` }}
                        title={`Open: ${item.open}`}
                      />
                    </>
                  ) : (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200 dark:bg-zinc-800 rounded-full mx-1 mb-1"
                      title="No tickets"
                    />
                  )}
                </div>

                <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                  <span className="text-base font-bold text-gray-900 dark:text-zinc-100">
                    {item.total}
                  </span>
                  {!isEmpty && (
                    <div className="flex gap-2 text-[11px] font-semibold">
                      <span className="text-[#336be3]">C:{item.closed}</span>
                      <span className="text-[#e6bc23]">O:{item.open}</span>
                    </div>
                  )}
                </div>
                <div className="text-[11px] xl:text-xs font-semibold text-center text-gray-500 dark:text-zinc-400 uppercase mt-1 pointer-events-none">
                  {item.department}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-6 justify-center pt-4 mt-3 border-t border-gray-100 dark:border-white/10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">
          <span className="w-2.5 h-2.5 rounded-full bg-[#336be3] shadow-sm" />
          <span>Closed</span>
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e6bc23] shadow-sm" />
          <span>Open</span>
        </div>
      </div>
    </div>
  );
}

const SLA_BAR_COLORS = {
  Low: "#166534",
  Medium: "#ca8a04",
  High: "#ad0009",
};

function SlaPriorityBarChart({ stats }) {
  const maxAvg = Math.max(1, ...stats.map((s) => s.avgMinutes));

  return (
    <div
      className="flex flex-col gap-2 min-h-0"
      aria-label="Average resolution time by priority"
    >
      <div className="grid grid-cols-3 gap-4 sm:gap-6 items-end min-h-[200px] py-2">
        {stats.map((item) => {
          const hasData = item.count > 0;
          const heightPct = hasData ? (item.avgMinutes / maxAvg) * 100 : 0;
          const barColor = SLA_BAR_COLORS[item.priority] ?? "#336be3";

          return (
            <div
              key={item.priority}
              className="flex flex-col items-center gap-2 w-full"
            >
              <div
                className={`w-full max-w-[100px] h-[160px] sm:h-[180px] flex flex-col justify-end rounded-lg overflow-hidden border relative transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-black/50 ${hasData
                  ? "bg-[#f7f8fc] dark:bg-zinc-800/50 border-gray-200 dark:border-white/10"
                  : "bg-gray-50 dark:bg-zinc-900/50 border-dashed border-gray-300 dark:border-white/10"
                  }`}
                role="img"
                aria-label={`${item.priority}: average ${item.avgMinutes.toFixed(1)} minutes, ${item.count} tickets`}
              >
                {hasData ? (
                  <div
                    className="w-full transition-all duration-500 ease-out rounded-t-sm"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: barColor,
                      minHeight: "8px",
                    }}
                    title={`Avg: ${item.avgMinutes.toFixed(1)} min (${item.count} tickets)`}
                  />
                ) : (
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200 dark:bg-zinc-800 rounded-full mx-1 mb-1" />
                )}
              </div>

              <div className="flex flex-col items-center gap-0.5 text-center">
                <span className="text-lg font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
                  {hasData ? formatMinutesOneDecimal(item.avgMinutes) : "—"}
                </span>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
                  n={item.count}
                </span>
              </div>
              <div className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
                {item.priority}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-6 justify-center pt-4 mt-3 border-t border-gray-100 dark:border-white/10">
        {SLA_PRIORITY_ORDER.map((p) => (
          <div
            key={p}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shadow-sm"
              style={{ backgroundColor: SLA_BAR_COLORS[p] }}
            />
            <span>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ALL_DEPARTMENTS = [
  "CAS",
  "CBA",
  "CITHM",
  "COECS",
  "LPU-SC",
  "HIGHSCHOOL",
];

/** Display order for analytics breakdown; unmatched → OTHERS */
const ANALYTICS_CATEGORY_ORDER = [
  "LMS",
  "Microsoft 365",
  "STUDENT PORTAL",
  "ERP",
  "HARDWARE",
  "SOFTWARE",
  "OTHERS",
];

function emptyDepartmentBreakdown() {
  return {
    categories: Object.fromEntries(
      ANALYTICS_CATEGORY_ORDER.map((c) => [c, 0]),
    ),
    sites: { Onsite: 0, Online: 0, OTHERS: 0 },
  };
}

function normalizeAnalyticsCategory(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!s) return "OTHERS";
  if (s === "lms") return "LMS";
  if (s.includes("microsoft") && s.includes("365")) return "Microsoft 365";
  if (s.includes("student") && s.includes("portal")) return "STUDENT PORTAL";
  if (s === "erp") return "ERP";
  if (s === "hardware") return "HARDWARE";
  if (s === "software") return "SOFTWARE";
  if (s === "others" || s === "other") return "OTHERS";
  return "OTHERS";
}

function normalizeAnalyticsSite(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "onsite") return "Onsite";
  if (s === "online") return "Online";
  return "OTHERS";
}

function positionDepartmentPopout(anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const popW = 320;
  const margin = 8;
  const estH = 340;
  let left = rect.left + rect.width / 2 - popW / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - popW - margin));
  let top = rect.bottom + margin;
  if (top + estH > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - estH - margin);
  }
  return { top, left };
}

function DepartmentBreakdownFlyout({
  department,
  breakdown,
  styleTop,
  styleLeft,
  onClose,
}) {
  if (!breakdown) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dept-popout-title"
        className="fixed z-[70] w-[min(calc(100vw-1.5rem),20rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl p-4 text-sm"
        style={{ top: styleTop, left: styleLeft }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative pr-7 mb-3">
          <h2
            id="dept-popout-title"
            className="text-base font-bold text-gray-900 dark:text-zinc-100"
          >
            {department}
          </h2>
          <button
            type="button"
            className="absolute top-0 right-0 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-zinc-400"
            aria-label="Close breakdown"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-zinc-500 mb-3 leading-relaxed">
          Same tickets as this bar (created date within From / To). Categories
          outside the list count as OTHERS.
        </p>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-2">
          Category
        </h3>
        <ul className="space-y-1.5 mb-4 border-b border-gray-100 dark:border-white/10 pb-3">
          {ANALYTICS_CATEGORY_ORDER.map((cat) => (
            <li
              key={cat}
              className="flex justify-between gap-3 text-[13px]"
            >
              <span className="text-gray-700 dark:text-zinc-300 truncate pr-2">
                {cat}
              </span>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100 shrink-0">
                {breakdown.categories[cat] ?? 0}
              </span>
            </li>
          ))}
        </ul>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-2">
          Site
        </h3>
        <ul className="space-y-1.5">
          {["Onsite", "Online", "OTHERS"].map((sk) => (
            <li
              key={sk}
              className="flex justify-between gap-3 text-[13px]"
            >
              <span className="text-gray-700 dark:text-zinc-300">
                {sk === "OTHERS" ? "Others" : sk}
              </span>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
                {breakdown.sites[sk] ?? 0}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// Main Page Component
export default function AdminAnalytics() {
  const { showLoading, hideLoading } = useLoading();
  const { adminTickets } = useTicketsCache();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");

  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const role = localStorage.getItem("userRole");
  const isAdmin = role === "admin";

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [slaModalOpen, setSlaModalOpen] = useState(false);
  const [satModalOpen, setSatModalOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptPopout, setDeptPopout] = useState(null);

  const toYMDLocal = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const visibleTickets = useMemo(() => {
    if (!fromDate && !toDate) return tickets;
    return tickets.filter((t) => {
      const ymd = toYMDLocal(t.created_at);
      if (!ymd) return false;
      if (fromDate && ymd < fromDate) return false;
      if (toDate && ymd > toDate) return false;
      return true;
    });
  }, [tickets, fromDate, toDate]);

  const formatFilterDate = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-");
    if (!y || !m || !d) return "";
    return `${m}/${d}/${y.slice(-2)}`;
  };

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;

    if (Array.isArray(adminTickets)) {
      setTickets(adminTickets);
      return;
    }

    const fetchTickets = async () => {
      try {
        showLoading();
        setError("");
        const { data, error: supaError } = await realtimeSupabase
          .from("Tickets")
          .select(
            "id,status,closed_at,created_at,Department,Type,Category,Priority,Summary,Description,Site,timer_duration_seconds,satisfaction",
          )
          .order("id", { ascending: false });

        if (supaError) {
          setError(supaError.message || "Failed to load analytics");
          setTickets([]);
          return;
        }
        setTickets(data || []);
      } catch (e) {
        setError(e?.message || "Failed to load analytics");
      } finally {
        hideLoading();
      }
    };
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!slaModalOpen && !satModalOpen && !deptModalOpen && !deptPopout) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSlaModalOpen(false);
        setSatModalOpen(false);
        setDeptModalOpen(false);
        setDeptPopout(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slaModalOpen, satModalOpen, deptModalOpen, deptPopout]);

  useEffect(() => {
    setDeptPopout(null);
  }, [fromDate, toDate]);

  const handleDatePillClick = (e) => {
    const pill = e.currentTarget;
    const input = pill.querySelector('input[type="date"]');
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      input.focus();
      return;
    }
    input.focus();
    input.click();
  };

  const handleDepartmentBarClick = (department, anchorEl) => {
    const { top, left } = positionDepartmentPopout(anchorEl);
    setDeptPopout({ department, top, left });
  };

  const {
    closedCount,
    openCount,
    satisfiedCount,
    unsatisfiedCount,
    departmentChartData,
    satisfactionByDept,
  } = useMemo(() => {
    const closed = visibleTickets.filter((t) => isClosed(t)).length;
    const open = visibleTickets.length - closed;
    const satisfied = visibleTickets.filter((t) => t?.satisfaction === true).length;
    const unsatisfied = visibleTickets.filter((t) => t?.satisfaction === false).length;

    const statsMap = new Map();
    const breakdownByDept = {};
    const satByDept = {};

    ALL_DEPARTMENTS.forEach((dept) => {
      statsMap.set(dept, { department: dept, total: 0, open: 0, closed: 0 });
      breakdownByDept[dept] = emptyDepartmentBreakdown();
      satByDept[dept] = { satisfied: 0, unsatisfied: 0, total: 0 };
    });

    visibleTickets.forEach((ticket) => {
      const dept = (ticket?.Department || "").trim();
      if (!dept) return;

      if (statsMap.has(dept)) {
        const stat = statsMap.get(dept);
        stat.total += 1;
        if (isClosed(ticket)) {
          stat.closed += 1;
        } else {
          stat.open += 1;
        }

        const b = breakdownByDept[dept];
        const cat = normalizeAnalyticsCategory(
          ticket.Category ?? ticket.category,
        );
        b.categories[cat] += 1;
        const site = normalizeAnalyticsSite(ticket.Site ?? ticket.site);
        b.sites[site] = (b.sites[site] ?? 0) + 1;

        // Satisfaction breakdown per department
        if (ticket.satisfaction === true) {
          satByDept[dept].satisfied += 1;
          satByDept[dept].total += 1;
        } else if (ticket.satisfaction === false) {
          satByDept[dept].unsatisfied += 1;
          satByDept[dept].total += 1;
        }
      }
    });

    const stats = ALL_DEPARTMENTS.map((dept) => statsMap.get(dept));
    const maxTotal = Math.max(1, ...stats.map((item) => item.total));

    return {
      closedCount: closed,
      openCount: open,
      satisfiedCount: satisfied,
      unsatisfiedCount: unsatisfied,
      departmentChartData: {
        stats,
        maxTotal,
        breakdownByDept,
      },
      satisfactionByDept: satByDept,
    };
  }, [visibleTickets]);

  const closedTicketsInSlaRange = useMemo(() => {
    return tickets.filter((t) => {
      if (!t?.closed_at) return false;
      if (!fromDate && !toDate) return true;
      const ymd = toYMDLocal(t.closed_at);
      if (!ymd) return false;
      if (fromDate && ymd < fromDate) return false;
      if (toDate && ymd > toDate) return false;
      return true;
    });
  }, [tickets, fromDate, toDate]);

  const slaPriorityStats = useMemo(() => {
    const sums = { Low: 0, Medium: 0, High: 0 };
    const counts = { Low: 0, Medium: 0, High: 0 };

    closedTicketsInSlaRange.forEach((t) => {
      const label = normalizePriorityLabel(t);
      if (!label) return;
      const minutes = durationMinutesFromSeconds(t?.timer_duration_seconds);
      if (minutes == null) return;
      sums[label] += minutes;
      counts[label] += 1;
    });

    return SLA_PRIORITY_ORDER.map((priority) => {
      const n = counts[priority];
      return {
        priority,
        count: n,
        avgMinutes: n > 0 ? sums[priority] / n : 0,
      };
    });
  }, [closedTicketsInSlaRange]);

  const slaOverallStats = useMemo(() => {
    let sum = 0;
    let n = 0;
    closedTicketsInSlaRange.forEach((t) => {
      const m = durationMinutesFromSeconds(t?.timer_duration_seconds);
      if (m == null) return;
      sum += m;
      n += 1;
    });
    return { avgMinutes: n > 0 ? sum / n : null, count: n };
  }, [closedTicketsInSlaRange]);

  const onExportCsv = () => {
    const headers = [
      "id",
      "summary",
      "description",
      "department",
      "type",
      "category",
      "priority",
      "site",
      "status",
      "created_at",
      "closed_at",
    ];
    const rows = visibleTickets.map((t) => [
      t.id,
      t.Summary,
      t.Description,
      t.Department,
      t.Type,
      t.Category,
      t.Priority ?? t.priority ?? "",
      t.Site,
      t.status || t.Status || "Open",
      t.created_at,
      t.closed_at,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useNavbarActions(
    <NavbarActionButton
      icon={Download}
      label="Export CSV"
      onClick={onExportCsv}
    />,
  );

  if (!isLoggedIn) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/Tickets" replace />;

  return (
    <div className="w-full min-h-screen bg-[#f9fafb] dark:bg-zinc-950 font-[family:var(--font-poppins)] pt-6 pb-12 transition-colors duration-200">
      <section className="max-w-[1550px] mx-auto px-4 md:px-6">
        {error ? (
          <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
            {error}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-end mb-5">
              <div
                className="relative group flex-1 sm:flex-none cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-[170px] text-[13px] font-medium text-gray-700 dark:text-zinc-300 shadow-sm transition-all hover:border-[var(--color-lpu-maroon)] dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/20 dark:focus-within:ring-white/10"
                role="button"
                tabIndex={0}
                aria-label="Filter by from date"
                onClick={handleDatePillClick}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  handleDatePillClick({ currentTarget: e.currentTarget })
                }
              >
                <span className="relative z-10 pointer-events-none">
                  {fromDate
                    ? `From ${formatFilterDate(fromDate)}`
                    : "From MM/DD/YY"}
                </span>
                <Calendar className="w-4 h-4 text-gray-400 dark:text-zinc-500 group-hover:text-[var(--color-lpu-maroon)] dark:group-hover:text-zinc-300 transition-colors" />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div
                className="relative group flex-1 sm:flex-none cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-[170px] text-[13px] font-medium text-gray-700 dark:text-zinc-300 shadow-sm transition-all hover:border-[var(--color-lpu-maroon)] dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/20 dark:focus-within:ring-white/10"
                role="button"
                tabIndex={0}
                aria-label="Filter by to date"
                onClick={handleDatePillClick}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  handleDatePillClick({ currentTarget: e.currentTarget })
                }
              >
                <span className="relative z-10 pointer-events-none">
                  {toDate ? `To ${formatFilterDate(toDate)}` : "To MM/DD/YY"}
                </span>
                <Calendar className="w-4 h-4 text-gray-400 dark:text-zinc-500 group-hover:text-[var(--color-lpu-maroon)] dark:group-hover:text-zinc-300 transition-colors" />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {/* Main Cards Grid */}
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Total Tickets Card */}
                <button
                  type="button"
                  className="group bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--color-lpu-maroon)]/35 dark:hover:border-white/20 transition-all duration-300 p-5 md:p-7 text-left w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lpu-maroon)]/30 dark:focus-visible:ring-white/20 flex flex-col"
                  onClick={() => setDeptModalOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={deptModalOpen}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                      Total Tickets
                    </h3>
                    <ChevronRight className="w-5 h-5 shrink-0 text-gray-400 group-hover:text-[var(--color-lpu-maroon)] dark:group-hover:text-zinc-300 transition-colors mt-0.5" />
                  </div>
                  <PieChart closedCount={closedCount} openCount={openCount} />
                  <div className="mt-auto">
                    <p className="text-[11px] text-center text-gray-400 dark:text-zinc-500 mt-3 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors">
                      Click for breakdown by department
                    </p>
                  </div>
                </button>

                {/* SLA summary — click opens priority breakdown */}
                <button
                  type="button"
                  className="group bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--color-lpu-maroon)]/35 dark:hover:border-white/20 transition-all duration-300 p-5 md:p-7 text-left w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lpu-maroon)]/30 dark:focus-visible:ring-white/20 flex flex-col"
                  onClick={() => setSlaModalOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={slaModalOpen}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                      SLA — Resolution time
                    </h3>
                    <ChevronRight className="w-5 h-5 shrink-0 text-gray-400 group-hover:text-[var(--color-lpu-maroon)] dark:group-hover:text-zinc-300 transition-colors mt-0.5" />
                  </div>

                  <div className="flex flex-col items-center justify-center py-10 gap-2 min-h-[280px]">
                    <span className="text-5xl md:text-6xl font-semibold tabular-nums text-gray-900 dark:text-zinc-100 tracking-tight">
                      {slaOverallStats.avgMinutes != null
                        ? slaOverallStats.avgMinutes.toFixed(1)
                        : "—"}
                    </span>
                    <span className="text-base font-medium text-gray-500 dark:text-zinc-400">
                      minutes avg.
                    </span>
                    <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 mt-2">
                      n={slaOverallStats.count} closed in range
                    </span>
                  </div>

                  <div className="mt-auto">
                    <p className="text-[11px] text-gray-500 dark:text-zinc-500 mb-4 leading-relaxed text-center px-2">
                      Average minutes based on the Timeline Duration. Uses tickets
                      whose{" "}
                      <span className="font-medium text-gray-600 dark:text-zinc-400">
                        closed date
                      </span>{" "}
                      is in the From / To range above.
                    </p>

                    <p className="text-[11px] text-center text-gray-400 dark:text-zinc-500 mt-3 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors">
                      Click for breakdown by priority
                    </p>
                  </div>
                </button>

                {/* Satisfaction pie card */}
                <button
                  type="button"
                  className="group bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--color-lpu-maroon)]/35 dark:hover:border-white/20 transition-all duration-300 p-5 md:p-7 text-left w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lpu-maroon)]/30 dark:focus-visible:ring-white/20 flex flex-col"
                  onClick={() => setSatModalOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={satModalOpen}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                      Satisfaction
                    </h3>
                    <ChevronRight className="w-5 h-5 shrink-0 text-gray-400 group-hover:text-[var(--color-lpu-maroon)] dark:group-hover:text-zinc-300 transition-colors mt-0.5" />
                  </div>
                  <SatisfactionPieChart
                    satisfiedCount={satisfiedCount}
                    unsatisfiedCount={unsatisfiedCount}
                  />
                  <div className="mt-auto">
                    <p className="text-[11px] text-center text-gray-400 dark:text-zinc-500 mt-3 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors">
                      Click for breakdown by department
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {deptModalOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[1px]"
                role="presentation"
                onClick={() => setDeptModalOpen(false)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="dept-modal-title"
                  className="relative w-full max-w-4xl max-h-[min(90vh,700px)] overflow-y-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl p-5 md:p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div>
                      <h2
                        id="dept-modal-title"
                        className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 mb-1"
                      >
                        Tickets by Department
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">
                        Visual breakdown of total tickets across different departments.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                      onClick={() => setDeptModalOpen(false)}
                      aria-label="Close"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="bg-[#fcfdfe] dark:bg-zinc-950/30 rounded-xl border border-gray-100 dark:border-white/5 p-6">
                    <DepartmentBarChart
                      chartData={departmentChartData}
                      onDepartmentBarClick={handleDepartmentBarClick}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {deptPopout ? (
              <DepartmentBreakdownFlyout
                department={deptPopout.department}
                breakdown={
                  departmentChartData.breakdownByDept[deptPopout.department]
                }
                styleTop={deptPopout.top}
                styleLeft={deptPopout.left}
                onClose={() => setDeptPopout(null)}
              />
            ) : null}

            {slaModalOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[1px]"
                role="presentation"
                onClick={() => setSlaModalOpen(false)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sla-modal-title"
                  className="relative w-full max-w-lg max-h-[min(90vh,560px)] overflow-y-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl p-5 md:p-7"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2
                      id="sla-modal-title"
                      className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 pr-8"
                    >
                      Resolution time by priority
                    </h2>
                    <button
                      type="button"
                      className="absolute top-4 right-4 p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                      onClick={() => setSlaModalOpen(false)}
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
                    Same date rules as the card: closed between From and To.
                    Overall average on the card includes every closed ticket in
                    that range; below is the average per Low / Medium / High
                    only.
                  </p>
                  <SlaPriorityBarChart stats={slaPriorityStats} />
                </div>
              </div>
            ) : null}

            {satModalOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[1px]"
                role="presentation"
                onClick={() => setSatModalOpen(false)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sat-modal-title"
                  className="relative w-full max-w-lg max-h-[min(90vh,640px)] overflow-y-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl p-5 md:p-7"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2
                      id="sat-modal-title"
                      className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 pr-8"
                    >
                      Satisfaction by Department
                    </h2>
                    <button
                      type="button"
                      className="absolute top-4 right-4 p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                      onClick={() => setSatModalOpen(false)}
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
                    Breakdown of satisfied and not satisfied responses for each department within the selected date range.
                  </p>

                  <div className="space-y-6">
                    {ALL_DEPARTMENTS.map((dept) => {
                      const stats = satisfactionByDept[dept];
                      const total = stats.total || 0;
                      const satPct = total > 0 ? (stats.satisfied / total) * 100 : 0;
                      const unsatPct = total > 0 ? (stats.unsatisfied / total) * 100 : 0;

                      return (
                        <div key={dept} className="flex flex-col gap-2">
                          <div className="flex justify-between items-end">
                            <span className="font-bold text-gray-900 dark:text-zinc-100">{dept}</span>
                            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                              {total} total response{total !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="h-3 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                            {total > 0 ? (
                              <>
                                <div
                                  className="h-full bg-[#16a34a] transition-all duration-500"
                                  style={{ width: `${satPct}%` }}
                                  title={`Satisfied: ${stats.satisfied}`}
                                />
                                <div
                                  className="h-full bg-[#ef4444] transition-all duration-500"
                                  style={{ width: `${unsatPct}%` }}
                                  title={`Not Satisfied: ${stats.unsatisfied}`}
                                />
                              </>
                            ) : (
                              <div className="h-full w-full bg-gray-100 dark:bg-zinc-800 border-dashed border border-gray-300 dark:border-white/10" />
                            )}
                          </div>
                          <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                            <div className="flex items-center gap-1.5 text-[#16a34a]">
                              <span>Satisfied:</span>
                              <span className="text-gray-900 dark:text-zinc-100">{stats.satisfied}</span>
                              {total > 0 && <span className="text-gray-400 dark:text-zinc-500 font-normal">({satPct.toFixed(0)}%)</span>}
                            </div>
                            <div className="flex items-center gap-1.5 text-[#ef4444]">
                              <span>Not Satisfied:</span>
                              <span className="text-gray-900 dark:text-zinc-100">{stats.unsatisfied}</span>
                              {total > 0 && <span className="text-gray-400 dark:text-zinc-500 font-normal">({unsatPct.toFixed(0)}%)</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 pt-5 border-t border-gray-100 dark:border-white/10 flex justify-center gap-6">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
                      <span>Satisfied</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                      <span>Not Satisfied</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
