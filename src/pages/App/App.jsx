import { Routes, Route, Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import LoginPage from "../LoginPage/LoginPage";
import Tickets from "../MainDashboard/Tickets";
import TicketChat from "../MainDashboard/TicketChat";
import SubmitTicket from "../MainDashboard/SubmitTicket";
import DashboardLayout from "../../layouts/DashboardLayout";
import AdminLayout from "../../layouts/AdminLayout";
import AdminTickets from "../Admin/AdminTickets";
import AdminTicketChat from "../Admin/AdminTicketChat";
import AdminAnalytics from "../Admin/AdminAnalytics";
import LoadingScreen from "../../components/LoadingScreen";
import { useLoading } from "../../context/LoadingContext";

function getValidToken() {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  try {
    const decoded = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) {
      // Expired — clear stale auth state
      localStorage.removeItem("authToken");
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
      localStorage.removeItem("userEmail");
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function ProtectedRoute({ children }) {
  return getValidToken() ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const decoded = getValidToken();
  if (!decoded) return <Navigate to="/" replace />;
  return decoded.role === "admin" ? children : <Navigate to="/" replace />;
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
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="/admin/tickets" element={<AdminTickets />} />
          <Route path="/admin/tickets/:id" element={<AdminTicketChat />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
        </Route>

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
