import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Search, ChevronDown, LogOut, Moon } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import "./AdminTickets.css";
import lpuLogo from "../../assets/lpul-logo.png";

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
  const s = String(getStatusValue(ticket)).toLowerCase();
  return s.includes("closed") || s.includes("resolved") || s.includes("done");
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
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const fetchTickets = async () => {
    try {
      showLoading();
      setError("");
      const { data, error: supaError } = await supabase
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

    // Use cached tickets (prevents refetch + loader flash when coming back from chat)
    if (Array.isArray(adminTickets)) {
      setTickets(adminTickets);
      return;
    }

    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = tickets.filter((t) => {
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
  }, [tickets, filter, search]);

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
    <div className="admin-page">
      <header className="admin-topbar">
        <div className="admin-brand" aria-label="LPU MISD Ticketing">
          <img src={lpuLogo} alt="LPU Logo" className="admin-brand-logo" />
        </div>

        <div className="admin-actions">
          <div className="admin-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Tickets"
              aria-label="Search Tickets"
            />
          </div>

          <div className="admin-menu" ref={menuRef}>
            <button
              type="button"
              className="admin-menu-btn"
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
      </header>

      <section className="admin-content">
        <div className="admin-toolbar">
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
                  <th>Assignee</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-empty">
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
                      <td>{t.Summary || "-"}</td>
                      <td className="admin-clamp">{t.Description || "-"}</td>
                      <td>{t.Assignee || "-"}</td>
                      <td>{t.Type || "-"}</td>
                      <td>{t.Department || "-"}</td>
                      <td>{t.Category || "-"}</td>
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

