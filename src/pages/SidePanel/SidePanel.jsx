import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./sidepanel.css";
import { Menu } from "lucide-react";
import { Ticket } from "lucide-react";
import { PlusCircle } from "lucide-react";
import { CircleUser } from "lucide-react";
import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import logo from "../../assets/lpul-logo.png";

const SidePanel = () => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail") || "Guest";

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    navigate("/");
  };

  return (
    <aside className={`side-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="header">
        <div className="header-content">
          <img src={logo} alt="MIS Help Desk" className="logo" />
          {!collapsed && <span className="title">MIS HELP DESK</span>}
        </div>
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
          {!collapsed && (
            <span>
              {userEmail.split("@")[0]} <br /> {userEmail}
            </span>
          )}
        </div>

        <button
          className="logout-btn"
          onClick={handleLogout}
          aria-label="Logout"
        >
          <LogOut size={30} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default SidePanel;
