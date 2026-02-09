import { useState } from "react";
import "./sidepanel.css";
import { Menu } from "lucide-react";
import { Ticket } from "lucide-react";
import { PlusCircle } from "lucide-react";

const SidePanel = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`side-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="header">
        {!collapsed && <span className="title">MIS HELP DESK</span>}
        <button
          className="close-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle panel"
        >
            <Menu size ={30}/>
        </button>
      </div>

      <div className="panel-content">
        <div className="menu-item">
            <PlusCircle size={30}/>
            {!collapsed && <span>Submit a Ticket</span>}
        </div>
        <div className="menu-item">
            <Ticket size={30}/>
            {!collapsed && <span>Tickets</span>}
        </div>
      </div>

    </aside>
  );
};
export default SidePanel;
