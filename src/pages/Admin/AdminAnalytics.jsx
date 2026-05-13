import { useEffect, useMemo, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import {
  Download, Calendar, Users,
  Target, Building2, Timer, LayoutList,
  ArrowDown, Minus, Flame,
  Tag, MapPin, UserSquare2, X,
} from "lucide-react";
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
  "#3b82f6",
  "#fbbf24",
  "#22c55e",
  "#06b6d4",
  "#f97316",
  "#a855f7",
  "#ec4899",
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

// ─── Card wrapper ───────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-xl shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Card header row ─────────────────────────────────────────────────────────
function CardHeader({ icon: Icon, title, aside }) {
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-2.5 border-b border-gray-100 dark:border-white/5">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-lpu-maroon/8 dark:bg-lpu-maroon/15">
          <Icon className="w-3.5 h-3.5 text-lpu-maroon" strokeWidth={2} />
        </span>
        <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-zinc-100">{title}</h3>
      </div>
      {aside && <div>{aside}</div>}
    </div>
  );
}

// ─── Donut ───────────────────────────────────────────────────────────────────
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
      className="cursor-pointer transition-all duration-150"
      style={{ opacity: isSelected ? 1 : 0.85 }}
    />
  );
}

function MultiRingDonutChart({ closedCount, openCount, satisfiedCount, unsatisfiedCount, total, selectedStatuses = new Set(), onStatusClick }) {
  const feedbackTotal = satisfiedCount + unsatisfiedCount;
  const cx = 110, cy = 110;
  const outerR = 92, innerR = 70, sw = 18;
  const outerCirc = 2 * Math.PI * outerR;
  const innerCirc = 2 * Math.PI * innerR;
  const satisfiedDash = feedbackTotal > 0 ? (satisfiedCount / feedbackTotal) * outerCirc : 0;
  const closedDash = total > 0 ? (closedCount / total) * innerCirc : 0;

  const legendItems = [
    { key: "satisfied", color: COLORS.satisfied, label: "Satisfied", count: satisfiedCount },
    { key: "unsatisfied", color: COLORS.unsatisfied, label: "Unsatisfied", count: unsatisfiedCount },
    { key: "closed", color: COLORS.closed, label: "Closed", count: closedCount },
    { key: "open", color: COLORS.open, label: "Open", count: openCount },
  ];
  const anySelected = selectedStatuses.size > 0;

  return (
    <div className="flex flex-row items-center gap-4">
      <svg width="190" height="190" viewBox="0 0 220 220" className="shrink-0">
        <g transform="rotate(-90, 110, 110)">
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#f3f4f6" strokeWidth={sw} className="dark:stroke-zinc-800" />
          <DonutSegment cx={cx} cy={cy} r={outerR} strokeWidth={sw} color={COLORS.satisfied}
            value={satisfiedCount} total={feedbackTotal} startOffset={0}
            isSelected={selectedStatuses.has("satisfied")}
            onClick={() => onStatusClick?.("satisfied")} />
          <DonutSegment cx={cx} cy={cy} r={outerR} strokeWidth={sw} color={COLORS.unsatisfied}
            value={unsatisfiedCount} total={feedbackTotal} startOffset={satisfiedDash}
            isSelected={selectedStatuses.has("unsatisfied")}
            onClick={() => onStatusClick?.("unsatisfied")} />
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#f3f4f6" strokeWidth={sw} className="dark:stroke-zinc-800" />
          <DonutSegment cx={cx} cy={cy} r={innerR} strokeWidth={sw} color={COLORS.closed}
            value={closedCount} total={total} startOffset={0}
            isSelected={selectedStatuses.has("closed")}
            onClick={() => onStatusClick?.("closed")} />
          <DonutSegment cx={cx} cy={cy} r={innerR} strokeWidth={sw} color={COLORS.open}
            value={openCount} total={total} startOffset={closedDash}
            isSelected={selectedStatuses.has("open")}
            onClick={() => onStatusClick?.("open")} />
        </g>
        <circle cx={cx} cy={cy} r={innerR - sw / 2 - 2} fill="white" className="dark:fill-zinc-900" />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="32" fontWeight="700" fill="#111111" className="dark:fill-zinc-100">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="#9ca3af" letterSpacing="2">TOTAL</text>
      </svg>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {legendItems.map(({ key, color, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => onStatusClick?.(key)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-all duration-150 border w-full ${
              anySelected && !selectedStatuses.has(key)
                ? "opacity-40 border-transparent"
                : selectedStatuses.has(key)
                ? "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800 shadow-sm"
                : "border-transparent hover:border-gray-100 dark:hover:border-white/5 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">{label}</span>
            <span className="ml-auto text-xs font-bold text-gray-900 dark:text-zinc-100">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Vertical bar graph ───────────────────────────────────────────────────────
function VerticalBarGraph({ chartData, selectedDepts = new Set(), onBarClick }) {
  const { stats = [], maxTotal = 1 } = chartData || {};

  return (
    <div className="h-full flex flex-col gap-2" aria-label="Tickets by department bar chart">
      <div className="flex-1 min-h-0 grid grid-cols-3 md:grid-cols-6 gap-2 py-1">
        {stats.map((item) => {
          const isEmpty = item.total === 0;
          const isSelected = selectedDepts.has(item.department);
          const satisfiedHeight = isEmpty ? 0 : (item.satisfied / maxTotal) * 100;
          const unsatisfiedHeight = isEmpty ? 0 : (item.unsatisfied / maxTotal) * 100;
          const closedHeight = isEmpty ? 0 : (item.closed / maxTotal) * 100;
          const openHeight = isEmpty ? 0 : (item.open / maxTotal) * 100;

          return (
            <div
              key={item.department}
              role={!isEmpty && onBarClick ? "button" : undefined}
              tabIndex={!isEmpty && onBarClick ? 0 : undefined}
              onClick={() => { if (!isEmpty && onBarClick) onBarClick(item.department); }}
              onKeyDown={(e) => { if (!isEmpty && onBarClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onBarClick(item.department); } }}
              className={`group flex flex-col items-center gap-1.5 w-full h-full transition-all duration-150 outline-none ${!isEmpty && onBarClick ? "cursor-pointer" : ""}`}
            >
              <span className={`shrink-0 text-sm font-bold tabular-nums transition-colors duration-150 ${isSelected ? "text-lpu-maroon" : "text-gray-800 dark:text-zinc-200"}`}>
                {item.total}
              </span>

              <div
                className={`flex-1 min-h-0 w-full flex transition-all duration-150 ${
                  isSelected
                    ? "ring-2 ring-lpu-maroon ring-offset-2 dark:ring-offset-zinc-900 rounded-lg"
                    : !isEmpty && onBarClick
                    ? "group-hover:scale-[1.03]"
                    : ""
                }`}
              >
                {/* Left bar: satisfied / unsatisfied */}
                <div className={`flex-1 h-full flex flex-col-reverse rounded-l-lg overflow-hidden relative transition-all duration-150 ${
                  isEmpty
                    ? "bg-gray-50 dark:bg-zinc-800/30 border border-dashed border-gray-200 dark:border-white/8"
                    : "bg-gray-100 dark:bg-zinc-800/60"
                }`}>
                  {!isEmpty && (
                    <>
                      <div className="w-full bg-[#22c55e] transition-all duration-300" style={{ height: `${satisfiedHeight}%` }} />
                      <div className="w-full bg-[#f43f5e] transition-all duration-300" style={{ height: `${unsatisfiedHeight}%` }} />
                    </>
                  )}
                </div>

                {/* Right bar: closed / open */}
                <div className={`flex-1 h-full flex flex-col-reverse rounded-r-lg overflow-hidden relative transition-all duration-150 ${
                  isEmpty
                    ? "bg-gray-50 dark:bg-zinc-800/30 border border-dashed border-gray-200 dark:border-white/8"
                    : "bg-gray-100 dark:bg-zinc-800/60"
                }`}>
                  {!isEmpty && (
                    <>
                      <div className="w-full bg-[#336be3] transition-all duration-300" style={{ height: `${closedHeight}%` }} />
                      <div className="w-full bg-[#e6bc23] transition-all duration-300" style={{ height: `${openHeight}%` }} />
                    </>
                  )}
                </div>
              </div>

              <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide text-center transition-colors duration-150 ${isSelected ? "text-lpu-maroon" : "text-gray-400 dark:text-zinc-500"}`}>
                {item.department}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 justify-center pt-2 border-t border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-[#22c55e]" />Satisfied
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />Unsatisfied
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-[#336be3]" />Closed
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-[#e6bc23]" />Open
        </div>
      </div>
    </div>
  );
}

// ─── Stacked distribution bar ─────────────────────────────────────────────────
const BREAKDOWN_ICONS = {
  "By Type": UserSquare2,
  "By Category": Tag,
  "By Site": MapPin,
};

function StackedDistributionBar({ title, data, selectedValues = new Set(), onSegmentClick }) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const TitleIcon = BREAKDOWN_ICONS[title];

  return (
    <div className="bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-white/5 rounded-xl p-2.5 mb-1.5 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        {TitleIcon && <TitleIcon className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" strokeWidth={2} />}
        <h4 className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">{title}</h4>
      </div>

      {/* Rounded segmented bar */}
      <div className="w-full h-5 bg-gray-200/60 dark:bg-zinc-700/40 rounded-full overflow-hidden flex">
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
              className={`h-full flex items-center justify-center text-white text-[10px] font-bold cursor-pointer outline-none transition-all duration-150 border-r border-white/15 last:border-0 ${
                isSelected ? "brightness-110" : "hover:brightness-110"
              }`}
              style={{ width: `${percentage}%`, backgroundColor: color }}
            >
              {percentage > 8 && (
                <span className="truncate px-1">{Math.round(percentage)}%</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-y-1">
        {data.map((item, idx) => {
          const isSelected = selectedValues.has(item.label);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onSegmentClick?.(item.label)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium cursor-pointer transition-all duration-150 ${
                isSelected
                  ? "bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-lpu-maroon/40 text-gray-800 dark:text-zinc-200"
                  : "text-gray-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900/60 hover:text-gray-700 dark:hover:text-zinc-300"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: DISTRIBUTION_COLORS[idx % DISTRIBUTION_COLORS.length] }} />
              {item.label}
              <span className="font-bold text-gray-700 dark:text-zinc-300">{item.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SLA section ──────────────────────────────────────────────────────────────
const PRIORITY_META = {
  Low:    { icon: ArrowDown, color: COLORS.slaLow,    bg: "bg-green-50 dark:bg-green-950/30",    text: "text-green-700 dark:text-green-400" },
  Medium: { icon: Minus,     color: COLORS.slaMedium,  bg: "bg-yellow-50 dark:bg-yellow-950/30",  text: "text-yellow-700 dark:text-yellow-400" },
  High:   { icon: Flame,     color: COLORS.slaHigh,    bg: "bg-red-50 dark:bg-red-950/30",        text: "text-red-700 dark:text-red-400" },
};

function SlaSection({ slaData, currentUserId, isGlobalAdminUser, selectedAdminIds = new Set(), onAdminClick, className = "" }) {
  const sortedAdmins = useMemo(() => {
    return [...(slaData || [])].sort((a, b) => {
      if (a.adminId === currentUserId) return -1;
      if (b.adminId === currentUserId) return 1;
      return 0;
    });
  }, [slaData, currentUserId]);

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader icon={Timer} title="Resolution Time" />

      <div className="px-4 py-3 flex-1 min-h-0 overflow-y-auto">
        {sortedAdmins.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500 py-6 text-center">No SLA data available</p>
        ) : (
          <div className="space-y-2">
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
                  className={`rounded-xl p-3 transition-all duration-150 border ${
                    isSelected
                      ? "ring-2 ring-lpu-maroon ring-offset-1 bg-lpu-maroon/5 border-lpu-maroon/20"
                      : isCurrentUser
                      ? "bg-lpu-maroon/4 border-lpu-maroon/15"
                      : "bg-gray-50 dark:bg-zinc-800/40 border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10"
                  } ${isGlobalAdminUser ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" strokeWidth={2} />
                    <span className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                      {adminEntry.adminName || "Unknown Admin"}
                    </span>
                    {isCurrentUser && (
                      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-lpu-maroon/10 text-lpu-maroon">
                        You
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {SLA_PRIORITY_ORDER.map((priority) => {
                      const stat = adminEntry.byPriority[priority] || { count: 0, avgMinutes: 0 };
                      const { icon: PIcon, bg, text } = PRIORITY_META[priority];
                      return (
                        <div key={priority} className={`flex flex-col items-center gap-1 p-2 rounded-lg ${bg}`}>
                          <div className="flex items-center gap-1">
                            <PIcon className={`w-3 h-3 ${text}`} strokeWidth={2.5} />
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${text}`}>{priority}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
                            {stat.count > 0 ? formatMinutesOneDecimal(stat.avgMinutes) : "—"}
                          </span>
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
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
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
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to fetch admin users");
        const data = await response.json();
        setAdminUsers(data.data);
      } catch (err) {
        console.error("Error fetching admin users:", err);
      }
    };
    if (isLoggedIn && isAdmin) fetchAdminUsers();
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

  const visibleTickets = useMemo(() => applyFilters(ticketsFilteredByDate), [ticketsFilteredByDate, applyFilters]);

  const { closedCount, openCount, satisfiedCount, unsatisfiedCount, departmentChartData, typeData, categoryData, siteData } = useMemo(() => {
    const donutSource = parentFilterType === "status"
      ? applyFilters(ticketsFilteredByDate, new Set(["status"]))
      : visibleTickets;
    const closed = donutSource.filter((t) => isClosed(t)).length;
    const open = donutSource.length - closed;
    const satisfied = donutSource.filter((t) => t?.satisfaction === true).length;
    const unsatisfied = donutSource.filter((t) => t?.satisfaction === false).length;

    const deptSource = parentFilterType === "dept"
      ? ticketsFilteredByDate
      : applyFilters(ticketsFilteredByDate, new Set(["dept"]));
    const statsMap = new Map();
    ALL_DEPARTMENTS.forEach((d) => statsMap.set(d, { department: d, total: 0, open: 0, closed: 0, satisfied: 0, unsatisfied: 0 }));
    deptSource.forEach((ticket) => {
      const dept = normalizeDepartment(ticket?.Department);
      if (dept && statsMap.has(dept)) {
        const stat = statsMap.get(dept);
        stat.total += 1;
        if (isClosed(ticket)) stat.closed += 1;
        else stat.open += 1;
        if (ticket?.satisfaction === true) stat.satisfied += 1;
        if (ticket?.satisfaction === false) stat.unsatisfied += 1;
      }
    });

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
    if (!isGlobalAdminUser) result = result.filter((a) => a.adminId === currentUserId);
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
    <section className="w-full max-w-330 mx-auto px-6 h-[calc(100dvh-3rem)] overflow-hidden flex flex-col py-3 pb-4 font-(--font-poppins)">
        {error ? (
          <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900">
            {error}
          </div>
        ) : (
          <div className="flex flex-col gap-2 flex-1 min-h-0">

            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              {/* Left: active filter chips */}
              <div className="flex flex-wrap gap-2 items-center min-h-9">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={f.clear}
                    className="flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-white bg-lpu-maroon rounded-xl hover:bg-lpu-red transition-colors duration-150 whitespace-nowrap"
                  >
                    <X className="w-3 h-3" strokeWidth={2.5} />
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Right: date filters */}
              <div className="flex gap-2 items-center shrink-0">
                <div
                  className="relative group cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/8 rounded-xl px-4 h-9 flex items-center gap-2.5 min-w-37 text-[13px] font-medium text-gray-600 dark:text-zinc-300 shadow-sm hover:border-lpu-maroon/50 transition-colors duration-150 focus-within:ring-2 focus-within:ring-lpu-maroon/20"
                  role="button" tabIndex={0}
                  onClick={handleDatePillClick}
                  onKeyDown={(e) => e.key === "Enter" && handleDatePillClick({ currentTarget: e.currentTarget })}
                >
                  <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
                  <span className="relative z-10 pointer-events-none">
                    {fromDate ? `From ${formatFilterDate(fromDate)}` : "From date"}
                  </span>
                  <input type="date" className="absolute inset-0 opacity-0 cursor-pointer z-20" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div
                  className="relative group cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/8 rounded-xl px-4 h-9 flex items-center gap-2.5 min-w-37 text-[13px] font-medium text-gray-600 dark:text-zinc-300 shadow-sm hover:border-lpu-maroon/50 transition-colors duration-150 focus-within:ring-2 focus-within:ring-lpu-maroon/20"
                  role="button" tabIndex={0}
                  onClick={handleDatePillClick}
                  onKeyDown={(e) => e.key === "Enter" && handleDatePillClick({ currentTarget: e.currentTarget })}
                >
                  <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
                  <span className="relative z-10 pointer-events-none">
                    {toDate ? `To ${formatFilterDate(toDate)}` : "To date"}
                  </span>
                  <input type="date" className="absolute inset-0 opacity-0 cursor-pointer z-20" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── 2-column layout ── */}
            <div className="flex-1 min-h-0 flex gap-2">

              {/* Left column: Total Tickets (natural height) + Resolution Time (fills rest) */}
              <div className="w-[35%] shrink-0 flex flex-col gap-2 min-h-0">
                <Card className="shrink-0 flex flex-col">
                  <CardHeader icon={Target} title="Total Tickets" />
                  <div className="flex items-center justify-center px-4 py-3">
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
                </Card>
                <SlaSection
                  slaData={slaByAdminAndPriority}
                  currentUserId={currentUserId}
                  isGlobalAdminUser={isGlobalAdminUser}
                  selectedAdminIds={selectedAdminIds}
                  onAdminClick={handleAdminClick}
                  className="flex-1 min-h-0"
                />
              </div>

              {/* Right column: Department (stretches) + Breakdown (natural height) */}
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                <Card className="flex-1 min-h-0 flex flex-col">
                  <CardHeader icon={Building2} title="Tickets by Department" />
                  <div className="flex-1 min-h-0 flex flex-col px-4 py-3">
                    <VerticalBarGraph
                      chartData={departmentChartData}
                      selectedDepts={selectedDepts}
                      onBarClick={handleDeptBarClick}
                    />
                  </div>
                </Card>
                <Card className="shrink-0 flex flex-col">
                  <CardHeader icon={LayoutList} title="Breakdown" />
                  <div className="px-4 py-3 flex flex-col gap-1">
                    <StackedDistributionBar title="By Type" data={typeData} selectedValues={selectedTypes} onSegmentClick={handleTypeClick} />
                    <StackedDistributionBar title="By Category" data={categoryData} selectedValues={selectedCategories} onSegmentClick={handleCategoryClick} />
                    <StackedDistributionBar title="By Site" data={siteData} selectedValues={selectedSites} onSegmentClick={handleSiteClick} />
                  </div>
                </Card>
              </div>

            </div>

          </div>
        )}
    </section>
  );
}
