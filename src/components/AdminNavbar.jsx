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

  // Added h-[40px] to force identical heights across all buttons
  const linkBase =
    "flex items-center justify-center md:justify-start gap-2 px-4 h-[40px] rounded-lg text-[15px] transition-all duration-200";
  const linkInactive =
    "text-white/85 hover:bg-[var(--color-lpu-gold)] hover:text-[var(--color-lpu-maroon)] font-medium";
  const linkActive = "bg-[var(--color-lpu-red)] text-white font-bold shadow-sm";

  const getLinkClass = ({ isActive }) =>
    `${linkBase} ${isActive ? linkActive : linkInactive}`;

  // --- Reusable Admin Dropdown Block ---
  const AdminDropdown = ({ innerRef }) => (
    <div className="relative flex items-center h-[40px]" ref={innerRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={`flex items-center justify-center gap-2 px-4 h-[40px] rounded-lg text-[15px] font-medium transition-all duration-200 ${
          menuOpen
            ? "bg-[var(--color-lpu-red)] text-white shadow-sm font-bold"
            : "text-white/85 hover:bg-[var(--color-lpu-gold)] hover:text-[var(--color-lpu-maroon)]"
        }`}
      >
        <User size={18} />
        <span>Admin</span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popup Menu */}
      {menuOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-3 top-full w-48 bg-white rounded-xl shadow-xl py-2 border border-gray-100 flex flex-col z-50 animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setAccountModalOpen(true);
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[var(--color-lpu-maroon)] transition-colors w-full text-left"
          >
            <User size={16} /> <span>My account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDarkMode((v) => !v);
              setMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[var(--color-lpu-maroon)] transition-colors w-full text-left"
          >
            <Moon size={16} /> <span>Dark Mode</span>
          </button>

          <div className="h-[1px] bg-gray-100 my-1 w-full"></div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full text-left"
          >
            <LogOut size={16} /> <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[var(--color-lpu-maroon)] shadow-md font-poppins">
        <div className="max-w-[1320px] mx-auto px-4 md:px-6 h-[78px] flex items-center justify-between">
          {/* --- Brand Logo & Text --- */}
          <div className="flex items-center gap-3">
            <img
              src={lpuLogo}
              alt="LPU"
              className="h-[42px] md:h-[52px] w-auto"
            />
            <span className="text-white text-xl md:text-2xl lg:text-[34px] font-bold tracking-tight whitespace-nowrap">
              MIS HELP DESK
            </span>
          </div>

          {/* --- Desktop Navigation --- */}
          <nav className="hidden md:flex items-center gap-2 lg:gap-4">
            <NavLink to="/admin/tickets" className={getLinkClass}>
              <Home size={18} />
              <span>Home</span>
            </NavLink>
            <NavLink to="/admin/analytics" className={getLinkClass}>
              <BarChart2 size={18} />
              <span>Analytics</span>
            </NavLink>
            <NavLink to="/admin/knowledge" className={getLinkClass}>
              <BookOpen size={18} />
              <span>Knowledge</span>
            </NavLink>
            {isRoot && (
              <NavLink to="/admin/manage" className={getLinkClass}>
                <Settings size={18} />
                <span>Manage</span>
              </NavLink>
            )}
          </nav>

          {/* --- Desktop Actions & Admin Menu --- */}
          <div className="hidden md:flex items-center gap-4">
            {actions}
            <AdminDropdown innerRef={desktopMenuRef} />
          </div>

          {/* --- Mobile Menu Toggle Button --- */}
          <button
            onClick={toggleMenu}
            className="md:hidden text-white p-2 rounded-lg hover:bg-[var(--color-lpu-red)] hover:text-[var(--color-lpu-gold)] transition-colors"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* --- Mobile Navigation Dropdown --- */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[78px] left-0 w-full bg-[var(--color-lpu-maroon)] border-t border-[var(--color-lpu-red)] shadow-xl flex flex-col p-4 gap-4 animate-in slide-in-from-top-2">
            <nav className="flex flex-col gap-2">
              <NavLink
                to="/admin/tickets"
                onClick={toggleMenu}
                className={getLinkClass}
              >
                <Home size={18} />
                <span>Home</span>
              </NavLink>
              <NavLink
                to="/admin/analytics"
                onClick={toggleMenu}
                className={getLinkClass}
              >
                <BarChart2 size={18} />
                <span>Analytics</span>
              </NavLink>
              <NavLink
                to="/admin/knowledge"
                onClick={toggleMenu}
                className={getLinkClass}
              >
                <BookOpen size={18} />
                <span>Knowledge</span>
              </NavLink>
              {isRoot && (
                <NavLink
                  to="/admin/manage"
                  onClick={toggleMenu}
                  className={getLinkClass}
                >
                  <Settings size={18} />
                  <span>Manage</span>
                </NavLink>
              )}
            </nav>

            {/* Mobile Actions Container */}
            <div className="pt-4 border-t border-[var(--color-lpu-red)] flex flex-row flex-wrap gap-4 items-center justify-center">
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
