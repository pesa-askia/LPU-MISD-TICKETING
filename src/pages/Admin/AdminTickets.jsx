import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { Download } from "lucide-react";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useNavbarActions } from "../../context/NavbarActionsContext";
import { FilterSelect, SearchInput } from "../../components/DashboardControls";
import { DataTable } from "../../components/DataTable";

const PAGE_SIZE = 10;

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

function buildSearchFilter(q, search) {
  const trimmed = search.trim();
  if (!trimmed) return q;
  const parts = [
    `Summary.ilike.%${trimmed}%`,
    `Description.ilike.%${trimmed}%`,
    `Type.ilike.%${trimmed}%`,
    `Department.ilike.%${trimmed}%`,
    `Category.ilike.%${trimmed}%`,
  ];
  const numId = parseInt(trimmed);
  if (!isNaN(numId) && String(numId) === trimmed) parts.push(`id.eq.${numId}`);
  return q.or(parts.join(","));
}

export default function AdminTickets() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Open Tickets");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [realtimeTick, setRealtimeTick] = useState(0);

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
  const currentAdminId = decoded?.id || decoded?.sub;

  const [assignableAdmins, setAssignableAdmins] = useState([]);
  const [adminNameMap, setAdminNameMap] = useState({});

  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch auxiliary data: staff names, assignees
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

    fetch(`${base}/api/admin/assignees`, { headers })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAssignableAdmins(json.data);
      })
      .catch(() => {});
  }, [isLoggedIn, isAdmin]);

  // Main paginated fetch
  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;

    const fetchTickets = async () => {
      try {
        showLoading();
        setError("");

        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        let q = realtimeSupabase
          .from("Tickets")
          .select("*", { count: "exact" })
          .order("id", { ascending: false })
          .range(start, end);

        if (filter === "Closed Tickets") {
          q = q.not("closed_at", "is", null);
        } else {
          q = q.is("closed_at", null);
        }

        q = buildSearchFilter(q, search);

        const { data, error: supaError, count } = await q;

        if (supaError) {
          setError(supaError.message || "Failed to load tickets");
          setTickets([]);
        } else {
          setTickets(data || []);
          setTotalCount(count ?? 0);
        }
      } catch (e) {
        setError(e?.message || "Failed to load tickets");
      } finally {
        hideLoading();
      }
    };

    fetchTickets();
  }, [isLoggedIn, isAdmin, page, filter, search, realtimeTick]);

  // Realtime: refetch on any ticket change
  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    const channel = realtimeSupabase
      .channel("admin_tickets_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Tickets" },
        () => {
          setRealtimeTick((n) => n + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Tickets" },
        () => {
          setRealtimeTick((n) => n + 1);
        },
      )
      .subscribe();
    return () => realtimeSupabase.removeChannel(channel);
  }, [isLoggedIn, isAdmin]);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(0);
  };
  const handleFilter = (e) => {
    setFilter(e.target.value);
    setPage(0);
  };

  const onExportCsv = async () => {
    try {
      showLoading();
      let q = realtimeSupabase
        .from("Tickets")
        .select(
          "id,Summary,Description,Department,Type,Category,Site,status,created_at,closed_at",
        )
        .order("id", { ascending: false });

      if (filter === "Closed Tickets") {
        q = q.not("closed_at", "is", null);
      } else {
        q = q.is("closed_at", null);
      }

      q = buildSearchFilter(q, search);

      const { data } = await q;
      const rows = (data || []).map((t) => [
        t.id,
        t.Summary,
        t.Description,
        t.Department,
        t.Type,
        t.Category,
        t.Site,
        t.status || "Open",
        t.created_at,
        t.closed_at,
      ]);
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
    } finally {
      hideLoading();
    }
  };

  const toggleTicketStatus = async (ticket) => {
    if (!isAdmin || !ticket) return;
    try {
      showLoading();
      const shouldReopen = isClosed(ticket);
      const payload = shouldReopen
        ? { status: "Open", closed_at: null }
        : { status: "Closed", closed_at: new Date().toISOString() };

      const { error } = await realtimeSupabase
        .from("Tickets")
        .update(payload)
        .eq("id", ticket.id);

      if (error) {
        alert(error.message || "Failed to update ticket status");
        return;
      }
      setRealtimeTick((n) => n + 1);
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
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, ...payload } : t)),
      );
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
      { label: "Type", accessor: "Type", variant: "highlight" },
      { label: "Department", accessor: "Department", variant: "highlight" },
      { label: "Category", accessor: "Category", variant: "highlight" },
      { label: "Created", accessor: "created_at", variant: "date" },
      {
        label: "Actions",
        variant: "action",
        preventRowClick: true,
        getLabel: (t) => (isClosed(t) ? "Reopen" : "Close"),
        isPrimary: (t) => isClosed(t),
        onClick: (t) => toggleTicketStatus(t),
      },
    ],
    [assignableAdmins, adminNameMap],
  );

  useNavbarActions(
    <button
      type="button"
      onClick={onExportCsv}
      className="flex items-center justify-center gap-2 px-4 h-[40px] rounded-lg text-[15px] font-medium text-white/85 hover:bg-[var(--color-lpu-gold)] hover:text-[var(--color-lpu-maroon)] transition-all duration-200"
    >
      <Download size={18} />
      <span>Export CSV</span>
    </button>,
  );

  if (!isLoggedIn) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/Tickets" replace />;

  return (
    <div className="md:flex-1 md:overflow-y-auto">
      <section className="w-full max-w-330 mx-auto px-6 py-4 md:py-6 font-[Poppins,Segoe_UI,Arial,sans-serif]">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-4">
          <FilterSelect
            value={filter}
            onChange={handleFilter}
            options={["Open Tickets", "Closed Tickets"]}
          />
          <SearchInput
            placeholder="Search tickets..."
            onSearch={handleSearch}
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
              data={tickets}
              onRowClick={(row) => navigate(`/admin/tickets/${row.id}`)}
              emptyMessage="No tickets found."
              emptySubMessage="Adjust your search or filter settings."
              page={page}
              pageCount={pageCount}
              totalCount={totalCount}
              onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
              onNextPage={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
