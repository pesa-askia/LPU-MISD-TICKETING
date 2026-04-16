import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { Search, ChevronDown, LogOut, Moon, Download } from "lucide-react";
import { realtimeSupabase } from "../../realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import "./AdminTickets.css";
import "./AdminAnalytics.css";
import lpuLogo from "../../assets/lpul-logo.png";

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

export default function AdminTickets() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const { adminTickets, setAdminTickets } = useTicketsCache();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Open Tickets");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const role = localStorage.getItem("userRole");
  const isAdmin = role === "admin";

  const decoded = useMemo(() => {
    try {
      return jwtDecode(localStorage.getItem("authToken") || "");
    } catch {
      return null;
    }
  }, []);
  const adminLevel = decoded?.admin_level ?? 3;
  const isRoot = adminLevel === 0;

  const [assignableAdmins, setAssignableAdmins] = useState([]);
  const [adminNameMap, setAdminNameMap] = useState({}); // id → display name
  const [myProfile, setMyProfile] = useState(null); // for level 2/3 filters

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("adminDarkMode") === "true",
  );

  useEffect(() => {
    const root = document.querySelector(".admin-shell");
    if (!root) return;
    root.classList.toggle("admin-dark", darkMode);
    localStorage.setItem("adminDarkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const fetchTickets = async () => {
    try {
      showLoading();
      setError("");
      const { data, error: supaError } = await realtimeSupabase
        .from("Tickets")
        .select("*")
        .order("id", { ascending: false });

      if (supaError) {
        setError(supaError.message || "Failed to load tickets");
        setTickets([]);
        return;
      }

      const next = data || [];
      setTickets(next);
      setAdminTickets(next);
    } catch (e) {
      setError(e?.message || "Failed to load tickets");
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    if (Array.isArray(adminTickets)) {
      setTickets(adminTickets);
      return;
    }
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    const token = localStorage.getItem("authToken");
    const headers = { Authorization: `Bearer ${token}` };
    const base = getApiBaseUrl();

    // Name lookup map — needed by all levels to display assigned admin names
    fetch(`${base}/api/admin/staff`, { headers })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const map = {};
          json.data.forEach((a) => {
            map[a.id] = a.full_name || a.email;
          });
          setAdminNameMap(map);
        }
      })
      .catch(() => {});

    // Assignable admins for the dropdown (only if caller can assign to someone)
    if (adminLevel < 3) {
      fetch(`${base}/api/admin/assignees`, { headers })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setAssignableAdmins(json.data);
        })
        .catch(() => {});
    }

    // Own profile with ticket filters — only needed for level 2 and 3
    if (adminLevel >= 2) {
      fetch(`${base}/api/admin/me`, { headers })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setMyProfile(json.data);
        })
        .catch(() => {});
    }
  }, [isLoggedIn, isAdmin, adminLevel]);

  const currentAdminId = decoded?.id || decoded?.sub;

  const visibleTickets = useMemo(() => {
    // Root and level 1 see everything
    if (adminLevel <= 1) return tickets;
    // Pre-parse comma-separated filter strings into Sets once
    const fType = new Set(
      (myProfile?.filter_type || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const fDept = new Set(
      (myProfile?.filter_department || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const fCat = new Set(
      (myProfile?.filter_category || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const fSite = new Set(
      (myProfile?.filter_site || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    // Level 2 and 3: only tickets they're assigned to OR that match any of their filters
    return tickets.filter((t) => {
      if ([t.Assignee1, t.Assignee2, t.Assignee3].includes(currentAdminId))
        return true;
      if (fType.size && fType.has(t.Type)) return true;
      if (fDept.size && fDept.has(t.Department)) return true;
      if (fCat.size && fCat.has(t.Category)) return true;
      if (fSite.size && fSite.has(t.Site)) return true;
      return false;
    });
  }, [tickets, adminLevel, currentAdminId, myProfile]);
  // Realtime: prepend new tickets and apply status updates without a full reload
  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;

    const channel = realtimeSupabase
      .channel("admin_tickets_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Tickets" },
        (payload) => {
          setTickets((prev) => [payload.new, ...prev]);
          setAdminTickets((prev) =>
            Array.isArray(prev) ? [payload.new, ...prev] : [payload.new],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Tickets" },
        (payload) => {
          setTickets((prev) =>
            prev.map((t) => (t.id === payload.new.id ? payload.new : t)),
          );
          setAdminTickets((prev) =>
            Array.isArray(prev)
              ? prev.map((t) => (t.id === payload.new.id ? payload.new : t))
              : prev,
          );
        },
      )
      .subscribe();

    return () => {
      realtimeSupabase.removeChannel(channel);
    };
  }, [isLoggedIn, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = visibleTickets.filter((t) => {
      const closed = isClosed(t);
      if (filter === "Closed Tickets") return closed;
      return !closed;
    });
    if (!q) return base;
    return base.filter((t) => {
      const hay = [
        t?.id,
        t?.Summary,
        t?.Description,
        t?.Assignee,
        t?.Assignee1,
        t?.Assignee2,
        t?.Assignee3,
        t?.Type,
        t?.Department,
        t?.Category,
      ]
        .filter(Boolean)
        .map(String)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [visibleTickets, filter, search]);

  const onLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    window.location.href = "/";
  };

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
    const rows = tickets.map((t) => [
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

  const toggleTicketStatus = async (ticket) => {
    if (!isAdmin || !ticket) return;
    try {
      showLoading();
      const shouldReopen = isClosed(ticket);
      const now = new Date().toISOString();
      const payload = shouldReopen
        ? { status: "Open", closed_at: null }
        : { status: "Closed", closed_at: now };

      const { data, error } = await realtimeSupabase
        .from("Tickets")
        .update(payload)
        .eq("id", ticket.id)
        .select();

      if (error) {
        alert(error.message || "Failed to update ticket status");
        return;
      }

      const updated = tickets.map((t) =>
        t.id === ticket.id
          ? { ...t, ...payload, ...((Array.isArray(data) && data[0]) || {}) }
          : t,
      );
      setTickets(updated);
      setAdminTickets(updated);
    } catch (e) {
      console.error("Unexpected error updating ticket status (admin)", e);
      alert("Unexpected error updating ticket status");
    } finally {
      hideLoading();
    }
  };

  if (!isLoggedIn) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/Tickets" replace />;

  const handleAssigneeChange = async (ticket, slotIndex, value) => {
    const field = `Assignee${slotIndex}`;
    const payload = {
      Assignee1: ticket.Assignee1 || null,
      Assignee2: ticket.Assignee2 || null,
      Assignee3: ticket.Assignee3 || null,
    };
    payload[field] = value || null;

    try {
      const { error } = await realtimeSupabase
        .from("Tickets")
        .update(payload)
        .eq("id", ticket.id);

      if (error) {
        alert(error.message || "Failed to update assignees");
        return;
      }

      const updated = tickets.map((t) =>
        t.id === ticket.id ? { ...t, ...payload } : t,
      );
      setTickets(updated);
      setAdminTickets(updated);
    } catch (e) {
      console.error("Unexpected error updating assignees:", e);
      alert("Unexpected error updating assignees");
    }
  };

  return (
    <div className="admin-page analytics-page admin-tickets-page">
      <header className="analytics-topbar">
        <div className="analytics-topbar-inner">
          <div className="analytics-brand" aria-label="LPU MIS Help Desk">
            <img src={lpuLogo} alt="LPU" className="analytics-brand-logo" />
            <span className="analytics-brand-text">MIS HELP DESK</span>
          </div>

          <nav className="analytics-nav-links" aria-label="Admin navigation">
            <NavLink
              to="/admin/tickets"
              className={({ isActive }) =>
                `analytics-nav-link ${isActive ? "active" : ""}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/admin/analytics"
              className={({ isActive }) =>
                `analytics-nav-link ${isActive ? "active" : ""}`
              }
            >
              Analytics
            </NavLink>
            {isRoot && (
              <NavLink
                to="/admin/manage"
                className={({ isActive }) =>
                  `analytics-nav-link ${isActive ? "active" : ""}`
                }
              >
                Manage
              </NavLink>
            )}
          </nav>

          <div className="analytics-actions">
            <button
              type="button"
              className="analytics-export-btn"
              onClick={onExportCsv}
            >
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
                  <button type="button" onClick={onLogout}>
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                  <button type="button" onClick={() => setDarkMode((v) => !v)}>
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
        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Tickets"
              aria-label="Search Tickets"
            />
          </div>
          <div className="admin-filter">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option>Open Tickets</option>
              <option>Closed Tickets</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="admin-error">{error}</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ticket No.</th>
                  <th>Summary</th>
                  <th>Description</th>
                  <th>Assignees</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Created</th>
                  <th>Closed</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="admin-empty">
                      No tickets found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="admin-clickable-row"
                      onClick={() => navigate(`/admin/tickets/${t.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/admin/tickets/${t.id}`);
                        }
                      }}
                    >
                      <td>No. {t.id}</td>
                      <td>
                        <div className="admin-clamp">{t.Summary || "-"}</div>
                      </td>
                      <td>
                        <div className="admin-clamp">
                          {t.Description || "-"}
                        </div>
                      </td>
                      <td
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: 160 }}
                      >
                        {assignableAdmins.length === 0 ? (
                          <span
                            style={{
                              fontSize: 13,
                              color: "#888",
                            }}
                          >
                            {adminNameMap[t.Assignee1] || t.Assignee1 || "—"}
                          </span>
                        ) : (
                          <select
                            className="admin-assignee-select"
                            value={t.Assignee1 || ""}
                            onChange={(e) =>
                              handleAssigneeChange(t, 1, e.target.value)
                            }
                          >
                            <option value="" disabled={adminLevel >= 2}>
                              Assign to…
                            </option>
                            {assignableAdmins.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.full_name || a.email}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{t.Type || "-"}</td>
                      <td>{t.Department || "-"}</td>
                      <td>{t.Category || "-"}</td>
                      <td>
                        {t.created_at
                          ? new Date(t.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        {t.closed_at
                          ? new Date(t.closed_at).toLocaleString()
                          : "-"}
                      </td>
                      <td>{t.status || t.Status || "Open"}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleTicketStatus(t)}
                          style={{
                            padding: "4px 8px",
                            border: "1px solid #888",
                            borderRadius: "4px",
                            background: isClosed(t) ? "#1976d2" : "#4caf50",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          {isClosed(t) ? "Reopen" : "Close"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
