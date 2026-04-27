import { Outlet } from "react-router-dom";
import { NavbarActionsProvider } from "../context/NavbarActionsContext";
import AdminNavbar from "../components/AdminNavbar";

const AdminLayout = () => {
  return (
    <NavbarActionsProvider>
      <div className="admin-shell">
        <AdminNavbar />
        <Outlet />
      </div>
    </NavbarActionsProvider>
  );
};

export default AdminLayout;
