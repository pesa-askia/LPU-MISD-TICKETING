import { useNavigate, NavLink } from "react-router-dom";
import {
  ChevronRight,
  Ticket,
  PlusCircle,
  CircleUser,
  LogOut,
} from "lucide-react";
import logo from "../assets/lpul-logo.png";

const SidePanel = ({ collapsed, onToggleCollapse }) => {
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

  const desktopIconAnchor = collapsed
    ? "md:left-1/2 md:-translate-x-1/2"
    : "md:left-3 md:translate-x-0";

  const navItemBase = `
    relative flex items-center w-full rounded-lg transition-[background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer border-none no-underline
    max-md:flex-col max-md:gap-1 max-md:p-3 max-md:flex-1 max-md:text-[0.7rem]
    md:text-lg md:min-h-14 md:px-3 md:py-4
    hover:bg-[var(--color-lpu-gold)] hover:text-[var(--color-lpu-maroon)]
  `;

  const activeClass = "bg-[var(--color-lpu-red)] text-white";
  const inactiveClass = "text-white bg-transparent";

  return (
    <aside
      className={`
        flex flex-col bg-lpu-maroon z-1001 font-['Bai_Jamjuree',sans-serif] relative
        md:transition-[width,padding] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:md:transition-none
        md:fixed md:top-0 md:left-0 md:h-full md:p-4
        ${collapsed ? "md:w-25" : "md:w-87.5"}
        max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full max-md:h-auto max-md:flex-row max-md:rounded-t-2xl max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-[0_-4px_20px_rgba(0,0,0,0.2)]
      `}
    >
      {/* ── Refined Dangling Toggle Handle ── */}
      <button
        onClick={onToggleCollapse}
        className={`
          hidden md:flex absolute top-1/2 -translate-y-1/2 items-center justify-center cursor-pointer border-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          bg-lpu-maroon text-white hover:bg-lpu-gold hover:text-lpu-maroon
          /* Sizing and Shape */
          w-10 h-14 rounded-r-xl
          /* Shadow and Position */
          -right-10 shadow-[4px_0_8px_rgba(0,0,0,0.15)]
          z-1002
        `}
        aria-label="Toggle Sidebar"
      >
        <ChevronRight
          size={24}
          strokeWidth={3}
          className={`transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "rotate-0" : "rotate-180"}`}
        />
      </button>

      {/* ── Header ── */}
      <div className="hidden md:flex items-center w-full mb-8 overflow-hidden px-2 h-20">
        <div
          className={`flex items-center flex-1 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "justify-center gap-0" : "gap-4"}`}
        >
          <img
            src={logo}
            alt="Logo"
            className={`object-contain transition-[height,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "h-16 scale-95" : "h-20 scale-100"}`}
          />
          <span
            className={`font-bold text-2xl text-white whitespace-nowrap overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "max-w-0 opacity-0 -translate-x-2" : "max-w-56 opacity-100 translate-x-0"}`}
          >
            MIS HELP DESK
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="flex flex-col gap-2 flex-1 max-md:flex-row max-md:w-full max-md:items-center">
        <NavLink
          to="/Tickets"
          className={({ isActive }) =>
            `${navItemBase} ${isActive ? activeClass : inactiveClass}`
          }
        >
          <Ticket
            size={28}
            className={`shrink-0 md:absolute md:top-1/2 md:-translate-y-1/2 md:transition-[left,transform] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${desktopIconAnchor}`}
          />
          <span
            className={`hidden md:block font-semibold whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "max-w-0 opacity-0 pl-0" : "max-w-32 opacity-100 pl-11"}`}
          >
            Tickets
          </span>
          <span className="md:hidden">Tickets</span>
        </NavLink>

        <NavLink
          to="/SubmitTicket"
          className={({ isActive }) =>
            `${navItemBase} ${isActive ? activeClass : inactiveClass}`
          }
        >
          <PlusCircle
            size={28}
            className={`shrink-0 md:absolute md:top-1/2 md:-translate-y-1/2 md:transition-[left,transform] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${desktopIconAnchor}`}
          />
          <span
            className={`hidden md:block font-semibold whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "max-w-0 opacity-0 pl-0" : "max-w-40 opacity-100 pl-11"}`}
          >
            Submit Ticket
          </span>
          <span className="md:hidden">Submit</span>
        </NavLink>

        {/* User Info & Logout */}
        <div className="hidden md:flex flex-col mt-auto mb-2 w-full">
          <div className="relative flex items-center text-white rounded-lg md:min-h-14 md:px-3 md:py-4">
            <CircleUser
              size={28}
              className={`shrink-0 md:absolute md:top-1/2 md:-translate-y-1/2 md:transition-[left,transform] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${desktopIconAnchor}`}
            />
            <div
              className={`overflow-hidden transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "max-w-0 opacity-0 pl-0" : "max-w-44 opacity-100 pl-11"}`}
            >
              <p className="font-bold text-base">{userEmail.split("@")[0]}</p>
              <p className="text-xs opacity-70">{userEmail}</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className={`${navItemBase} text-white bg-transparent`}
        >
          <LogOut
            size={28}
            className={`shrink-0 md:absolute md:top-1/2 md:-translate-y-1/2 md:transition-[left,transform] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${desktopIconAnchor}`}
          />
          <span
            className={`hidden md:block font-semibold whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "max-w-0 opacity-0 pl-0" : "max-w-28 opacity-100 pl-11"}`}
          >
            Logout
          </span>
          <span className="md:hidden">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default SidePanel;
