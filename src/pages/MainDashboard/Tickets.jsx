import "./tickets.css";
import { useNavigate } from "react-router-dom";

export const PLACEHOLDER = [
  { id: "1234", category: "LMS", date: "09-02-2026", status: "Not Completed" },
  { id: "1235", category: "Student Portal", date: "07-02-2026", status: "Completed" },
  { id: "1236", category: "ERP", date: "06-02-2026", status: "In Progress" },
];

function Tickets() {
  const navigate = useNavigate();

  return (
    <div className="wrapper">
      <div className="card tickets-card">
        <h1>Ticket</h1>

        <table className="tickets-table" aria-label="tickets table">
          <thead>
            <tr>
              <th>Ticket No.</th>
              <th>Category</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER.map((t) => (
              <tr key={t.id} className="clickable-row" onClick={() => navigate(`/Tickets/${t.id}`)}>
                <td>No. {t.id}</td>
                <td>{t.category}</td>
                <td>{t.date}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Tickets;