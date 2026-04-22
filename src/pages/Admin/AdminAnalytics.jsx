import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { Download, ChevronDown, LogOut, Moon, Calendar, User } from "lucide-react";
import { realtimeSupabase } from "../../realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import lpuLogo from "../../assets/lpul-logo.png";
import "./AdminTickets.css";
import "./AdminAnalytics.css";
import AdminAccountSettingsModal from "./AdminAccountSettingsModal";

function getStatusValue(ticket) {
  return (
    ticket?.Status ??
    ticket?.status ??
    ticket?.state ??
    ticket?.State ??
    ""
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

function PieChart({ closedCount, openCount }) {
  const total = Math.max(closedCount + openCount, 1);
  const closedAngle = (closedCount / total) * 360;
  const openAngle = 360 - closedAngle;
  return (
    <div className="analytics-pie-wrap">
      <div
        className="analytics-pie"
        style={{
          background: `conic-gradient(#336be3 0deg ${closedAngle}deg, #e6bc23 ${closedAngle}deg ${closedAngle + openAngle
            }deg)`,
        }}
      >
        <div className="analytics-pie-inner">{closedCount + openCount}</div>
      </div>
      <div className="analytics-legend">
        <div><span className="dot closed" /> Closed: {closedCount}</div>
        <div><span className="dot open" /> Open: {openCount}</div>
      </div>
    </div>
  );
}

function DepartmentBarChart({ chartData }) {
  const { stats = [], maxTotal = 1 } = chartData || {};

  return (
    <div className="dept-chart-wrap dept-barchart-wrap" aria-label="Tickets by department bar chart">
      <div className="dept-barchart-grid">
        {stats.map((item) => {
          const isEmpty = item.total === 0;
          // If empty, show a small grey bar as visual placeholder.
          // Otherwise, calculate relative heights based on maxTotal.
          const closedHeight = isEmpty ? 0 : (item.closed / maxTotal) * 100;
          const openHeight = isEmpty ? 0 : (item.open / maxTotal) * 100;

          return (
            <div key={item.department} className="dept-bar-item">
              <div
                className={`dept-bar-stack ${isEmpty ? "dept-bar-empty" : ""}`}
                role="img"
                aria-label={`${item.department}: ${item.total} total, ${item.open} open, ${item.closed} closed`}
              >
                {!isEmpty ? (
                  <>
                    <div
                      className="dept-bar-segment dept-bar-closed"
                      style={{ height: `${closedHeight}%` }}
                      title={`Closed: ${item.closed}`}
                    />
                    <div
                      className="dept-bar-segment dept-bar-open"
                      style={{ height: `${openHeight}%` }}
                      title={`Open: ${item.open}`}
                    />
                  </>
                ) : (
                  <div className="dept-bar-placeholder" title="No tickets" />
                )}
              </div>
              <div className="dept-bar-values">
                <span className="dept-bar-total">{item.total}</span>
                {!isEmpty && (
                  <div className="dept-bar-details">
                    <span className="count-c">{item.closed}</span>
                    <span className="count-o">{item.open}</span>
                  </div>
                )}
              </div>
              <div className="dept-bar-label">{item.department}</div>
            </div>
          );
        })}
      </div>
      <div className="dept-legend">
        <div className="dept-legend-item">
          <span className="dept-legend-dot closed" />
          <span>Closed</span>
        </div>
        <div className="dept-legend-item">
          <span className="dept-legend-dot open" />
          <span>Open</span>
        </div>
      </div>
    </div>
  );
}

const ALL_DEPARTMENTS = ["CAS", "CBA", "CITHM", "COECS", "LPU-SC", "HIGHSCHOOL"];

export default function AdminAnalytics() {
  const { showLoading, hideLoading } = useLoading();
  const { adminTickets } = useTicketsCache();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const menuRef = useRef(null);

  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const role = localStorage.getItem("userRole");
  const isAdmin = role === "admin";

  const isRoot = (() => {
    try { return jwtDecode(localStorage.getItem("authToken") || "")?.admin_level === 0; }
    catch { return false; }
  })();

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("adminDarkMode") === "true",
  );

  // Date range filter: filters by `created_at` between "fromDate" and "toDate" (inclusive).
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
    const root = document.querySelector(".admin-shell");
    if (!root) return;
    root.classList.toggle("admin-dark", darkMode);
    localStorage.setItem("adminDarkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;

    // Use shared cache from AdminTickets if available — avoids a second network hit
    if (Array.isArray(adminTickets)) {
      setTickets(adminTickets);
      return;
    }

    const fetchTickets = async () => {
      try {
        showLoading();
        setError("");
        // Only fetch columns needed for analytics — skip attachments, Description, etc.
        const { data, error: supaError } = await realtimeSupabase
          .from("Tickets")
          .select("id,status,Status,closed_at,created_at,Department,Type,Category")
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
    // showLoading/hideLoading are stable context callbacks; omitting them prevents
    // an infinite re-render loop if the context ever recreates them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDatePillClick = (e) => {
    const pill = e.currentTarget;
    const input = pill.querySelector('input[type="date"]');
    if (!input) return;
    // Prefer native picker if supported.
    if (typeof input.showPicker === "function") {
      input.showPicker();
      input.focus();
      return;
    }
    input.focus();
    input.click();
  };

  const { closedCount, openCount, departmentChartData } = useMemo(() => {
    const closed = visibleTickets.filter((t) => isClosed(t)).length;
    const open = visibleTickets.length - closed;

    // 1. Initialize stats map with ALL_DEPARTMENTS at 0
    const statsMap = new Map();
    ALL_DEPARTMENTS.forEach((dept) => {
      statsMap.set(dept, { department: dept, total: 0, open: 0, closed: 0 });
    });

    // 2. Fill in the data from visibleTickets
    visibleTickets.forEach((ticket) => {
      const dept = (ticket?.Department || "").trim();
      if (!dept) return; // ignore missing/empty department

      // Only count if it's one of our fixed departments
      if (statsMap.has(dept)) {
        const stat = statsMap.get(dept);
        stat.total += 1;
        if (isClosed(ticket)) {
          stat.closed += 1;
        } else {
          stat.open += 1;
        }
      }
    });

    // 3. Keep original ALL_DEPARTMENTS order (no dynamic sorting)
    const stats = ALL_DEPARTMENTS.map((dept) => statsMap.get(dept));
    const maxTotal = Math.max(1, ...stats.map((item) => item.total));

    return {
      closedCount: closed,
      openCount: open,
      departmentChartData: {
        stats,
        maxTotal,
      },
    };
  }, [visibleTickets]);

  const onExportCsv = () => {
    const headers = [
      "id",
      "summary",
      "description",
      "department",
      "type",
      "category",
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

  const onLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    window.location.href = "/";
  };

  if (!isLoggedIn) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/Tickets" replace />;

  return (
    <div className="admin-page analytics-page">
      <header className="analytics-topbar">
        <div className="analytics-topbar-inner">
          <div className="analytics-brand" aria-label="LPU MIS Help Desk">
            <img src={lpuLogo} alt="LPU" className="analytics-brand-logo" />
            <span className="analytics-brand-text">MIS HELP DESK</span>
          </div>

          <nav className="analytics-nav-links" aria-label="Admin navigation">
            <NavLink
              to="/admin/tickets"
              className={({ isActive }) => `analytics-nav-link ${isActive ? "active" : ""}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/admin/analytics"
              className={({ isActive }) => `analytics-nav-link ${isActive ? "active" : ""}`}
            >
              Analytics
            </NavLink>
            {isRoot && (
              <NavLink
                to="/admin/manage"
                className={({ isActive }) => `analytics-nav-link ${isActive ? "active" : ""}`}
              >
                Manage
              </NavLink>
            )}
          </nav>

          <div className="analytics-actions">
            <button type="button" className="analytics-export-btn" onClick={onExportCsv}>
              <Download size={16} />
              Export CSV
            </button>

            <div className="admin-menu" ref={menuRef}>
              <button
                type="button"
                className="analytics-menu-btn"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span>Admin</span>
                <ChevronDown size={16} />
              </button>

              {menuOpen && (
                <div className="admin-menu-pop">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setAccountModalOpen(true);
                    }}
                  >
                    <User size={16} />
                    <span>My account</span>
                  </button>
                  <button type="button" onClick={onLogout}>
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDarkMode((v) => !v)}
                  >
                    <Moon size={16} />
                    <span>Dark Mode</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="admin-content analytics-content-wrap">
        <h2 className="analytics-title">Tickets Analysis</h2>
        {error ? (
          <div className="admin-error">{error}</div>
        ) : (
          <div className="analytics-range-wrapper">
            <div className="analytics-date-range">
              <div
                className="fake-date-input date-pill analytics-date-pill"
                role="button"
                tabIndex={0}
                aria-label="Filter by from date"
                onClick={handleDatePillClick}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleDatePillClick({ currentTarget: e.currentTarget })
                }
              >
                <span className="date-pill-text">
                  {fromDate ? `From ${formatFilterDate(fromDate)}` : "From MM/DD/YY"}
                </span>
                <Calendar size={12} />
                <input
                  type="date"
                  className="date-pill-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div
                className="fake-date-input date-pill analytics-date-pill"
                role="button"
                tabIndex={0}
                aria-label="Filter by to date"
                onClick={handleDatePillClick}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleDatePillClick({ currentTarget: e.currentTarget })
                }
              >
                <span className="date-pill-text">
                  {toDate ? `To ${formatFilterDate(toDate)}` : "To MM/DD/YY"}
                </span>
                <Calendar size={12} />
                <input
                  type="date"
                  className="date-pill-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <div className="analytics-grid">
              <article className="analytics-card">
                <div className="analytics-card-head">
                  <h3>Total Tickets</h3>
                </div>
                <PieChart closedCount={closedCount} openCount={openCount} />
              </article>
              <article className="analytics-card">
                <div className="analytics-card-head">
                  <h3>Tickets by Department</h3>
                </div>
                <DepartmentBarChart chartData={departmentChartData} />
              </article>
            </div>
          </div>
        )}
      </section>

      <AdminAccountSettingsModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />
    </div>
  );
}

