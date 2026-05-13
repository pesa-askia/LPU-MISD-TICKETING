import { useEffect, useMemo, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { Download, Calendar, ChevronDown, ChevronUp, Users } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import {
  useNavbarActions,
  NavbarActionButton,
} from "../../context/NavbarActionsContext";
import { isGlobalAdmin } from "../../utils/adminLevels";

const ALL_DEPARTMENTS = ["CAS", "CBA", "CITHM", "COECS", "LPU-SC", "HIGHSCHOOL"];
const ANALYTICS_CATEGORY_ORDER = ["LMS", "Microsoft 365", "STUDENT PORTAL", "ERP", "HARDWARE", "SOFTWARE", "OTHERS"];
const ANALYTICS_TYPE_ORDER = ["Student", "Faculty", "Admin"];
const ANALYTICS_SITE_ORDER = ["Onsite", "Online", "OTHERS"];
const SLA_PRIORITY_ORDER = ["Low", "Medium", "High"];

function normalizeDepartment(raw) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s.includes("HIGHSCHO")) return "HIGHSCHOOL";
  return s;
}

const COLORS = {
  closed: "#336be3",
  open: "#e6bc23",
  satisfied: "#22c55e",
  unsatisfied: "#f43f5e",
  slaLow: "#166534",
  slaMedium: "#ca8a04",
  slaHigh: "#ad0009",
};

const DISTRIBUTION_COLORS = [
  "#3b82f6", // Blue
  "#fbbf24", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#a855f7", // Purple
  "#ec4899", // Pink
];

function normalizePriorityLabel(ticket) {
  const p = String(ticket?.Priority ?? ticket?.priority ?? "").trim().toLowerCase();
  if (p === "low") return "Low";
  if (p === "medium") return "Medium";
  if (p === "high") return "High";
  return null;
}

function isClosed(ticket) {
  if (!ticket) return false;
  if (ticket.closed_at) return true;
  const s = String(ticket?.Status ?? ticket?.status ?? "").toLowerCase();
  return s.includes("closed") || s.includes("resolved") || s.includes("done");
}

function durationMinutesFromSeconds(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds < 0) return null;
  return seconds / 60;
}

function formatMinutesOneDecimal(m) {
  if (m == null || Number.isNaN(m)) return "—";
  return `${m.toFixed(1)} min`;
}

function escapeCsv(value) {
  const next = String(value ?? "");
  if (next.includes(",") || next.includes('"') || next.includes("\n")) {
    return `"${next.replaceAll('"', '""')}"`;
  }
  return next;
}

function normalizeAnalyticsCategory(raw) {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return "OTHERS";
  if (s === "lms") return "LMS";
  if (s.includes("microsoft") && s.includes("365")) return "Microsoft 365";
  if (s.includes("student") && s.includes("portal")) return "STUDENT PORTAL";
  if (s === "erp") return "ERP";
  if (s === "hardware") return "HARDWARE";
  if (s === "software") return "SOFTWARE";
  return "OTHERS";
}

function normalizeAnalyticsSite(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "onsite") return "Onsite";
  if (s === "online") return "Online";
  return "OTHERS";
}

function normalizeAnalyticsType(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "student") return "Student";
  if (s === "faculty") return "Faculty";
  if (s === "admin") return "Admin";
  return "OTHERS";
}

function DonutSegment({ cx, cy, r, strokeWidth, color, value, total, startOffset, isSelected, onClick }) {
  const circ = 2 * Math.PI * r;
  const dash = total > 0 ? (value / total) * circ : 0;
  if (dash <= 0) return null;
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill="none"
      stroke={color}
      strokeWidth={isSelected ? strokeWidth + 3 : strokeWidth}
      strokeDasharray={`${dash} ${circ}`}
      strokeDashoffset={-startOffset}
      onClick={onClick}
      className="cursor-pointer"
      style={{ opacity: isSelected ? 1 : 0.85 }}
    />
  );
}

function MultiRingDonutChart({ closedCount, openCount, satisfiedCount, unsatisfiedCount, total, selectedStatuses = new Set(), onStatusClick }) {
  const feedbackTotal = satisfiedCount + unsatisfiedCount;
  const cx = 110, cy = 110;
  const outerR = 92, innerR = 70, sw = 19;
  const outerCirc = 2 * Math.PI * outerR;
  const innerCirc = 2 * Math.PI * innerR;
  const satisfiedDash = feedbackTotal > 0 ? (satisfiedCount / feedbackTotal) * outerCirc : 0;
  const closedDash = total > 0 ? (closedCount / total) * innerCirc : 0;

  const legendItems = [
    { key: "satisfied", color: COLORS.satisfied, label: "Satisfied", count: satisfiedCount },
    { key: "unsatisfied", color: COLORS.unsatisfied, label: "Not", count: unsatisfiedCount },
    { key: "closed", color: COLORS.closed, label: "Closed", count: closedCount },
    { key: "open", color: COLORS.open, label: "Open", count: openCount },
  ];
  const anySelected = selectedStatuses.size > 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="220" height="220" viewBox="0 0 220 220">
        <g transform="rotate(-90, 110, 110)">
          {/* Outer ring background */}
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#e5e7eb" strokeWidth={sw} className="dark:stroke-zinc-700" />
          {/* Outer: satisfied */}
          <DonutSegment cx={cx} cy={cy} r={outerR} strokeWidth={sw} color={COLORS.satisfied}
            value={satisfiedCount} total={feedbackTotal} startOffset={0}
            isSelected={selectedStatuses.has("satisfied")}
            onClick={() => onStatusClick?.("satisfied")} />
          {/* Outer: unsatisfied */}
          <DonutSegment cx={cx} cy={cy} r={outerR} strokeWidth={sw} color={COLORS.unsatisfied}
            value={unsatisfiedCount} total={feedbackTotal} startOffset={satisfiedDash}
            isSelected={selectedStatuses.has("unsatisfied")}
            onClick={() => onStatusClick?.("unsatisfied")} />
          {/* Inner ring background */}
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#e5e7eb" strokeWidth={sw} className="dark:stroke-zinc-700" />
          {/* Inner: closed */}
          <DonutSegment cx={cx} cy={cy} r={innerR} strokeWidth={sw} color={COLORS.closed}
            value={closedCount} total={total} startOffset={0}
            isSelected={selectedStatuses.has("closed")}
            onClick={() => onStatusClick?.("closed")} />
          {/* Inner: open */}
          <DonutSegment cx={cx} cy={cy} r={innerR} strokeWidth={sw} color={COLORS.open}
            value={openCount} total={total} startOffset={closedDash}
            isSelected={selectedStatuses.has("open")}
            onClick={() => onStatusClick?.("open")} />
        </g>
        {/* Center hole */}
        <circle cx={cx} cy={cy} r={innerR - sw / 2 - 2} fill="white" className="dark:fill-zinc-900" />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="34" fontWeight="bold" className="fill-gray-900 dark:fill-zinc-100">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="#9ca3af">TOTAL</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-semibold">
        {legendItems.map(({ key, color, label, count }) => (
          <div key={key} className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${anySelected && !selectedStatuses.has(key) ? "opacity-40" : ""}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
            <span className="font-bold text-gray-900 dark:text-zinc-100">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerticalBarGraph({ chartData, selectedDepts = new Set(), onBarClick }) {
  const { stats = [], maxTotal = 1 } = chartData || {};

  return (
    <div className="flex flex-col gap-3" aria-label="Tickets by department bar chart">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end min-h-[200px] py-3">
        {stats.map((item) => {
          const isEmpty = item.total === 0;
          const isSelected = selectedDepts.has(item.department);
          const closedHeight = isEmpty ? 0 : (item.closed / maxTotal) * 100;
          const openHeight = isEmpty ? 0 : (item.open / maxTotal) * 100;

          return (
            <div
              key={item.department}
              className={`flex flex-col items-center gap-2 w-full ${!isEmpty && onBarClick ? "cursor-pointer" : ""}`}
            >
              <div
                role={!isEmpty && onBarClick ? "button" : undefined}
                tabIndex={!isEmpty && onBarClick ? 0 : undefined}
                className={`group w-full flex flex-col items-center gap-2 ${!isEmpty && onBarClick ? "outline-none" : ""}`}
                onClick={(e) => { if (!isEmpty && onBarClick) onBarClick(item.department, e.currentTarget); }}
                onKeyDown={(e) => { if (!isEmpty && onBarClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onBarClick(item.department, e.currentTarget); } }}
              >
                <div
                  className={`w-full max-w-[70px] xl:max-w-[90px] h-[180px] flex flex-col-reverse rounded-lg overflow-hidden border relative ${isSelected ? "ring-2 ring-[var(--color-lpu-maroon)] ring-offset-2 dark:ring-offset-zinc-900" : ""} ${!isEmpty && onBarClick ? "group-hover:border-[var(--color-lpu-maroon)]/30" : ""} ${isEmpty ? "bg-gray-50 dark:bg-zinc-900/50 border-dashed border-gray-300 dark:border-white/10" : "bg-[#f7f8fc] dark:bg-zinc-800/50 border-gray-200 dark:border-white/10"}`}
                >
                  {!isEmpty ? (
                    <>
                      <div className="w-full bg-[#336be3] pointer-events-none" style={{ height: `${closedHeight}%` }} />
                      <div className="w-full bg-[#e6bc23] pointer-events-none" style={{ height: `${openHeight}%` }} />
                    </>
                  ) : (
                    <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200 dark:bg-zinc-800 rounded-full mx-1 mb-1" />
                  )}
                </div>
                <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                  <span className={`text-base font-bold ${isSelected ? "text-[var(--color-lpu-maroon)]" : "text-gray-900 dark:text-zinc-100"}`}>{item.total}</span>
                  {!isEmpty && (
                    <div className="flex gap-2 text-[11px] font-semibold">
                      <span className="text-[#336be3]">C:{item.closed}</span>
                      <span className="text-[#e6bc23]">O:{item.open}</span>
                    </div>
                  )}
                </div>
                <div className={`text-[11px] xl:text-xs font-semibold text-center uppercase mt-1 pointer-events-none ${isSelected ? "text-[var(--color-lpu-maroon)] font-bold" : "text-gray-500 dark:text-zinc-400"}`}>
                  {item.department}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-6 justify-center pt-3 mt-2 border-t border-gray-100 dark:border-white/10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">
          <span className="w-2.5 h-2.5 rounded-full bg-[#336be3]" />Closed
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e6bc23]" />Open
        </div>
      </div>
    </div>
  );
}

function StackedDistributionBar({ title, data, selectedValues = new Set(), onSegmentClick }) {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm p-3 md:p-4 mb-3 last:mb-0">
      <h4 className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{title}</h4>

      <div className="w-full h-8 md:h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex shadow-inner">
        {data.map((item, idx) => {
          if (item.value === 0) return null;
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const color = DISTRIBUTION_COLORS[idx % DISTRIBUTION_COLORS.length];
          const isSelected = selectedValues.has(item.label);

          return (
            <div
              key={item.label}
              role="button"
              tabIndex={0}
              onClick={() => onSegmentClick?.(item.label)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSegmentClick?.(item.label); } }}
              className={`h-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold border-r border-white/10 last:border-0 cursor-pointer outline-none ${isSelected ? "brightness-110 ring-2 ring-inset ring-white/50" : "hover:brightness-110"}`}
              style={{ width: `${percentage}%`, backgroundColor: color }}
            >
              <span className="truncate px-1">
                {item.value} ({Math.round(percentage)}%)
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {data.map((item, idx) => {
            const isSelected = selectedValues.has(item.label);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onSegmentClick?.(item.label)}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 cursor-pointer ${isSelected ? "ring-2 ring-[var(--color-lpu-maroon)] ring-offset-1 bg-gray-50 dark:bg-zinc-800" : "hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DISTRIBUTION_COLORS[idx % DISTRIBUTION_COLORS.length] }} />
                <span className="text-[10px] md:text-[11px] font-medium text-gray-600 dark:text-zinc-400">
                  {item.label} <span className="text-gray-900 dark:text-zinc-200 font-bold">({item.value})</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="text-[10px] md:text-[11px] font-bold text-gray-900 dark:text-zinc-200">
          Total: {total}
        </div>
      </div>
    </div>
  );
}

function SlaSection({ slaData, currentUserId, isGlobalAdminUser, selectedAdminIds = new Set(), onAdminClick }) {
  const sortedAdmins = useMemo(() => {
    return [...(slaData || [])].sort((a, b) => {
      if (a.adminId === currentUserId) return -1;
      if (b.adminId === currentUserId) return 1;
      return 0;
    });
  }, [slaData, currentUserId]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[var(--color-lpu-maroon)]" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">SLA — Resolution Time</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {isGlobalAdminUser ? "Click admin to filter all charts" : "Your data only"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex-1 overflow-y-auto">
        {sortedAdmins.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400 py-4 text-center">No SLA data available</p>
        ) : (
          <div className="space-y-4">
            {sortedAdmins.map((adminEntry) => {
              const isCurrentUser = adminEntry.adminId === currentUserId;
              const isSelected = selectedAdminIds.has(adminEntry.adminId);
              return (
                <div
                  key={adminEntry.adminId}
                  role={isGlobalAdminUser ? "button" : undefined}
                  tabIndex={isGlobalAdminUser ? 0 : undefined}
                  onClick={() => isGlobalAdminUser && onAdminClick?.(adminEntry.adminId)}
                  onKeyDown={(e) => { if (isGlobalAdminUser && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAdminClick?.(adminEntry.adminId); } }}
                  className={`rounded-lg p-3 ${isGlobalAdminUser ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-[var(--color-lpu-maroon)] ring-offset-1 bg-[var(--color-lpu-maroon)]/5 border border-[var(--color-lpu-maroon)]/20" : isCurrentUser ? "bg-[var(--color-lpu-maroon)]/5 border border-[var(--color-lpu-maroon)]/20 hover:ring-1 hover:ring-[var(--color-lpu-maroon)]/40" : "bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                      {adminEntry.adminName || "Unknown Admin"}
                      {isCurrentUser && <span className="ml-2 text-[10px] font-semibold text-[var(--color-lpu-maroon)]">(You)</span>}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                      n={adminEntry.totalCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {SLA_PRIORITY_ORDER.map((priority) => {
                      const stat = adminEntry.byPriority[priority] || { count: 0, avgMinutes: 0 };
                      const colorMap = { Low: COLORS.slaLow, Medium: COLORS.slaMedium, High: COLORS.slaHigh };
                      return (
                        <div key={priority} className="flex flex-col items-center p-2 bg-white dark:bg-zinc-900 rounded-lg">
                          <span className="text-[10px] font-semibold uppercase" style={{ color: colorMap[priority] }}>{priority}</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
                            {stat.count > 0 ? formatMinutesOneDecimal(stat.avgMinutes) : "—"}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-zinc-500">n={stat.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const { showLoading, hideLoading } = useLoading();
  const { adminTickets } = useTicketsCache();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [adminUsers, setAdminUsers] = useState([]);

  const { isLoggedIn, isAdmin, currentUserId, isGlobalAdminUser } = useMemo(() => {
    const token = localStorage.getItem("authToken");
    const loggedIn = localStorage.getItem("isLoggedIn") === "true";
    if (!token) return { isLoggedIn: loggedIn, isAdmin: false, currentUserId: null, isGlobalAdminUser: false };
    try {
      const decoded = jwtDecode(token);
      return {
        isLoggedIn: loggedIn,
        isAdmin: decoded.app_role === "admin",
        currentUserId: decoded.sub || decoded.id,
        isGlobalAdminUser: isGlobalAdmin(decoded.admin_level),
      };
    } catch {
      return { isLoggedIn: loggedIn, isAdmin: false, currentUserId: null, isGlobalAdminUser: false };
    }
  }, []);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDepts, setSelectedDepts] = useState(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState(new Set());
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedSites, setSelectedSites] = useState(new Set());
  const [selectedAdminIds, setSelectedAdminIds] = useState(new Set());
  // first filter type clicked becomes parent — its chart is immune to all other filters
  const [parentFilterType, setParentFilterType] = useState(null);

  const makeToggleHandler = useCallback((setter, typeName, currentSet) => (value) => {
    const wasEmpty = currentSet.size === 0;
    const willBeEmpty = currentSet.size === 1 && currentSet.has(value);
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setParentFilterType((prev) => {
      if (wasEmpty && prev === null) return typeName;
      if (prev === typeName && willBeEmpty) return null;
      return prev;
    });
  }, []);

  useEffect(() => {
    const fetchAdminUsers = async () => {
      try {
        const API_BASE_URL = getApiBaseUrl();
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/api/admin/staff`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch admin users");
        }
        const data = await response.json();
        setAdminUsers(data.data);
      } catch (err) {
        console.error("Error fetching admin users:", err);
        // Optionally set an error state or display a message
      }
    };
    if (isLoggedIn && isAdmin) {
      fetchAdminUsers();
    }
  }, [isLoggedIn, isAdmin]);

  const toYMDLocal = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const ticketsFilteredByDate = useMemo(() => {
    if (fromDate || toDate) {
      return tickets.filter((t) => {
        const ymd = toYMDLocal(t.created_at);
        if (!ymd) return false;
        if (fromDate && ymd < fromDate) return false;
        if (toDate && ymd > toDate) return false;
        return true;
      });
    }
    return tickets;
  }, [tickets, fromDate, toDate]);

  // Apply all click filters, optionally skipping specific types.
  // Parent chart skips all types (gets date-only data).
  // Non-parent charts skip only their own type.
  const applyFilters = useCallback((arr, skip = new Set()) => {
    let f = arr;
    if (!skip.has("status") && selectedStatuses.size > 0) {
      f = f.filter((t) => {
        if (selectedStatuses.has("closed") && isClosed(t)) return true;
        if (selectedStatuses.has("open") && !isClosed(t)) return true;
        if (selectedStatuses.has("satisfied") && t?.satisfaction === true) return true;
        if (selectedStatuses.has("unsatisfied") && t?.satisfaction === false) return true;
        return false;
      });
    }
    if (!skip.has("admin") && selectedAdminIds.size > 0)
      f = f.filter((t) => [t?.Assignee1, t?.Assignee2, t?.Assignee3].some((id) => selectedAdminIds.has(id)));
    if (!skip.has("type") && selectedTypes.size > 0)
      f = f.filter((t) => selectedTypes.has(normalizeAnalyticsType(t?.Type ?? t?.type)));
    if (!skip.has("category") && selectedCategories.size > 0)
      f = f.filter((t) => selectedCategories.has(normalizeAnalyticsCategory(t?.Category ?? t?.category)));
    if (!skip.has("site") && selectedSites.size > 0)
      f = f.filter((t) => selectedSites.has(normalizeAnalyticsSite(t?.Site ?? t?.site)));
    if (!skip.has("dept") && selectedDepts.size > 0)
      f = f.filter((t) => selectedDepts.has(normalizeDepartment(t?.Department)));
    return f;
  }, [selectedStatuses, selectedAdminIds, selectedTypes, selectedCategories, selectedSites, selectedDepts]);

  // visibleTickets: all filters applied — used by donut + SLA
  const visibleTickets = useMemo(() => applyFilters(ticketsFilteredByDate), [ticketsFilteredByDate, applyFilters]);

  const { closedCount, openCount, satisfiedCount, unsatisfiedCount, departmentChartData, typeData, categoryData, siteData } = useMemo(() => {
    // Donut: parent → immune to other filters (all except status). Non-parent → visibleTickets.
    const donutSource = parentFilterType === "status"
      ? applyFilters(ticketsFilteredByDate, new Set(["status"]))
      : visibleTickets;
    const closed = donutSource.filter((t) => isClosed(t)).length;
    const open = donutSource.length - closed;
    const satisfied = donutSource.filter((t) => t?.satisfaction === true).length;
    const unsatisfied = donutSource.filter((t) => t?.satisfaction === false).length;

    // Dept chart: parent → date only (immune). Non-parent → all filters except own type "dept".
    const deptSource = parentFilterType === "dept"
      ? ticketsFilteredByDate
      : applyFilters(ticketsFilteredByDate, new Set(["dept"]));
    const statsMap = new Map();
    ALL_DEPARTMENTS.forEach((d) => statsMap.set(d, { department: d, total: 0, open: 0, closed: 0 }));
    deptSource.forEach((ticket) => {
      const dept = normalizeDepartment(ticket?.Department);
      if (dept && statsMap.has(dept)) {
        const stat = statsMap.get(dept);
        stat.total += 1;
        if (isClosed(ticket)) stat.closed += 1;
        else stat.open += 1;
      }
    });

    // Breakdown bars: parent → date only. Non-parent → all filters except own type.
    const typeSource = parentFilterType === "type" ? ticketsFilteredByDate : applyFilters(ticketsFilteredByDate, new Set(["type"]));
    const catSource = parentFilterType === "category" ? ticketsFilteredByDate : applyFilters(ticketsFilteredByDate, new Set(["category"]));
    const siteSource = parentFilterType === "site" ? ticketsFilteredByDate : applyFilters(ticketsFilteredByDate, new Set(["site"]));

    const typeMap = {};
    const catMap = {};
    const sessionSiteMap = {};
    ANALYTICS_TYPE_ORDER.forEach((t) => (typeMap[t] = 0));
    ANALYTICS_CATEGORY_ORDER.forEach((c) => (catMap[c] = 0));
    ANALYTICS_SITE_ORDER.forEach((s) => (sessionSiteMap[s] = 0));
    typeSource.forEach((t) => { const v = normalizeAnalyticsType(t?.Type ?? t?.type); typeMap[v] = (typeMap[v] || 0) + 1; });
    catSource.forEach((t) => { const v = normalizeAnalyticsCategory(t?.Category ?? t?.category); catMap[v] = (catMap[v] || 0) + 1; });
    siteSource.forEach((t) => { const v = normalizeAnalyticsSite(t?.Site ?? t?.site); sessionSiteMap[v] = (sessionSiteMap[v] || 0) + 1; });

    const stats = ALL_DEPARTMENTS.map((d) => statsMap.get(d));
    const maxTotal = Math.max(1, ...stats.map((item) => item.total));

    return {
      closedCount: closed, openCount: open, satisfiedCount: satisfied, unsatisfiedCount: unsatisfied,
      departmentChartData: { stats, maxTotal },
      typeData: Object.entries(typeMap).map(([label, value]) => ({ label, value })),
      categoryData: Object.entries(catMap).map(([label, value]) => ({ label, value })),
      siteData: Object.entries(sessionSiteMap).map(([label, value]) => ({ label, value })),
    };
  }, [visibleTickets, ticketsFilteredByDate, applyFilters, parentFilterType]);

  const slaByAdminAndPriority = useMemo(() => {
    // Admin section: parent → immune to other filters. Non-parent → visibleTickets.
    const slaSource = parentFilterType === "admin"
      ? applyFilters(ticketsFilteredByDate, new Set(["admin"]))
      : visibleTickets;
    const closedTickets = slaSource.filter((t) => t?.closed_at);

    const adminMap = {};

    closedTickets.forEach((ticket) => {
      const assignees = [ticket?.Assignee1, ticket?.Assignee2, ticket?.Assignee3].filter(Boolean);
      const priority = normalizePriorityLabel(ticket);
      const minutes = durationMinutesFromSeconds(ticket?.timer_duration_seconds);

      if (assignees.length === 0) return;

      assignees.forEach(assigneeId => {
        if (!adminMap[assigneeId]) {
          const admin = adminUsers.find(a => a.id === assigneeId);
          adminMap[assigneeId] = {
            adminId: assigneeId,
            adminName: admin?.full_name || `Unknown Admin (${assigneeId})`,
            totalCount: 0,
            byPriority: { Low: { count: 0, avgMinutes: 0 }, Medium: { count: 0, avgMinutes: 0 }, High: { count: 0, avgMinutes: 0 } }
          };
        }

        if (priority && minutes != null) {
          const p = adminMap[assigneeId].byPriority[priority];
          p.avgMinutes = (p.avgMinutes * p.count + minutes) / (p.count + 1);
          p.count += 1;
          adminMap[assigneeId].totalCount += 1;
        }
      });
    });

    let result = Object.values(adminMap);

    if (!isGlobalAdminUser) {
      result = result.filter((a) => a.adminId === currentUserId);
    }

    return result;
  }, [visibleTickets, ticketsFilteredByDate, applyFilters, parentFilterType, currentUserId, isGlobalAdminUser, adminUsers]);

  const formatFilterDate = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-");
    if (!y || !m || !d) return "";
    return `${m}/${d}/${y.slice(-2)}`;
  };

  const handleDatePillClick = (e) => {
    const pill = e.currentTarget;
    const input = pill.querySelector('input[type="date"]');
    if (!input) return;
    if (typeof input.showPicker === "function") { input.showPicker(); input.focus(); return; }
    input.focus();
    input.click();
  };

  const handleDeptBarClick = useCallback((v) => makeToggleHandler(setSelectedDepts, "dept", selectedDepts)(v), [makeToggleHandler, selectedDepts]);
  const handleStatusClick = useCallback((v) => makeToggleHandler(setSelectedStatuses, "status", selectedStatuses)(v), [makeToggleHandler, selectedStatuses]);
  const handleTypeClick = useCallback((v) => makeToggleHandler(setSelectedTypes, "type", selectedTypes)(v), [makeToggleHandler, selectedTypes]);
  const handleCategoryClick = useCallback((v) => makeToggleHandler(setSelectedCategories, "category", selectedCategories)(v), [makeToggleHandler, selectedCategories]);
  const handleSiteClick = useCallback((v) => makeToggleHandler(setSelectedSites, "site", selectedSites)(v), [makeToggleHandler, selectedSites]);
  const handleAdminClick = useCallback((v) => makeToggleHandler(setSelectedAdminIds, "admin", selectedAdminIds)(v), [makeToggleHandler, selectedAdminIds]);

  const activeFilters = useMemo(() => [
    ...[...selectedStatuses].map((s) => ({ key: `status-${s}`, label: s, clear: () => handleStatusClick(s) })),
    ...[...selectedAdminIds].map((id) => ({ key: `admin-${id}`, label: adminUsers.find((a) => a.id === id)?.full_name || id, clear: () => handleAdminClick(id) })),
    ...[...selectedTypes].map((v) => ({ key: `type-${v}`, label: v, clear: () => handleTypeClick(v) })),
    ...[...selectedCategories].map((v) => ({ key: `cat-${v}`, label: v, clear: () => handleCategoryClick(v) })),
    ...[...selectedSites].map((v) => ({ key: `site-${v}`, label: v, clear: () => handleSiteClick(v) })),
    ...[...selectedDepts].map((v) => ({ key: `dept-${v}`, label: v, clear: () => handleDeptBarClick(v) })),
  ], [selectedStatuses, selectedAdminIds, selectedTypes, selectedCategories, selectedSites, selectedDepts, adminUsers, handleStatusClick, handleAdminClick, handleTypeClick, handleCategoryClick, handleSiteClick, handleDeptBarClick]);

  const onExportCsv = useCallback(() => {
    const headers = ["id", "summary", "description", "department", "type", "category", "priority", "site", "status", "created_at", "closed_at"];
    const rows = visibleTickets.map((t) => [t.id, t.Summary, t.Description, t.Department, t.Type, t.Category, t.Priority ?? t.priority ?? "", t.Site, t.status || t.Status || "Open", t.created_at, t.closed_at]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [visibleTickets]);

  const fetchTickets = useCallback(async () => {
    try {
      showLoading();
      setError("");
      const { data, error: supaError } = await realtimeSupabase
        .from("Tickets")
        .select("id,status,closed_at,created_at,Department,Type,Category,Priority,Summary,Description,Site,timer_duration_seconds,satisfaction,Assignee1,Assignee2,Assignee3")
        .order("id", { ascending: false });

      if (supaError) { setError(supaError.message || "Failed to load analytics"); setTickets([]); return; }
      setTickets(data || []);
    } catch (e) {
      setError(e?.message || "Failed to load analytics");
    } finally {
      hideLoading();
    }
  }, [showLoading, hideLoading]);

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    if (Array.isArray(adminTickets)) { setTickets(adminTickets); return; }

    fetchTickets();
  }, [isLoggedIn, isAdmin, adminTickets, fetchTickets]);

  useEffect(() => {
    setSelectedDepts(new Set());
    setSelectedStatuses(new Set());
    setSelectedTypes(new Set());
    setSelectedCategories(new Set());
    setSelectedSites(new Set());
    setSelectedAdminIds(new Set());
    setParentFilterType(null);
  }, [fromDate, toDate]);

  const exportAction = useMemo(() => <NavbarActionButton icon={Download} label="Export CSV" onClick={onExportCsv} />, [onExportCsv]);
  useNavbarActions(exportAction);

  if (!isLoggedIn) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/Tickets" replace />;

  return (
    <div className="w-full min-h-screen bg-[#f9fafb] dark:bg-zinc-950 font-[family:var(--font-poppins)] pt-6 pb-12">
      <section className="max-w-[1600px] mx-auto px-4 md:px-6">
        {error ? (
          <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">{error}</div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-end">
              <div
                className="relative group flex-1 sm:flex-none cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-[170px] text-[13px] font-medium text-gray-700 dark:text-zinc-300 shadow-sm hover:border-[var(--color-lpu-maroon)] dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/20"
                role="button" tabIndex={0}
                onClick={handleDatePillClick}
                onKeyDown={(e) => e.key === "Enter" && handleDatePillClick({ currentTarget: e.currentTarget })}
              >
                <span className="relative z-10 pointer-events-none">{fromDate ? `From ${formatFilterDate(fromDate)}` : "From MM/DD/YY"}</span>
                <Calendar className="w-4 h-4 text-gray-400 group-hover:text-[var(--color-lpu-maroon)]" />
                <input type="date" className="absolute inset-0 opacity-0 cursor-pointer z-20" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div
                className="relative group flex-1 sm:flex-none cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-[170px] text-[13px] font-medium text-gray-700 dark:text-zinc-300 shadow-sm hover:border-[var(--color-lpu-maroon)] dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/20"
                role="button" tabIndex={0}
                onClick={handleDatePillClick}
                onKeyDown={(e) => e.key === "Enter" && handleDatePillClick({ currentTarget: e.currentTarget })}
              >
                <span className="relative z-10 pointer-events-none">{toDate ? `To ${formatFilterDate(toDate)}` : "To MM/DD/YY"}</span>
                <Calendar className="w-4 h-4 text-gray-400 group-hover:text-[var(--color-lpu-maroon)]" />
                <input type="date" className="absolute inset-0 opacity-0 cursor-pointer z-20" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={f.clear}
                  className="px-3 py-2 text-xs font-semibold text-white bg-[var(--color-lpu-maroon)] rounded-lg hover:bg-[var(--color-lpu-red)] whitespace-nowrap"
                >
                  ✕ {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.8fr] gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-5 md:p-7 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">Total Tickets</h3>
                  <div className="flex-1 flex items-center justify-center">
                    <MultiRingDonutChart
                      closedCount={closedCount}
                      openCount={openCount}
                      satisfiedCount={satisfiedCount}
                      unsatisfiedCount={unsatisfiedCount}
                      total={closedCount + openCount}
                      selectedStatuses={selectedStatuses}
                      onStatusClick={handleStatusClick}
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-5 md:p-7">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">Tickets by Department</h3>
                  <VerticalBarGraph
                    chartData={departmentChartData}
                    selectedDepts={selectedDepts}
                    onBarClick={handleDeptBarClick}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.8fr] gap-6 items-stretch">
                <div className="h-full">
                  <SlaSection
                    slaData={slaByAdminAndPriority}
                    currentUserId={currentUserId}
                    isGlobalAdminUser={isGlobalAdminUser}
                    selectedAdminIds={selectedAdminIds}
                    onAdminClick={handleAdminClick}
                  />
                </div>

                <div className="flex flex-col gap-4 h-full">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Breakdown</h3>
                    {activeFilters.length > 0 && <span className="text-xs font-semibold text-[var(--color-lpu-maroon)] bg-[var(--color-lpu-maroon)]/10 px-2 py-1 rounded-md">{activeFilters.length} filter{activeFilters.length > 1 ? "s" : ""} active</span>}
                  </div>

                  <div className="flex-1 flex flex-col gap-3">
                    <StackedDistributionBar title="By Type" data={typeData} selectedValues={selectedTypes} onSegmentClick={handleTypeClick} />
                    <StackedDistributionBar title="By Category" data={categoryData} selectedValues={selectedCategories} onSegmentClick={handleCategoryClick} />
                    <StackedDistributionBar title="By Site" data={siteData} selectedValues={selectedSites} onSegmentClick={handleSiteClick} />
                  </div>

                  <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-500 dark:text-zinc-400 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/20">
                    <div className="bg-blue-500 text-white rounded-full p-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                    </div>
                    <span>Each bar represents 100% of the total for the specific group. Numbers may not add up in the chart due to rounding.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
