import { useState } from "react";
import SidePanel from "../components/SidePanel";
import { Outlet, useLocation } from "react-router-dom";
import ChatbotWidget from "../features/ChatbotWidget";
import { ChatbotProvider } from "../context/ChatbotContext";

const UserLayout = () => {
  const { pathname } = useLocation();
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(true);
  const isFullChatPage = pathname === "/Chat";
  const isTicketChat = /^\/Tickets\/[^/]+$/i.test(pathname);
  const hideChatbot = isFullChatPage || isTicketChat;
  const sidePanelOffsetClass = isSidePanelCollapsed ? "md:ml-25" : "md:ml-87.5";

  return (
    <ChatbotProvider>
      <div className="h-dvh flex flex-col md:flex-row overflow-hidden bg-slate-50">
        <SidePanel
          collapsed={isSidePanelCollapsed}
          onToggleCollapse={() => setIsSidePanelCollapsed((prev) => !prev)}
        />
        <main
          className={`flex-1 overflow-y-auto min-h-0 md:transition-[margin-left] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${sidePanelOffsetClass}`}
        >
          <Outlet />
        </main>
        {!hideChatbot && <ChatbotWidget />}
      </div>
    </ChatbotProvider>
  );
};

export default UserLayout;
