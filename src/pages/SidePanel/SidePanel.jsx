import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./sidepanel.css";
import { Menu } from "lucide-react";
import { Ticket } from "lucide-react";
import { PlusCircle } from "lucide-react";
import { CircleUser } from "lucide-react";
import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";

const SidePanel = () => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    navigate("/");
  };

  return (
    <aside className={`side-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="header">
        {!collapsed && <span className="title">MIS HELP DESK</span>}
        <button
          className="close-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle panel"
        >
          <Menu size={30} />
        </button>
      </div>

      <div className="panel-content">
        <NavLink to="/SubmitTicket" className="menu-item">
          <PlusCircle size={30} />
          {!collapsed && <span>Submit a Ticket</span>}
        </NavLink>
        <NavLink to="/Tickets" className="menu-item">
          <Ticket size={30} />
          {!collapsed && <span>Tickets</span>}
        </NavLink>

        <div className="user-info">
          <CircleUser size={30} />
          {!collapsed && <span>Jane Doe <br /> janedoe@email.com</span>}
        </div>

        <button className="logout-btn" onClick={handleLogout} aria-label="Logout">
          <LogOut size={30} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default SidePanel;
