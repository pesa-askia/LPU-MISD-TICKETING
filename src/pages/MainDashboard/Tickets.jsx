import "./tickets.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { supabase } from "../../supabaseClient";
import { useLoading } from "../../context/LoadingContext";

function Tickets() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("Open Tickets");
  const [search, setSearch] = useState("");

  const fetchTickets = async () => {
    try {
      showLoading();
      setError(null);

      // Get user ID from JWT token
      const token = localStorage.getItem("authToken");
      if (!token) {
        setError("You must be logged in to view tickets.");
        hideLoading();
        return;
      }

      const decoded = jwtDecode(token);
      const userId = decoded.id;

      // Fetch only tickets created by this user
      const { data, error } = await supabase
        .from("Tickets")
        .select("*")
        .eq("created_by", userId)
        .order("id", { ascending: false });

      console.log("DATA:", data);
      console.log("ERROR:", error);

      if (error) {
        console.error("Error fetching tickets:", error);
        setError(error.message || "Failed to load tickets");
      } else {
        setTickets(data || []);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("An unexpected error occurred");
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

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
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
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
            const filteredTickets = tickets.filter(
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
                  <p style={{ fontSize: "1.5rem", margin: 0 }}>
                    No tickets found.
                  </p>
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
                    <th>Updated</th>
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
