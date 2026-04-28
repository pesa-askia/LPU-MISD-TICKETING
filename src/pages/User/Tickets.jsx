import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { FilterSelect, SearchInput } from "../../components/DashboardControls";
import { DataTable } from "../../components/DataTable";

const PAGE_SIZE = 10;

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

  const columns = [
    { label: "Ticket No.", accessor: "id", variant: "badge" },
    { label: "Summary", accessor: "Summary", variant: "title" },
    { label: "Description", accessor: "Description", variant: "subtitle" },
    { label: "Department", accessor: "Department", variant: "highlight" },
    { label: "Created", accessor: "created_at", variant: "date" },
    { label: "Closed", accessor: "closed_at", variant: "status" },
  ];

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
          setTickets(data || []);
          setTotalCount(count ?? 0);
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
    <div className="flex-1 min-h-0 bg-gray-50 font-poppins md:h-screen md:overflow-hidden flex flex-col items-center md:justify-center p-4 md:p-0">
      <div className="w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border-t-[6px] border-lpu-maroon">
        <div className="p-6 md:p-8">
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

          <div className="w-full rounded-xl border border-gray-100">
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
    </div>
  );
}

export default Tickets;
