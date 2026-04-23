import { useState } from "react";
import SidePanel from "../components/SidePanel";
import { Outlet, useLocation } from "react-router-dom";
import ChatbotWidget from "../features/ChatbotWidget";

const UserLayout = () => {
  const { pathname } = useLocation();
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(true);
  const isChat = /\/Tickets\/.+/.test(pathname);
  const sidePanelOffsetClass = isSidePanelCollapsed ? "md:ml-25" : "md:ml-87.5";

  return (
    <div className="min-h-dvh">
      <SidePanel
        collapsed={isSidePanelCollapsed}
        onToggleCollapse={() => setIsSidePanelCollapsed((prev) => !prev)}
      />
      <main
        className={`min-h-dvh md:transition-[margin-left] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:md:transition-none ${sidePanelOffsetClass}${isChat ? " p-0 overflow-y-hidden" : ""}`}
      >
        <Outlet />
      </main>
      <ChatbotWidget />
    </div>
  );
};

export default UserLayout;
