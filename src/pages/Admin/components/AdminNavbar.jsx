import { NavLink } from "react-router-dom";
import lpuLogo from "../../../assets/lpul-logo.png";
import "../AdminAnalytics.css";

export default function AdminNavbar({ isRoot, actions = null }) {
  return (
    <header className="analytics-topbar">
      <div className="analytics-topbar-inner">
        <div className="analytics-brand" aria-label="LPU MIS Help Desk">
          <img src={lpuLogo} alt="LPU" className="analytics-brand-logo" />
          <span className="analytics-brand-text">MIS HELP DESK</span>
        </div>
        <nav className="analytics-nav-links" aria-label="Admin navigation">
          <NavLink
            to="/admin/tickets"
            className={({ isActive }) =>
              `analytics-nav-link ${isActive ? "active" : ""}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/admin/analytics"
            className={({ isActive }) =>
              `analytics-nav-link ${isActive ? "active" : ""}`
            }
          >
            Analytics
          </NavLink>
          <NavLink
            to="/admin/knowledge"
            className={({ isActive }) =>
              `analytics-nav-link ${isActive ? "active" : ""}`
            }
          >
            Knowledge
          </NavLink>
          {isRoot && (
            <NavLink
              to="/admin/manage"
              className={({ isActive }) =>
                `analytics-nav-link ${isActive ? "active" : ""}`
              }
            >
              Manage
            </NavLink>
          )}
        </nav>

        {actions ? <div className="analytics-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
