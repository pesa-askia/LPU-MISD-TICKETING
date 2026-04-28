import { Routes, Route, Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import LoginPage from "./pages/auth/LoginPage";
import AuthVerifyCallback from "./components/AuthVerifyCallback";
import Tickets from "./pages/User/Tickets";
import TicketChat from "./features/TicketChat/TicketChat";
import SubmitTicket from "./pages/User/SubmitTicket";
import ChatPage from "./pages/User/ChatPage";
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";
import AdminTickets from "./pages/Admin/AdminTickets";
import AdminAnalytics from "./pages/Admin/AdminAnalytics";
import AdminManage from "./pages/Admin/AdminManage";
import AdminKnowledge from "./pages/Admin/AdminKnowledge";
import LoadingScreen from "./components/LoadingScreen";
import { useLoading } from "./context/LoadingContext";

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
  return decoded.app_role === "admin" ? children : <Navigate to="/" replace />;
}

function RootRoute({ children }) {
  const decoded = getValidToken();
  if (!decoded) return <Navigate to="/" replace />;
  if (decoded.app_role !== "admin") return <Navigate to="/" replace />;
  return decoded.admin_level === 0 ? (
    children
  ) : (
    <Navigate to="/admin/tickets" replace />
  );
}

function App() {
  const { isLoading } = useLoading();

  return (
    <>
      <LoadingScreen isLoading={isLoading} />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/auth/callback"
          element={<AuthVerifyCallback mode="magic" />}
        />
        <Route
          path="/admin/verify-email"
          element={<AuthVerifyCallback mode="admin" />}
        />

        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="/admin/tickets" element={<AdminTickets />} />
          <Route path="/admin/tickets/:id" element={<TicketChat adminView />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/knowledge" element={<AdminKnowledge />} />
          <Route
            path="/admin/manage"
            element={
              <RootRoute>
                <AdminManage />
              </RootRoute>
            }
          />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/SubmitTicket" element={<SubmitTicket />} />
          <Route path="/Chat" element={<ChatPage />} />
          <Route path="/Tickets" element={<Tickets />} />
          <Route path="/Tickets/:id" element={<TicketChat />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
