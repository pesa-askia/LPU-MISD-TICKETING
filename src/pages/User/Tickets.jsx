import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
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

function Tickets() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const { userTickets, setUserTickets } = useTicketsCache();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("Open Tickets");
  const [search, setSearch] = useState("");

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
    <div className="h-screen bg-gray-50 p-4 md:p-10 font-poppins md:overflow-hidden flex flex-col items-center justify-center">
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
          <div className="w-full overflow-x-auto rounded-xl border border-gray-100">
            {(() => {
              const isClosed = (t) => {
                if (!t) return false;
                if (t.closed_at) return true;
                const statusValue = t.status || t.Status || t.state || t.State;
                return String(statusValue || "")
                  .toLowerCase()
                  .includes("closed");
              };

              const filteredTickets = tickets
                .filter((t) =>
                  filter === "Open Tickets" ? !isClosed(t) : isClosed(t),
                )
                .filter(
                  (t) =>
                    String(t.id).toLowerCase().includes(search.toLowerCase()) ||
                    t.Summary?.toLowerCase().includes(search.toLowerCase()),
                );

              if (filteredTickets.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50">
                    <p className="text-xl font-semibold">No tickets found.</p>
                    <p className="text-sm">
                      Try adjusting your filter or search terms.
                    </p>
                  </div>
                );
              }

              return (
                <div className="w-full max-h-150 overflow-auto rounded-xl border border-gray-100">
                  <table className="w-full text-left border-collapse min-w-175">
                    <thead>
                      {/* Added sticky top-0 and z-10 so the header stays while the body scrolls */}
                      <tr className="bg-lpu-maroon text-white sticky top-0 z-10">
                        <th className="px-6 py-4 font-bold uppercase text-[11px] tracking-widest whitespace-nowrap">
                          Ticket No.
                        </th>
                        <th className="px-6 py-4 font-bold uppercase text-[11px] tracking-widest">
                          Summary
                        </th>
                        <th className="px-6 py-4 font-bold uppercase text-[11px] tracking-widest">
                          Description
                        </th>
                        <th className="px-6 py-4 font-bold uppercase text-[11px] tracking-widest">
                          Department
                        </th>
                        <th className="px-6 py-4 font-bold uppercase text-[11px] tracking-widest">
                          Created
                        </th>
                        <th className="px-6 py-4 font-bold uppercase text-[11px] tracking-widest text-right">
                          Closed
                        </th>
                      </tr>
                    </thead>
                    {/* Body remains the same, but will now scroll under the sticky head */}
                    <tbody className="divide-y divide-gray-100">
                      {filteredTickets.map((t, index) => (
                        <tr
                          key={t.id}
                          onClick={() => navigate(`/Tickets/${t.id}`)}
                          className="group hover:bg-lpu-gold/5 cursor-pointer transition-colors duration-200 animate-in fade-in slide-in-from-left-4"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="px-6 py-5">
                            <span className="bg-gray-100 group-hover:bg-lpu-maroon group-hover:text-white px-3 py-1 rounded-full text-xs font-bold transition-colors">
                              #{t.id}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-sm font-bold text-gray-800 line-clamp-1">
                              {t.Summary}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-sm text-gray-500 line-clamp-1 italic">
                              {t.Description}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-sm font-medium text-lpu-maroon/80 uppercase tracking-tighter">
                              {t.Department}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-sm text-gray-500">
                            {t.created_at
                              ? new Date(t.created_at).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-6 py-5 text-sm text-gray-500 text-right">
                            {t.closed_at ? (
                              <span className="text-lpu-red font-semibold">
                                {new Date(t.closed_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="bg-green-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                Active
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Tickets;
