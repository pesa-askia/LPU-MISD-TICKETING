import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { useLoading } from "../../context/LoadingContext";
import { FilterSelect, SearchInput } from "../../components/Controls";
import { DataTable, TableBadge } from "../../components/DataTable";
import { Modal } from "../../components/Modal";

const PAGE_SIZE = 10;

function getTicketStatus(ticket) {
  if (ticket?.closed_at) return "complete";
  const slaBreached =
    ticket?.sla_met === false ||
    (ticket?.sla_due_at && Date.parse(ticket.sla_due_at) < Date.now());
  if (slaBreached) return "overdue";
  const hasAssignee =
    ticket?.Assignee1 || ticket?.Assignee2 || ticket?.Assignee3;
  if (!hasAssignee) return "unassigned";
  return "ongoing";
}

const STATUS_LABELS = {
  complete: "Complete",
  overdue: "Overdue",
  unassigned: "Unassigned",
  ongoing: "Ongoing",
};

function Tickets() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("Open Tickets");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [realtimeTick, setRealtimeTick] = useState(0);

  // FIFO feedback queue — each closed ticket gets a modal in order
  const [feedbackQueue, setFeedbackQueue] = useState([]);

  // IDs we know were open on the current page — used to detect admin-closes via realtime
  const prevOpenIdsRef = useRef(new Set());
  // IDs already queued for feedback — prevents duplicates
  const queuedIdsRef = useRef(new Set());

  const isClosedFilter = filter === "Closed Tickets";

  const columns = [
    { label: "Ticket No.", accessor: "id", variant: "badge" },
    {
      label: "Status",
      colWidth: "w-32",
      render: (row) => {
        const status = getTicketStatus(row);
        return (
          <TableBadge
            variant={`status-${status}`}
            className="w-28 justify-center"
          >
            {STATUS_LABELS[status]}
          </TableBadge>
        );
      },
    },
    { label: "Summary", accessor: "Summary", variant: "title" },
    { label: "Description", accessor: "Description", variant: "subtitle" },
    { label: "Category", accessor: "Category", variant: "highlight" },
    ...(isClosedFilter
      ? [{ label: "Closed", accessor: "closed_at", variant: "date" }]
      : [{ label: "Created", accessor: "created_at", variant: "date" }]),
    {
      label: "Actions",
      variant: "action",
      preventRowClick: true,
      getLabel: (t) => (t?.closed_at ? "Reopen" : "Close"),
      isPrimary: (t) => !!t?.closed_at,
      onClick: (t) => handleActionClick(t),
    },
  ];

  const enqueueForFeedback = (ticket) => {
    if (queuedIdsRef.current.has(ticket.id)) return;
    queuedIdsRef.current.add(ticket.id);
    prevOpenIdsRef.current.delete(ticket.id);
    setFeedbackQueue((q) => [...q, ticket]);
  };

  const handleActionClick = async (ticket) => {
    if (!ticket) return;
    const isCurrentlyClosed = !!ticket.closed_at;
    if (isCurrentlyClosed) {
      // Reopening — no feedback
      await toggleTicketStatus(ticket, false);
    } else {
      // Close ticket first, then queue feedback modal
      const ok = await toggleTicketStatus(ticket, true);
      if (ok) {
        navigate("/Tickets");
        enqueueForFeedback(ticket);
      }
    }
  };

  // Returns true on success, false on failure
  const toggleTicketStatus = async (ticket, isClosing) => {
    if (!ticket) return false;
    try {
      showLoading();
      const payload = isClosing
        ? { status: "Closed", closed_at: new Date().toISOString() }
        : { status: "Open", closed_at: null };

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
        return false;
      }
      setRealtimeTick((n) => n + 1);
      return true;
    } catch (e) {
      alert(e?.message || "Unexpected error updating ticket status");
      return false;
    } finally {
      hideLoading();
    }
  };

  // Pop the front of the queue — next ticket's modal auto-shows if queue non-empty
  const handleFeedbackClose = () => {
    setFeedbackQueue((q) => q.slice(1));
  };

  const userId = useMemo(() => {
    try {
      return jwtDecode(localStorage.getItem("authToken") || "").id;
    } catch {
      return null;
    }
  }, []);

  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    if (!userId) return;

    const fetchTickets = async () => {
      try {
        showLoading();
        setError(null);

        const isClosed = filter === "Closed Tickets";
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        let q = realtimeSupabase
          .from("Tickets")
          .select("*", { count: "exact" })
          .eq("created_by", userId)
          .order("id", { ascending: false })
          .range(start, end);

        if (isClosed) {
          q = q.not("closed_at", "is", null);
        } else {
          q = q.is("closed_at", null);
        }

        const trimmed = search.trim();
        if (trimmed) {
          const numId = parseInt(trimmed);
          const parts = [`Summary.ilike.%${trimmed}%`];
          if (!isNaN(numId) && String(numId) === trimmed)
            parts.push(`id.eq.${numId}`);
          q = q.or(parts.join(","));
        }

        const { data, error: supaError, count } = await q;

        if (supaError) {
          setError(supaError.message || "Failed to load tickets");
        } else {
          const fetched = data || [];
          setTickets(fetched);
          setTotalCount(count ?? 0);
          // Track open ticket IDs on current page for admin-close detection
          if (!isClosed) {
            fetched.forEach((t) => {
              if (!t.closed_at) prevOpenIdsRef.current.add(t.id);
            });
          }
        }
      } catch (err) {
        setError("An unexpected error occurred");
      } finally {
        hideLoading();
      }
    };

    fetchTickets();
  }, [userId, page, filter, search, realtimeTick]);

  useEffect(() => {
    if (!userId) return;

    const channel = realtimeSupabase
      .channel(`user_tickets_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Tickets" },
        (payload) => {
          if (payload.new?.created_by !== userId) return;
          setRealtimeTick((n) => n + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Tickets" },
        (payload) => {
          if (payload.new?.created_by !== userId) return;
          const updated = payload.new;
          // Admin-closed: ticket was known-open and now has closed_at, not already queued
          if (
            updated.closed_at &&
            prevOpenIdsRef.current.has(updated.id) &&
            !queuedIdsRef.current.has(updated.id)
          ) {
            enqueueForFeedback(updated);
          }
          setRealtimeTick((n) => n + 1);
        },
      )
      .subscribe();

    return () => realtimeSupabase.removeChannel(channel);
  }, [userId]);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(0);
  };

  const handleFilter = (e) => {
    setFilter(e.target.value);
    setPage(0);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-poppins">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl text-center border-t-4 border-lpu-red">
          <AlertCircle className="mx-auto text-lpu-red mb-4" size={48} />
          <h2 className="text-2xl font-bold text-lpu-maroon mb-2">
            Error Loading Tickets
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => setRealtimeTick((n) => n + 1)}
            className="w-full py-3 bg-lpu-maroon text-white font-bold rounded-lg hover:bg-lpu-red transition-colors flex items-center justify-center gap-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-gray-50 font-poppins flex flex-col p-4 md:p-6">
      <div className="w-full max-w-330 mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border-t-[6px] border-lpu-maroon flex-1 min-h-0 flex flex-col">
        <div className="p-6 md:p-8 flex-1 min-h-0 flex flex-col">
          <h1 className="text-2xl md:text-3xl font-black text-lpu-maroon mb-4 tracking-tight">
            Ticket Dashboard
          </h1>

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-4">
            <FilterSelect
              value={filter}
              onChange={handleFilter}
              options={["Open Tickets", "Closed Tickets"]}
            />

            <SearchInput
              placeholder="Search ticket no. or summary..."
              onSearch={handleSearch}
            />
          </div>

          <div className="w-full flex-1 min-h-0 rounded-xl border border-gray-100 flex flex-col">
            <DataTable
              columns={columns}
              data={tickets}
              onRowClick={(row) => navigate(`/Tickets/${row.id}`)}
              emptyMessage="No tickets found."
              emptySubMessage="Try adjusting your filter or search terms."
              page={page}
              pageCount={pageCount}
              totalCount={totalCount}
              onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
              onNextPage={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            />
          </div>
        </div>
      </div>

      {feedbackQueue.length > 0 && (
        <Modal
          key={feedbackQueue[0].id}
          ticket={feedbackQueue[0]}
          onSubmit={() => {}}
          onClose={handleFeedbackClose}
        />
      )}
    </div>
  );
}

export default Tickets;
