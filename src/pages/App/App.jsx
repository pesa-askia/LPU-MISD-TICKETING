import { Routes, Route } from "react-router-dom";
import LoginPage from "../LoginPage/LoginPage";
import Tickets from "../MainDashboard/Tickets";
import TicketChat from "../MainDashboard/TicketChat";
import SubmitTicket from "../MainDashboard/SubmitTicket";
import DashboardLayout from "../../layouts/DashboardLayout";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route element={<DashboardLayout />}>
        <Route path="/SubmitTicket" element={<SubmitTicket />} />
        <Route path="/Tickets" element={<Tickets />} />
        <Route path="/Tickets/:id" element={<TicketChat />} />
      </Route>
    </Routes>
  );
}

export default App;
