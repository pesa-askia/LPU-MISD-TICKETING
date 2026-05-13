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

function MultiRingDonutChart({ closedCount, openCount, satisfiedCount, unsatisfiedCount, total }) {
  const feedbackTotal = satisfiedCount + unsatisfiedCount;
  const closedAngle = total > 0 ? (closedCount / total) * 360 : 0;
  const openAngle = total > 0 ? (openCount / total) * 360 : 0;
  const satisfiedAngle = feedbackTotal > 0 ? (satisfiedCount / feedbackTotal) * 360 : 0;
  const unsatisfiedAngle = feedbackTotal > 0 ? (unsatisfiedCount / feedbackTotal) * 360 : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-48 h-48 md:w-56 md:h-56">
        <div
          className="absolute inset-0 rounded-full shadow-inner"
          style={{
            background: `conic-gradient(
              ${COLORS.satisfied} 0deg ${satisfiedAngle}deg,
              ${COLORS.unsatisfied} ${satisfiedAngle}deg ${satisfiedAngle + unsatisfiedAngle}deg,
              transparent ${satisfiedAngle + unsatisfiedAngle}deg 360deg
            )`,
          }}
        />
        <div
          className="absolute inset-[18px] rounded-full shadow-md"
          style={{
            background: `conic-gradient(
              ${COLORS.closed} 0deg ${closedAngle}deg,
              ${COLORS.open} ${closedAngle}deg ${closedAngle + openAngle}deg,
              transparent ${closedAngle + openAngle}deg 360deg
            )`,
          }}
        />
        <div className="absolute inset-[36px] rounded-full bg-white dark:bg-zinc-900 shadow-md grid place-items-center">
          <div className="text-center">
            <span className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-zinc-100">{total}</span>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-medium">TOTAL</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.satisfied }} />Satisfied<span className="font-bold text-gray-900 dark:text-zinc-100">{satisfiedCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.unsatisfied }} />Not<span className="font-bold text-gray-900 dark:text-zinc-100">{unsatisfiedCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.closed }} />Closed<span className="font-bold text-gray-900 dark:text-zinc-100">{closedCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.open }} />Open<span className="font-bold text-gray-900 dark:text-zinc-100">{openCount}</span>
        </div>
      </div>
    </div>
  );
}

function VerticalBarGraph({ chartData, selectedDept, onBarClick }) {
  const { stats = [], maxTotal = 1 } = chartData || {};

  return (
    <div className="flex flex-col gap-3" aria-label="Tickets by department bar chart">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end min-h-[200px] py-3">
        {stats.map((item) => {
          const isEmpty = item.total === 0;
          const isSelected = selectedDept === item.department;
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
                  className={`w-full max-w-[70px] xl:max-w-[90px] h-[180px] flex flex-col-reverse rounded-lg overflow-hidden border relative transition-all duration-300 ease-out ${isSelected ? "ring-2 ring-[var(--color-lpu-maroon)] ring-offset-2 dark:ring-offset-zinc-900" : ""} ${!isEmpty && onBarClick ? "hover:-translate-y-1 hover:shadow-lg group-hover:border-[var(--color-lpu-maroon)]/30" : ""} ${isEmpty ? "bg-gray-50 dark:bg-zinc-900/50 border-dashed border-gray-300 dark:border-white/10" : "bg-[#f7f8fc] dark:bg-zinc-800/50 border-gray-200 dark:border-white/10"}`}
                >
                  {!isEmpty ? (
                    <>
                      <div className="w-full bg-[#336be3] transition-all duration-500 ease-out pointer-events-none" style={{ height: `${closedHeight}%` }} />
                      <div className="w-full bg-[#e6bc23] transition-all duration-500 ease-out pointer-events-none" style={{ height: `${openHeight}%` }} />
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

function StackedDistributionBar({ title, data }) {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm p-3 md:p-4 mb-3 last:mb-0">
      <h4 className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{title}</h4>

      {/* The Stacked Bar */}
      <div className="w-full h-8 md:h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex shadow-inner">
        {data.map((item, idx) => {
          if (item.value === 0) return null;
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const color = DISTRIBUTION_COLORS[idx % DISTRIBUTION_COLORS.length];

          return (
            <div
              key={item.label}
              className="h-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold transition-all duration-500 ease-out border-r border-white/10 last:border-0"
              style={{
                width: `${percentage}%`,
                backgroundColor: color,
              }}
            >
              <span className="truncate px-1">
                {item.value} ({Math.round(percentage)}%)
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend & Total */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {data.map((item, idx) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: DISTRIBUTION_COLORS[idx % DISTRIBUTION_COLORS.length] }}
              />
              <span className="text-[10px] md:text-[11px] font-medium text-gray-600 dark:text-zinc-400">
                {item.label} <span className="text-gray-900 dark:text-zinc-200 font-bold">({item.value})</span>
              </span>
            </div>
          ))}
        </div>
        <div className="text-[10px] md:text-[11px] font-bold text-gray-900 dark:text-zinc-200">
          Total: {total}
        </div>
      </div>
    </div>
  );
}

function SlaSection({ slaData, currentUserId, isGlobalAdminUser }) {
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
              {isGlobalAdminUser ? "All admins" : "Your data only"}
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
              return (
                <div key={adminEntry.adminId} className={`rounded-lg p-3 ${isCurrentUser ? "bg-[var(--color-lpu-maroon)]/5 border border-[var(--color-lpu-maroon)]/20" : "bg-gray-50 dark:bg-zinc-800/50"}`}>
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
  const [selectedDept, setSelectedDept] = useState(null);

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

  const visibleTickets = useMemo(() => {
    let filtered = ticketsFilteredByDate;
    if (selectedDept) {
      filtered = filtered.filter((t) => (t?.Department || "").trim() === selectedDept);
    }
    return filtered;
  }, [ticketsFilteredByDate, selectedDept]);

  const { closedCount, openCount, satisfiedCount, unsatisfiedCount, departmentChartData, typeData, categoryData, siteData } = useMemo(() => {
    const closed = visibleTickets.filter((t) => isClosed(t)).length;
    const open = visibleTickets.length - closed;
    const satisfied = visibleTickets.filter((t) => t?.satisfaction === true).length;
    const unsatisfied = visibleTickets.filter((t) => t?.satisfaction === false).length;

    const statsMap = new Map();
    ALL_DEPARTMENTS.forEach((dept) => statsMap.set(dept, { department: dept, total: 0, open: 0, closed: 0 }));

    // IMPORTANT: Department chart should use tickets filtered by date but NOT by department
    // so that other bars don't disappear when one is selected.
    ticketsFilteredByDate.forEach((ticket) => {
      const dept = (ticket?.Department || "").trim();
      if (dept && statsMap.has(dept)) {
        const stat = statsMap.get(dept);
        stat.total += 1;
        if (isClosed(ticket)) stat.closed += 1;
        else stat.open += 1;
      }
    });

    const typeMap = {};
    const catMap = {};
    const sessionSiteMap = {}; // renamed to avoid confusion
    ANALYTICS_TYPE_ORDER.forEach((t) => (typeMap[t] = 0));
    ANALYTICS_CATEGORY_ORDER.forEach((c) => (catMap[c] = 0));
    ANALYTICS_SITE_ORDER.forEach((s) => (sessionSiteMap[s] = 0));

    visibleTickets.forEach((ticket) => {
      const type = normalizeAnalyticsType(ticket?.Type ?? ticket?.type);
      typeMap[type] = (typeMap[type] || 0) + 1;

      const cat = normalizeAnalyticsCategory(ticket?.Category ?? ticket?.category);
      catMap[cat] = (catMap[cat] || 0) + 1;

      const site = normalizeAnalyticsSite(ticket?.Site ?? ticket?.site);
      sessionSiteMap[site] = (sessionSiteMap[site] || 0) + 1;
    });

    const stats = ALL_DEPARTMENTS.map((dept) => statsMap.get(dept));
    const maxTotal = Math.max(1, ...stats.map((item) => item.total));

    const typeChartData = Object.entries(typeMap).map(([label, value]) => ({ label, value }));
    const categoryChartData = Object.entries(catMap).map(([label, value]) => ({ label, value }));
    const siteChartData = Object.entries(sessionSiteMap).map(([label, value]) => ({ label, value }));

    return {
      closedCount: closed,
      openCount: open,
      satisfiedCount: satisfied,
      unsatisfiedCount: unsatisfied,
      departmentChartData: { stats, maxTotal },
      typeData: typeChartData,
      categoryData: categoryChartData,
      siteData: siteChartData,
    };
  }, [visibleTickets, ticketsFilteredByDate]);

  const slaByAdminAndPriority = useMemo(() => {
    const closedTickets = tickets.filter((t) => {
      if (!t?.closed_at) return false;
      if (!fromDate && !toDate) return true;
      const ymd = toYMDLocal(t.closed_at);
      if (!ymd) return false;
      if (fromDate && ymd < fromDate) return false;
      if (toDate && ymd > toDate) return false;
      return true;
    });

    const adminMap = {};

    closedTickets.forEach((ticket) => {
      const assignees = [ticket?.Assignee1, ticket?.Assignee2, ticket?.Assignee3].filter(Boolean);
      const priority = normalizePriorityLabel(ticket);
      const minutes = durationMinutesFromSeconds(ticket?.timer_duration_seconds);

      if (assignees.length === 0) {
        // Handle unassigned tickets if needed, or skip
        return;
      }

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
  }, [tickets, fromDate, toDate, currentUserId, isGlobalAdminUser, adminUsers]);

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

  const handleDeptBarClick = (department) => {
    setSelectedDept((prev) => (prev === department ? null : department));
  };

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
    setSelectedDept(null);
  }, [fromDate, toDate]);

  const exportAction = useMemo(() => <NavbarActionButton icon={Download} label="Export CSV" onClick={onExportCsv} />, [onExportCsv]);
  useNavbarActions(exportAction);

  if (!isLoggedIn) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/Tickets" replace />;

  if (!tickets.length && !error) {
    return (
      <div className="w-full min-h-screen bg-[#f9fafb] dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-lpu-maroon)] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-zinc-400 font-medium">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#f9fafb] dark:bg-zinc-950 font-[family:var(--font-poppins)] pt-6 pb-12 transition-colors duration-200">
      <section className="max-w-[1600px] mx-auto px-4 md:px-6">
        {error ? (
          <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">{error}</div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-end">
              <div
                className="relative group flex-1 sm:flex-none cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-[170px] text-[13px] font-medium text-gray-700 dark:text-zinc-300 shadow-sm transition-all hover:border-[var(--color-lpu-maroon)] dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/20"
                role="button" tabIndex={0}
                onClick={handleDatePillClick}
                onKeyDown={(e) => e.key === "Enter" && handleDatePillClick({ currentTarget: e.currentTarget })}
              >
                <span className="relative z-10 pointer-events-none">{fromDate ? `From ${formatFilterDate(fromDate)}` : "From MM/DD/YY"}</span>
                <Calendar className="w-4 h-4 text-gray-400 group-hover:text-[var(--color-lpu-maroon)] transition-colors" />
                <input type="date" className="absolute inset-0 opacity-0 cursor-pointer z-20" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div
                className="relative group flex-1 sm:flex-none cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-[170px] text-[13px] font-medium text-gray-700 dark:text-zinc-300 shadow-sm transition-all hover:border-[var(--color-lpu-maroon)] dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/20"
                role="button" tabIndex={0}
                onClick={handleDatePillClick}
                onKeyDown={(e) => e.key === "Enter" && handleDatePillClick({ currentTarget: e.currentTarget })}
              >
                <span className="relative z-10 pointer-events-none">{toDate ? `To ${formatFilterDate(toDate)}` : "To MM/DD/YY"}</span>
                <Calendar className="w-4 h-4 text-gray-400 group-hover:text-[var(--color-lpu-maroon)] transition-colors" />
                <input type="date" className="absolute inset-0 opacity-0 cursor-pointer z-20" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              {selectedDept && (
                <button
                  type="button"
                  onClick={() => setSelectedDept(null)}
                  className="px-3 py-2 text-xs font-semibold text-white bg-[var(--color-lpu-maroon)] rounded-lg hover:bg-[var(--color-lpu-red)] transition-colors"
                >
                  Clear: {selectedDept}
                </button>
              )}
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
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-5 md:p-7">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">Tickets by Department</h3>
                  <VerticalBarGraph
                    chartData={departmentChartData}
                    selectedDept={selectedDept}
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
                  />
                </div>

                <div className="flex flex-col gap-4 h-full">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Breakdown</h3>
                    {selectedDept && <span className="text-xs font-semibold text-[var(--color-lpu-maroon)] bg-[var(--color-lpu-maroon)]/10 px-2 py-1 rounded-md">Filtered: {selectedDept}</span>}
                  </div>

                  <div className="flex-1 flex flex-col gap-3">
                    <StackedDistributionBar title="By Type" data={typeData} />
                    <StackedDistributionBar title="By Category" data={categoryData} />
                    <StackedDistributionBar title="By Site" data={siteData} />
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
