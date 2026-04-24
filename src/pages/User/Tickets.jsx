import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  ChevronDown,
  CircleDot,
  CheckCircle,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import { FilterSelect, SearchInput } from "../../components/DashboardControls";
import { DataTable } from "../../components/DataTable";

function Tickets() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const { userTickets, setUserTickets } = useTicketsCache();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("Open Tickets");
  const [search, setSearch] = useState("");
  const columns = [
    { label: "Ticket No.", accessor: "id", variant: "badge" },
    { label: "Summary", accessor: "Summary", variant: "title" },
    { label: "Description", accessor: "Description", variant: "subtitle" },
    { label: "Department", accessor: "Department", variant: "highlight" },
    { label: "Created", accessor: "created_at", variant: "date" },
    { label: "Closed", accessor: "closed_at", variant: "status" },
  ];

  const fetchTickets = async () => {
    try {
      showLoading();
      setError(null);

      const token = localStorage.getItem("authToken");
      if (!token) {
        setError("You must be logged in to view tickets.");
        return;
      }

      const decoded = jwtDecode(token);
      const userId = decoded.id;

      const { data, error } = await realtimeSupabase
        .from("Tickets")
        .select("*")
        .eq("created_by", userId)
        .order("id", { ascending: false });

      if (error) {
        setError(error.message || "Failed to load tickets");
      } else {
        const next = data || [];
        setTickets(next);
        setUserTickets(next);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("An unexpected error occurred");
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    if (Array.isArray(userTickets)) {
      setTickets(userTickets);
      return;
    }
    fetchTickets();
  }, []);

  useEffect(() => {
    setUserTickets(tickets);
  }, [tickets]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    let userId;
    try {
      const decoded = jwtDecode(token);
      userId = decoded.id;
    } catch {
      return;
    }
    if (!userId) return;

    const channel = realtimeSupabase
      .channel(`user_tickets_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Tickets" },
        (payload) => {
          if (payload.new?.created_by !== userId) return;
          setTickets((prev) => [payload.new, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Tickets" },
        (payload) => {
          if (payload.new?.created_by !== userId) return;
          setTickets((prev) =>
            prev.map((t) => (t.id === payload.new.id ? payload.new : t)),
          );
        },
      )
      .subscribe();

    return () => {
      realtimeSupabase.removeChannel(channel);
    };
  }, []);

  // Helper to check if a ticket is closed
  const isClosed = (t) => {
    if (!t) return false;
    if (t.closed_at) return true;
    const statusValue = t.status || t.Status || t.state || t.State;
    return String(statusValue || "")
      .toLowerCase()
      .includes("closed");
  };

  // Filter and search logic
  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => (filter === "Open Tickets" ? !isClosed(t) : isClosed(t)))
      .filter(
        (t) =>
          String(t.id).toLowerCase().includes(search.toLowerCase()) ||
          t.Summary?.toLowerCase().includes(search.toLowerCase()),
      );
  }, [tickets, filter, search]);

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
            onClick={fetchTickets}
            className="w-full py-3 bg-lpu-maroon text-white font-bold rounded-lg hover:bg-lpu-red transition-colors flex items-center justify-center gap-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 font-poppins md:overflow-hidden flex flex-col items-center justify-center">
      <div className="w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border-t-[6px] border-lpu-maroon">
        <div className="p-6 md:p-10">
          <h1 className="text-2xl md:text-3xl font-black text-lpu-maroon mb-4 md:mb-8 tracking-tight">
            Ticket Dashboard
          </h1>

          {/* Header Actions */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8">
            <FilterSelect
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              options={["Open Tickets", "Closed Tickets"]}
            />

            <SearchInput
              placeholder="Search ticket no. or summary..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Table Container */}
          <div className="w-full rounded-xl border border-gray-100">
            <DataTable
              columns={columns}
              data={filteredTickets}
              onRowClick={(row) => navigate(`/Tickets/${row.id}`)}
              emptyMessage="No tickets found."
              emptySubMessage="Try adjusting your filter or search terms."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Tickets;
