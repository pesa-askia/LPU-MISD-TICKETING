import { Outlet } from "react-router-dom";
import { NavbarActionsProvider } from "../context/NavbarActionsContext";
import AdminNavbar from "../components/AdminNavbar";
import AdminNotifications from "../components/AdminNotifications";

const AdminLayout = () => {
  return (
    <NavbarActionsProvider>
      <div className="admin-shell h-dvh flex flex-col overflow-hidden bg-slate-50 dark:bg-[#09090b] md:h-screen">
        <AdminNotifications />
        <AdminNavbar />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </NavbarActionsProvider>
  );
};

export default AdminLayout;
