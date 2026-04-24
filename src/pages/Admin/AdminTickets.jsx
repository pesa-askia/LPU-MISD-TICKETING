import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import {
  canAssignTickets,
  canViewAllTickets,
  getAdminPrivilegeRank,
  isRootAdmin,
  needsTicketFilters,
} from "../../utils/adminLevels";
import { ChevronDown, LogOut, Moon, Download, User } from "lucide-react";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import "./AdminTickets.css";
import "./AdminAnalytics.css";
import AdminNavbar from "./components/AdminNavbar";
import AdminAccountSettingsModal from "./components/AdminAccountSettingsModal";
import { FilterSelect, SearchInput } from "../../components/DashboardControls";
import { DataTable } from "../../components/DataTable";

function getStatusValue(ticket) {
  return (
    ticket?.Status ?? ticket?.status ?? ticket?.state ?? ticket?.State ?? ""
  );
}

function isClosed(ticket) {
  return !!ticket?.closed_at;
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
  const [accountModalOpen, setAccountModalOpen] = useState(false);
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
  const adminLevel = decoded?.admin_level ?? 1;
  const isRoot = isRootAdmin(adminLevel);

  const [assignableAdmins, setAssignableAdmins] = useState([]);
  const [adminNameMap, setAdminNameMap] = useState({});
  const [myProfile, setMyProfile] = useState(null);

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
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    const token = localStorage.getItem("authToken");
    const headers = { Authorization: `Bearer ${token}` };
    const base = getApiBaseUrl();

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

    if (canAssignTickets(adminLevel)) {
      fetch(`${base}/api/admin/assignees`, { headers })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setAssignableAdmins(json.data);
        })
        .catch(() => {});
    }

    if (needsTicketFilters(adminLevel)) {
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
    if (canViewAllTickets(adminLevel)) return tickets;
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
    return () => realtimeSupabase.removeChannel(channel);
  }, [isLoggedIn, isAdmin, setAdminTickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = visibleTickets.filter((t) =>
      filter === "Closed Tickets" ? isClosed(t) : !isClosed(t),
    );
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
    link.download = `tickets-export-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
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
      const payload = shouldReopen
        ? { status: "Open", closed_at: null }
        : { status: "Closed", closed_at: new Date().toISOString() };

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
      console.error("Unexpected error", e);
    } finally {
      hideLoading();
    }
  };

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
      console.error("Unexpected error:", e);
    }
  };

  const adminColumns = useMemo(
    () => [
      { label: "Ticket No.", accessor: "id", variant: "badge" },
      { label: "Summary", accessor: "Summary", variant: "title" },
      { label: "Description", accessor: "Description", variant: "subtitle" },
      {
        label: "Assignees",
        accessor: "Assignee1",
        variant: "select",
        preventRowClick: true,
        placeholder: "Assign to…",
        options: assignableAdmins.map((a) => ({
          value: a.id,
          label: a.full_name || a.email,
        })),
        onChange: (row, value) => handleAssigneeChange(row, 1, value),
        fallbackText: (row) =>
          adminNameMap[row.Assignee1] || row.Assignee1 || "—",
      },
      // Now using 'highlight' variant for Type and Category
      { label: "Type", accessor: "Type", variant: "highlight" },
      { label: "Department", accessor: "Department", variant: "highlight" },
      { label: "Category", accessor: "Category", variant: "highlight" },
      { label: "Created", accessor: "created_at", variant: "date" },
      // The old "Status" column has been entirely removed!
      {
        label: "Actions",
        variant: "action",
        align: "right",
        preventRowClick: true,
        getLabel: (t) => (isClosed(t) ? "Reopen" : "Close"),
        isPrimary: (t) => isClosed(t), // Drives the blue vs green color natively
        onClick: (t) => toggleTicketStatus(t),
      },
    ],
    [adminLevel, assignableAdmins, adminNameMap],
  );

  if (!isLoggedIn) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/Tickets" replace />;

  return (
    <div className="admin-page analytics-page admin-tickets-page">
      <AdminNavbar
        isRoot={isRoot}
        actions={
          <>
            <button
              type="button"
              className="analytics-export-btn"
              onClick={onExportCsv}
            >
              <Download size={16} /> Export CSV
            </button>
            <div className="admin-menu" ref={menuRef}>
              <button
                type="button"
                className="analytics-menu-btn"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span>Admin</span> <ChevronDown size={16} />
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
                    <User size={16} /> <span>My account</span>
                  </button>
                  <button type="button" onClick={onLogout}>
                    <LogOut size={16} /> <span>Logout</span>
                  </button>
                  <button type="button" onClick={() => setDarkMode((v) => !v)}>
                    <Moon size={16} /> <span>Dark Mode</span>
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      <section className="admin-content analytics-content-wrap px-6 py-8">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8">
          <FilterSelect
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            options={["Open Tickets", "Closed Tickets"]}
          />
          <SearchInput
            placeholder="Search Tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error ? (
          <div className="bg-red-50 text-lpu-red p-4 rounded-xl font-semibold text-center border border-red-100">
            {error}
          </div>
        ) : (
          <div className="w-full rounded-xl border border-gray-100 shadow-sm bg-white">
            <DataTable
              columns={adminColumns}
              data={filtered}
              onRowClick={(row) => navigate(`/admin/tickets/${row.id}`)}
              emptyMessage="No tickets found."
              emptySubMessage="Adjust your search or filter settings."
            />
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
