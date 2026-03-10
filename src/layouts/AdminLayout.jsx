import { Outlet } from "react-router-dom";
import "./AdminLayout.css";

const AdminLayout = () => {
  return (
    <div className="admin-shell">
      <Outlet />
    </div>
  );
};

export default AdminLayout;

