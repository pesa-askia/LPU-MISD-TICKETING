import { Routes, Route } from "react-router-dom";
import Tickets from "../MainDashboard/Tickets";
import SubmitTicket from "../MainDashboard/SubmitTicket";
import DashboardLayout from "../../layouts/DashboardLayout";

function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/SubmitTicket" element={<SubmitTicket />} />
        <Route path="/Tickets" element={<Tickets />} />
      </Route>
    </Routes>
  );
}

export default App;
