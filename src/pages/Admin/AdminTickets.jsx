import { useEffect, useMemo, useState, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import {
  Download,
  X,
  ChevronDown,
  MessageCircle,
  Smile,
  Frown,
} from "lucide-react";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/useLoading";
import { NavbarActionButton } from "../../context/NavbarActionsContext";
import { useNavbarActions } from "../../context/useNavbarActions";
import { FilterSelect, SearchInput } from "../../components/Controls";
import { DataTable, TableButton } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import {
  playNewTicketSound,
  installAudioUnlock,
} from "../../utils/notificationSound";

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

function getTicketPriority(ticket) {
  return ticket?.Priority ?? ticket?.priority ?? "";
}

function getPrioritySelectClass(priority) {
  const val = String(priority || "")
    .trim()
    .toLowerCase();
  if (val === "high") return "border-lpu-red";
  if (val === "med") return "border-lpu-gold";
  if (val === "low") return "border-green-800";
  return "";
}

function getPriorityPillClass(priority) {
  const val = String(priority || "")
    .trim()
    .toLowerCase();
  if (val === "high")
    return "bg-lpu-red/10 border border-lpu-red/40 text-lpu-red dark:bg-lpu-red/15 dark:border-lpu-red/30 dark:text-red-400";
  if (val === "med")
    return "bg-lpu-gold/10 border border-lpu-gold/50 text-yellow-700 dark:bg-lpu-gold/10 dark:border-lpu-gold/30 dark:text-yellow-400";
  if (val === "low")
    return "bg-green-800/10 border border-green-800/30 text-green-800 dark:bg-green-900/20 dark:border-green-700/30 dark:text-green-400";
  return "bg-gray-50 border border-gray-200 text-gray-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400";
}

const PRIORITY_OPTIONS = [
  { value: "High", label: "High" },
  { value: "Med", label: "Med" },
  { value: "Low", label: "Low" },
];

function buildSearchFilter(q, search) {
  const trimmed = search.trim();
  if (!trimmed) return q;
  const parts = [
    `Summary.ilike.%${trimmed}%`,
    `Description.ilike.%${trimmed}%`,
    `Type.ilike.%${trimmed}%`,
    `Department.ilike.%${trimmed}%`,
    `Category.ilike.%${trimmed}%`,
    `ticket_number.ilike.%${trimmed}%`,
  ];
  const numId = parseInt(trimmed);
  if (!isNaN(numId) && String(numId) === trimmed) parts.push(`id.eq.${numId}`);
  return q.or(parts.join(","));
}

function AssigneeCell({
  ticket,
  assignableAdmins,
  adminNameMap,
  isGlobalAdmin,
  onAdd,
  onRemove,
}) {
  const slots = ["Assignee1", "Assignee2", "Assignee3"];
  const assigned = slots.map((s) => ticket[s]).filter(Boolean);
  const available = assignableAdmins.filter((a) => !assigned.includes(a.id));
  const [adding, setAdding] = useState("");

  const handleSelect = (val) => {
    if (!val) return;
    setAdding("");
    onAdd(ticket, val);
  };

  return (
    <div
      className="flex flex-col gap-1 py-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {assigned.map((id) => (
        <div
          key={id}
          className="flex items-center gap-1 h-7 pl-2.5 pr-1.5 bg-lpu-maroon/10 border border-lpu-maroon/20 rounded-lg text-xs font-bold text-lpu-maroon dark:bg-lpu-maroon/20 dark:border-lpu-maroon/35 dark:text-lpu-gold whitespace-nowrap max-w-full"
        >
          <span className="truncate flex-1 min-w-0">
            {adminNameMap[id] || id}
          </span>
          {isGlobalAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(ticket, id);
              }}
              className="shrink-0 p-0.5 rounded hover:bg-lpu-maroon/20 transition-colors"
              title="Remove assignee"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}
      {assigned.length < 3 && available.length > 0 && (
        <div className="relative inline-block w-full h-7 group">
          <select
            value={adding}
            onChange={(e) => handleSelect(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full appearance-none pl-2.5 pr-6 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-gray-500 dark:text-zinc-300 outline-none transition-all duration-200 focus:ring-2 focus:ring-lpu-gold focus:border-lpu-gold cursor-pointer"
          >
            <option value="" disabled>
              Add assignee…
            </option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name || a.email}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-all duration-200 group-focus-within:rotate-180"
          />
        </div>
      )}
      {assigned.length === 0 && available.length === 0 && (
        <span className="text-sm text-gray-400 dark:text-zinc-500">—</span>
      )}
    </div>
  );
}

export default function AdminTickets() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(() => {
    return localStorage.getItem("admin_ticket_filter") || "Open Tickets";
  });
  const [search, setSearch] = useState(() => {
    return localStorage.getItem("admin_ticket_search") || "";
  });
  const [page, setPage] = useState(() => {
    return parseInt(localStorage.getItem("admin_ticket_page") || "0");
  });
  const [totalCount, setTotalCount] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [selectedCommentTicket, setSelectedCommentTicket] = useState(null);

  // Prime the shared AudioContext on the first user gesture so realtime INSERT
  // events can play the chime without needing a fresh gesture each time.
  useEffect(() => installAudioUnlock(), []);

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
  const isGlobalAdmin = decoded?.admin_level === 0;

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

        if (dateFrom) q = q.gte("created_at", dateFrom);
        if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");

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
  }, [
    isLoggedIn,
    isAdmin,
    page,
    filter,
    search,
    dateFrom,
    dateTo,
    realtimeTick,
    showLoading,
    hideLoading,
  ]);

  // Realtime: refetch on any ticket change
  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    const channel = realtimeSupabase
      .channel("admin_tickets_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Tickets" },
        () => {
          playNewTicketSound();
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
    localStorage.setItem("admin_ticket_search", val);
    setPage(0);
    localStorage.setItem("admin_ticket_page", "0");
  };
  const handleFilter = (e) => {
    const nextFilter = e.target.value;
    setFilter(nextFilter);
    localStorage.setItem("admin_ticket_filter", nextFilter);
    setPage(0);
    localStorage.setItem("admin_ticket_page", "0");
  };

  const onExportCsv = async () => {
    try {
      showLoading();
      let q = realtimeSupabase
        .from("Tickets")
        .select("*")
        .order("id", { ascending: false });

      if (filter === "Closed Tickets") {
        q = q.not("closed_at", "is", null);
      } else {
        q = q.is("closed_at", null);
      }

      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");

      q = buildSearchFilter(q, search);

      const { data } = await q;
      const list = data || [];

      // Build column list from the union of all keys, id first
      const keySet = new Set();
      list.forEach((row) => Object.keys(row).forEach((k) => keySet.add(k)));
      const headers = ["id", ...[...keySet].filter((k) => k !== "id").sort()];

      const assigneeKeys = new Set(["Assignee1", "Assignee2", "Assignee3"]);
      const formatCell = (key, value) => {
        if (value == null) return "";
        if (assigneeKeys.has(key)) return adminNameMap[value] || value;
        if (typeof value === "object") return JSON.stringify(value);
        return value;
      };

      const rows = list.map((row) =>
        headers.map((key) => formatCell(key, row[key])),
      );
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

  const toggleTicketStatus = useCallback(
    async (ticket) => {
      if (!isAdmin || !ticket) return;
      try {
        showLoading();
        const shouldReopen = isClosed(ticket);
        const payload = shouldReopen
          ? { status: "Open", closed_at: null }
          : { status: "Closed", closed_at: new Date().toISOString() };

        const token = localStorage.getItem("authToken");
        const res = await fetch(
          `${getApiBaseUrl()}/api/tickets/${ticket.id}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.success) {
          alert(json.message || "Failed to update ticket status");
          return;
        }
        setRealtimeTick((n) => n + 1);
      } catch (e) {
        console.error("Unexpected error", e);
      } finally {
        hideLoading();
      }
    },
    [isAdmin, showLoading, hideLoading],
  );

  const patchAssignees = useCallback(async (ticket, payload) => {
    const token = localStorage.getItem("authToken");
    const res = await fetch(
      `${getApiBaseUrl()}/api/tickets/${ticket.id}/assignees`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!json.success)
      throw new Error(json.message || "Failed to update assignees");
    return json.data;
  }, []);

  const handleAddAssignee = useCallback(
    async (ticket, adminId) => {
      const slots = ["Assignee1", "Assignee2", "Assignee3"];
      const emptySlot = slots.find((s) => !ticket[s]);
      if (!emptySlot) return;
      const payload = {
        Assignee1: ticket.Assignee1 || null,
        Assignee2: ticket.Assignee2 || null,
        Assignee3: ticket.Assignee3 || null,
      };
      payload[emptySlot] = adminId;
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, ...payload } : t)),
      );
      try {
        const updated = await patchAssignees(ticket, payload);
        if (updated) {
          setTickets((prev) =>
            prev.map((t) => (t.id === ticket.id ? { ...t, ...updated } : t)),
          );
        }
      } catch (e) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticket.id
              ? {
                  ...t,
                  Assignee1: ticket.Assignee1 || null,
                  Assignee2: ticket.Assignee2 || null,
                  Assignee3: ticket.Assignee3 || null,
                }
              : t,
          ),
        );
        alert(e.message);
      }
    },
    [patchAssignees],
  );

  const handleRemoveAssignee = useCallback(
    async (ticket, adminId) => {
      const slots = ["Assignee1", "Assignee2", "Assignee3"];
      const slot = slots.find((s) => ticket[s] === adminId);
      if (!slot) return;
      const payload = {
        Assignee1: ticket.Assignee1 || null,
        Assignee2: ticket.Assignee2 || null,
        Assignee3: ticket.Assignee3 || null,
      };
      payload[slot] = null;
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, ...payload } : t)),
      );
      try {
        const updated = await patchAssignees(ticket, payload);
        if (updated) {
          setTickets((prev) =>
            prev.map((t) => (t.id === ticket.id ? { ...t, ...updated } : t)),
          );
        }
      } catch (e) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticket.id
              ? {
                  ...t,
                  Assignee1: ticket.Assignee1 || null,
                  Assignee2: ticket.Assignee2 || null,
                  Assignee3: ticket.Assignee3 || null,
                }
              : t,
          ),
        );
        alert(e.message);
      }
    },
    [patchAssignees],
  );

  const handlePriorityChange = useCallback(
    async (ticket, value) => {
      if (!isAdmin || !ticket) return;
      const nextPriority = value || null;
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id ? { ...t, Priority: nextPriority } : t,
        ),
      );
      try {
        const { error } = await realtimeSupabase
          .from("Tickets")
          .update({ Priority: nextPriority })
          .eq("id", ticket.id);
        if (error) {
          setTickets((prev) =>
            prev.map((t) =>
              t.id === ticket.id ? { ...t, Priority: ticket.Priority } : t,
            ),
          );
          alert(error.message || "Failed to update priority");
        }
      } catch (e) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticket.id ? { ...t, Priority: ticket.Priority } : t,
          ),
        );
        console.error("Unexpected error:", e);
      }
    },
    [isAdmin],
  );

  const adminColumns = useMemo(
    () => [
      {
        label: "ID",
        accessor: (row) => row.ticket_number || row.id,
        variant: "badge",
        colWidth: "w-28",
      },
      {
        label: "Priority",
        accessor: (row) => getTicketPriority(row),
        variant: "select",
        colWidth: "w-28",
        preventRowClick: true,
        placeholder: "Set priority…",
        options: PRIORITY_OPTIONS,
        onChange: (row, value) => handlePriorityChange(row, value),
        fallbackText: (row) => getTicketPriority(row) || "—",
        selectClassName: (row) =>
          getPrioritySelectClass(getTicketPriority(row)),
        pillClassName: (row) => getPriorityPillClass(getTicketPriority(row)),
        getDisplayValue: (_row, value) => value || "Set priority…",
      },
      {
        label: "Summary",
        accessor: "Summary",
        variant: "title",
        colWidth: "w-44",
      },
      {
        label: "Description",
        accessor: "Description",
        colWidth: "w-64",
        render: (row) => (
          <div
            className="text-sm text-gray-500 dark:text-zinc-400 line-clamp-1 italic py-1"
            title={row.Description}
          >
            {row.Description || "-"}
          </div>
        ),
      },
      {
        label: "Assignees",
        colWidth: "w-45",
        preventRowClick: true,
        render: (row) => (
          <AssigneeCell
            ticket={row}
            assignableAdmins={assignableAdmins}
            adminNameMap={adminNameMap}
            isGlobalAdmin={isGlobalAdmin}
            onAdd={handleAddAssignee}
            onRemove={handleRemoveAssignee}
          />
        ),
      },
      { label: "Type", accessor: "Type", variant: "highlight" },
      { label: "Department", accessor: "Department", variant: "highlight" },
      {
        label: "Category",
        accessor: "Category",
        render: (row) => (
          <span className="text-sm font-bold text-lpu-maroon dark:text-lpu-gold tracking-tighter wrap-break-word">
            {row.Category || "-"}
          </span>
        ),
      },
      { label: "Created", accessor: "created_at", variant: "date" },
      {
        label: "Actions",
        colWidth: "w-28",
        preventRowClick: true,
        render: (row) => {
          const isClosedStatus = isClosed(row);
          return (
            <div className="flex flex-col gap-2 py-1">
              <TableButton
                onClick={() => toggleTicketStatus(row)}
                variant={isClosedStatus ? "primary" : "secondary"}
                className="w-full"
              >
                {isClosedStatus ? "Reopen" : "Close"}
              </TableButton>
              {row.satisfaction_comment && (
                <TableButton
                  variant="secondary"
                  onClick={() => setSelectedCommentTicket(row)}
                  className="w-full"
                >
                  Feedback
                </TableButton>
              )}
            </div>
          );
        },
      },
    ],
    [
      assignableAdmins,
      adminNameMap,
      isGlobalAdmin,
      handleAddAssignee,
      handleRemoveAssignee,
      handlePriorityChange,
      toggleTicketStatus,
    ],
  );

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
    <section className="w-full px-6 py-4 md:py-6 font-[Poppins,Segoe_UI,Arial,sans-serif] h-full overflow-hidden flex flex-col dark:text-gray-100">
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="w-full md:w-1/4">
          <FilterSelect
            value={filter}
            onChange={handleFilter}
            options={["Open Tickets", "Closed Tickets"]}
          />
        </div>
        <DateRangeFilter
          onChange={(f, t) => {
            setDateFrom(f);
            setDateTo(t);
            setPage(0);
          }}
        />
        <div className="flex-1 min-w-0">
          <SearchInput
            placeholder="Search tickets..."
            onSearch={handleSearch}
            defaultValue={search}
          />
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-950/20 text-lpu-red dark:text-red-400 p-4 rounded-xl font-semibold text-center border border-red-100 dark:border-red-900/30">
          {error}
        </div>
      ) : (
        <div className="w-full flex-1 min-h-0 flex flex-col">
          <DataTable
            columns={adminColumns}
            data={tickets}
            onRowClick={(row) => navigate(`/admin/tickets/${row.id}`)}
            emptyMessage="No tickets found."
            emptySubMessage="Adjust your search or filter settings."
            page={page}
            pageCount={pageCount}
            totalCount={totalCount}
            onPrevPage={() => {
              const next = Math.max(0, page - 1);
              setPage(next);
              localStorage.setItem("admin_ticket_page", String(next));
            }}
            onNextPage={() => {
              const next = Math.min(pageCount - 1, page + 1);
              setPage(next);
              localStorage.setItem("admin_ticket_page", String(next));
            }}
          />
        </div>
      )}

      {selectedCommentTicket && (
        <Modal
          header={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lpu-maroon/10 dark:bg-lpu-gold/10 flex items-center justify-center shrink-0">
                <MessageCircle
                  size={20}
                  className="text-lpu-maroon dark:text-lpu-gold"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100 truncate">
                  User Feedback
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
                  Ticket #{selectedCommentTicket.id}
                </p>
              </div>
            </div>
          }
          className="max-w-md mx-4"
          onClose={() => setSelectedCommentTicket(null)}
        >
          <div className="p-6">
            {selectedCommentTicket.satisfaction != null && (
              <div className="flex items-center gap-2 mb-4">
                {selectedCommentTicket.satisfaction ? (
                  <Smile size={22} className="text-green-500 shrink-0" />
                ) : (
                  <Frown size={22} className="text-lpu-red shrink-0" />
                )}
                <span className="text-sm font-bold text-gray-600 dark:text-zinc-300">
                  {selectedCommentTicket.satisfaction
                    ? "Satisfied"
                    : "Not Satisfied"}
                </span>
              </div>
            )}
            <div className="relative">
              <div className="absolute -left-1 top-0 bottom-0 w-1 bg-lpu-maroon/20 dark:bg-lpu-gold/30 rounded-full" />
              <div className="pl-4">
                <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-300 italic">
                  "{selectedCommentTicket.satisfaction_comment}"
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <TableButton
                variant="secondary"
                onClick={() => setSelectedCommentTicket(null)}
                className="w-full sm:w-auto"
              >
                Close Feedback
              </TableButton>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
