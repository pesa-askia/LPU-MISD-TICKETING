import "./tickets.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { supabase } from "../../Supabaseclient";

function Tickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("Open Tickets");
  const [search, setSearch] = useState("");

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from("Tickets")
      .select("*")

    console.log("DATA:", data);
    console.log("ERROR:", error);

    if (error) {
      console.error("Error fetching tickets:", error);
    } else {
      setTickets(data || []);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

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
              {tickets
                .filter((t) =>
                  t.Summary?.toLowerCase().includes(search.toLowerCase()),
                )
                .map((t, index) => (
                  <tr
                    key={t.id}
                    className="clickable-row"
                    style={{ "--i": index }}
                    onClick={() => navigate(`/Tickets/${t.id}`)}
                  >
                    <td>No. {t.id}</td>
                    <td>{t.Summary}</td>
                    <td>{t.Description}</td>
                    <td>{t.Department}</td>
                    <td>
                      {t.created_at
                        ? new Date(t.created_at).toLocaleDateString()
                        : ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Tickets;
