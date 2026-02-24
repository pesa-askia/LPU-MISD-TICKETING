import "./tickets.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export const PLACEHOLDER = [
  {
    id: "1234",
    summary: "This is a test",
    description: "This is a test",
    assignee: "Support 1",
    updated: "",
  },
  {
    id: "1235",
    summary: "This is a test",
    description: "This is a test",
    assignee: "Support 2",
    updated: "",
  },
  {
    id: "1236",
    summary: "This is a test",
    description: "This is a test",
    assignee: "Support 3",
    updated: "",
  },
];

function Tickets() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("Open Tickets");
  const [search, setSearch] = useState("");

  return (
    <div className="wrapper">
      <div className="card tickets-card">
        <h1>Ticket</h1>

        {/* Header Controls */}
        <div className="tickets-header">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>Open Tickets</option>
            <option>Closed Tickets</option>
          </select>

          <input
            type="text"
            placeholder="🔍︎ Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <table className="tickets-table" aria-label="tickets table">
          <thead>
            <tr>
              <th>Ticket No.</th>
              <th>Summary</th>
              <th>Description</th>
              <th>Assignee</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER.map((t, index) => (
              <tr
                key={t.id}
                className="clickable-row"
                style={{ "--i": index }}
                onClick={() => navigate(`/Tickets/${t.id}`)}
              >
                <td>No. {t.id}</td>
                <td>{t.summary}</td>
                <td>{t.description}</td>
                <td>{t.assignee}</td>
                <td>{t.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Tickets;
