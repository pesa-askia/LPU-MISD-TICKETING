import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../LoginPage/LoginPage";
import Tickets from "../MainDashboard/Tickets";
import TicketChat from "../MainDashboard/TicketChat";
import SubmitTicket from "../MainDashboard/SubmitTicket";
import DashboardLayout from "../../layouts/DashboardLayout";
import LoadingScreen from "../../components/LoadingScreen";
import { useLoading } from "../../context/LoadingContext";

function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  return isLoggedIn ? children : <Navigate to="/" replace />;
}

function App() {
  const { isLoading } = useLoading();

  return (
    <>
      <LoadingScreen isLoading={isLoading} />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/SubmitTicket" element={<SubmitTicket />} />
          <Route path="/Tickets" element={<Tickets />} />
          <Route path="/Tickets/:id" element={<TicketChat />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
