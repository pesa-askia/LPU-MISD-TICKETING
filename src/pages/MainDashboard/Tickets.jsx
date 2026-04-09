import "./tickets.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { realtimeSupabase } from "../../realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";

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
    // Use cached tickets (prevents refetch + loader flash when coming back from chat)
    if (Array.isArray(userTickets)) {
      setTickets(userTickets);
      return;
    }
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setUserTickets(tickets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  if (error) {
    return (
      <div className="wrapper">
        <div
          className="card"
          style={{ textAlign: "center", color: "#d32f2f", padding: "40px" }}
        >
          <h2>Error Loading Tickets</h2>
          <p>{error}</p>
          <button
            onClick={fetchTickets}
            style={{ marginTop: "20px", padding: "10px 20px", cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrapper">
      <div className="card tickets-card">
        <h1>Ticket</h1>

        <div className="tickets-header">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>Open Tickets</option>
            <option>Closed Tickets</option>
          </select>

          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          {(() => {
            const isClosed = (t) => {
              if (!t) return false;
              if (t.closed_at) return true;
              const statusValue = t.status || t.Status || t.state || t.State;
              return String(statusValue || "").toLowerCase().includes("closed");
            };

            const filteredTickets = tickets
              .filter((t) => {
                if (filter === "Open Tickets") return !isClosed(t);
                return isClosed(t);
              })
              .filter(
                (t) =>
                  String(t.id).toLowerCase().includes(search.toLowerCase()) ||
                  t.Summary?.toLowerCase().includes(search.toLowerCase()),
              );

            if (filteredTickets.length === 0) {
              return (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#666",
                    fontWeight: "600",
                  }}
                >
                  <p style={{ fontSize: "1.5rem", margin: 0 }}>No tickets found.</p>
                </div>
              );
            }

            return (
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>Ticket No.</th>
                    <th>Summary</th>
                    <th>Description</th>
                    <th>Department</th>
                    <th>Created</th>
                    <th>Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t, index) => (
                    <tr
                      key={t.id}
                      className="clickable-row"
                      style={{ "--i": index }}
                      onClick={() => navigate(`/Tickets/${t.id}`)}
                    >
                      <td>No. {t.id}</td>
                      <td className="summary">
                        <div className="clamp-text">{t.Summary}</div>
                      </td>
                      <td className="description">
                        <div className="clamp-text">{t.Description}</div>
                      </td>
                      <td>{t.Department}</td>
                      <td>{t.created_at ? new Date(t.created_at).toLocaleString() : "-"}</td>
                      <td>{t.closed_at ? new Date(t.closed_at).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default Tickets;
