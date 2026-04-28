import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  BarChart2,
  BookOpen,
  Settings,
  User,
  ChevronDown,
  Moon,
  LogOut,
} from "lucide-react";
import lpuLogo from "../assets/lpul-logo.png";
import AdminAccountSettingsModal from "../pages/Admin/components/AdminAccountSettingsModal";
import { useNavbarActionsContext } from "../context/NavbarActionsContext";

export default function AdminNavbar() {
  const { actions = null, isRoot } = useNavbarActionsContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const desktopMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // --- Global Dark Mode Logic ---
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("adminDarkMode") === "true",
  );

  useEffect(() => {
    const root = document.querySelector(".admin-shell");
    if (!root) return;
    root.classList.toggle("admin-dark", darkMode);
    localStorage.setItem("adminDarkMode", String(darkMode));
  }, [darkMode]);

  // --- Close Dropdown on Outside Click ---
  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuOpen) return;
      if (
        desktopMenuRef.current?.contains(e.target) ||
        mobileMenuRef.current?.contains(e.target)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  // --- Global Logout Logic ---
  const onLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    window.location.href = "/";
  };

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Adjusted alignment and padding: centered & thinner on 'md' (icons only), left-aligned & wider on 'lg' (with text)
  const linkBase =
    "flex items-center justify-center lg:justify-start gap-2 px-3 md:px-2 lg:px-3 h-8 rounded-lg text-sm transition-all duration-200";
  const linkInactive =
    "text-white/85 hover:bg-lpu-gold hover:text-lpu-maroon font-medium";
  const linkActive = "bg-lpu-red text-white font-bold shadow-sm";

  const getLinkClass = ({ isActive }) =>
    `${linkBase} ${isActive ? linkActive : linkInactive}`;

  // --- Reusable Admin Dropdown Block ---
  const AdminDropdown = ({ innerRef }) => (
    <div className="relative flex items-center h-8" ref={innerRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={`flex items-center justify-center lg:justify-start gap-2 px-3 md:px-2 lg:px-3 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
          menuOpen
            ? "bg-lpu-red text-white shadow-sm font-bold"
            : "text-white/85 hover:bg-lpu-gold hover:text-lpu-maroon"
        }`}
      >
        <User size={16} />
        {/* Hide text on iPad (md), show on desktop (lg) */}
        <span className="hidden lg:inline">Admin</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popup Menu */}
      {menuOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-2 top-full w-48 bg-white rounded-xl shadow-xl py-2 border border-gray-100 flex flex-col z-50 animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setAccountModalOpen(true);
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-lpu-maroon transition-colors w-full text-left"
          >
            <User size={16} /> <span>My account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDarkMode((v) => !v);
              setMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-lpu-maroon transition-colors w-full text-left"
          >
            <Moon size={16} /> <span>Dark Mode</span>
          </button>

          <div className="h-px bg-gray-100 my-1 w-full"></div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full text-left"
          >
            <LogOut size={16} /> <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-lpu-maroon shadow-md font-poppins">
        <div className="max-w-330 mx-auto px-4 md:px-6 h-12 flex items-center justify-between">
          {/* --- Brand Logo & Text --- */}
          <div className="flex items-center gap-2 md:gap-3">
            <img src={lpuLogo} alt="LPU" className="h-8 md:h-9 w-auto" />
            <span className="text-white text-xl md:text-[22px] font-bold tracking-tight whitespace-nowrap">
              MIS HELP DESK
            </span>
          </div>

          {/* --- Desktop Navigation --- */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <NavLink to="/admin/tickets" className={getLinkClass}>
              <Home size={16} />
              {/* Added hidden lg:inline to text */}
              <span className="hidden lg:inline">Home</span>
            </NavLink>
            <NavLink to="/admin/analytics" className={getLinkClass}>
              <BarChart2 size={16} />
              <span className="hidden lg:inline">Analytics</span>
            </NavLink>
            <NavLink to="/admin/knowledge" className={getLinkClass}>
              <BookOpen size={16} />
              <span className="hidden lg:inline">Knowledge</span>
            </NavLink>
            {isRoot && (
              <NavLink to="/admin/manage" className={getLinkClass}>
                <Settings size={16} />
                <span className="hidden lg:inline">Manage</span>
              </NavLink>
            )}
          </nav>

          {/* --- Desktop Actions & Admin Menu --- */}
          <div className="hidden md:flex items-center gap-2 md:gap-4">
            {actions}
            <AdminDropdown innerRef={desktopMenuRef} />
          </div>

          {/* --- Mobile Menu Toggle Button --- */}
          <button
            onClick={toggleMenu}
            className="md:hidden text-white p-1.5 rounded-lg hover:bg-lpu-red hover:text-lpu-gold transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* --- Mobile Navigation Dropdown --- */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-12 left-0 w-full bg-lpu-maroon border-t border-lpu-red shadow-xl flex flex-col p-4 gap-4 animate-in slide-in-from-top-2">
            <nav className="flex flex-col gap-2">
              <NavLink
                to="/admin/tickets"
                onClick={toggleMenu}
                className={getLinkClass}
              >
                <Home size={16} />
                {/* Text remains visible in mobile dropdown menu */}
                <span>Home</span>
              </NavLink>
              <NavLink
                to="/admin/analytics"
                onClick={toggleMenu}
                className={getLinkClass}
              >
                <BarChart2 size={16} />
                <span>Analytics</span>
              </NavLink>
              <NavLink
                to="/admin/knowledge"
                onClick={toggleMenu}
                className={getLinkClass}
              >
                <BookOpen size={16} />
                <span>Knowledge</span>
              </NavLink>
              {isRoot && (
                <NavLink
                  to="/admin/manage"
                  onClick={toggleMenu}
                  className={getLinkClass}
                >
                  <Settings size={16} />
                  <span>Manage</span>
                </NavLink>
              )}
            </nav>

            {/* Mobile Actions Container */}
            <div className="pt-4 border-t border-lpu-red flex flex-row flex-wrap gap-4 items-center justify-center">
              {actions}
              <AdminDropdown innerRef={mobileMenuRef} />
            </div>
          </div>
        )}
      </header>

      <AdminAccountSettingsModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />
    </>
  );
}
