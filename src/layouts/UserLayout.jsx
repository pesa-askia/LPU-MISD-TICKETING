import SidePanel from "./SidePanel/SidePanel";
import { Outlet, useLocation } from "react-router-dom";
import ChatbotWidget from "../components/ChatbotWidget/ChatbotWidget";
import "./UserLayout.css";

const UserLayout = () => {
  const { pathname } = useLocation();
  const isChat = /\/Tickets\/.+/.test(pathname);

  return (
    <div className="dashboard">
      <SidePanel />
      <main
        className="content"
        style={isChat ? { padding: 0, overflowY: "hidden" } : undefined}
      >
        <Outlet />
      </main>
      <ChatbotWidget />
    </div>
  );
};

export default UserLayout;
