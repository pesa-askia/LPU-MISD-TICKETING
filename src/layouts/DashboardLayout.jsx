import SidePanel from "../pages/SidePanel/SidePanel";
import { Outlet } from "react-router-dom";
import ChatbotWidget from "../components/ChatbotWidget/ChatbotWidget";
import "./DashboardLayout.css";

const DashboardLayout = () => {
  return (
    <div className="dashboard">
      <SidePanel />
      <main className="content">
        <Outlet />
      </main>
      <ChatbotWidget />
    </div>
  );
};

export default DashboardLayout;
