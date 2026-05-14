import { useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  BarChart2,
  Brain,
  BookOpen,
  Settings,
  User,
  ChevronDown,
  LogOut,
  Activity,
} from "lucide-react";
import lpuLogo from "../assets/lpul-logo.png";
import { SettingsModal } from "./Modal";
import { useNavbarActionsContext } from "../context/NavbarActionsContext";

// --- Reusable Admin Dropdown Block ---
const AdminDropdown = ({
  innerRef,
  menuOpen,
  setMenuOpen,
  setAccountModalOpen,
  setIsMobileMenuOpen,
  onLogout,
}) => (
  <div className="relative flex items-center h-8" ref={innerRef}>
    <button
      type="button"
      onClick={() => setMenuOpen((v) => !v)}
      className={`flex items-center justify-center lg:justify-start gap-2 px-3 md:px-2 lg:px-3 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${menuOpen
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
          <Settings size={16} /> <span>Settings</span>
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

// --- Analytics Nav Dropdown ---
const AnalyticsDropdown = ({ open, setOpen, innerRef, onMobileClose }) => {
  const location = useLocation();
  const isActive =
    location.pathname === "/admin/analytics" || location.pathname === "/admin/ai-insights";

  const linkBase =
    "flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors w-full text-left";
  const linkInactive = "text-gray-700 hover:bg-gray-50 hover:text-lpu-maroon";
  const linkActive = "text-lpu-maroon bg-lpu-maroon/5 font-semibold";

  return (
    <div className="relative flex items-center h-8" ref={innerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center lg:justify-start gap-2 px-3 md:px-2 lg:px-3 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive || open
            ? "bg-lpu-red text-white shadow-sm font-bold"
            : "text-white/85 hover:bg-lpu-gold hover:text-lpu-maroon"
        }`}
      >
        <BarChart2 size={16} />
        <span className="hidden lg:inline">Analytics</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 mt-2 top-full w-44 bg-white rounded-xl shadow-xl py-2 border border-gray-100 flex flex-col z-50 animate-in fade-in zoom-in-95">
          <NavLink
            to="/admin/analytics"
            onClick={() => { setOpen(false); onMobileClose?.(); }}
            className={({ isActive: a }) => `${linkBase} ${a ? linkActive : linkInactive}`}
          >
            <BarChart2 size={15} />
            <span>Stats</span>
          </NavLink>
          <NavLink
            to="/admin/ai-insights"
            onClick={() => { setOpen(false); onMobileClose?.(); }}
            className={({ isActive: a }) => `${linkBase} ${a ? linkActive : linkInactive}`}
          >
            <Brain size={15} />
            <span>Insights</span>
          </NavLink>
        </div>
      )}
    </div>
  );
};

export default function AdminNavbar() {
  const { actions = null, isRoot } = useNavbarActionsContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const desktopMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const analyticsDesktopRef = useRef(null);
  const analyticsMobileRef = useRef(null);

  // --- Global Dark Mode Logic ---
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("adminDarkMode") === "true",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("admin-dark", darkMode);
    localStorage.setItem("adminDarkMode", String(darkMode));
  }, [darkMode]);

  // --- Close Dropdowns on Outside Click ---
  useEffect(() => {
    const onDocClick = (e) => {
      if (menuOpen) {
        if (
          !desktopMenuRef.current?.contains(e.target) &&
          !mobileMenuRef.current?.contains(e.target)
        ) {
          setMenuOpen(false);
        }
      }
      if (analyticsOpen) {
        if (
          !analyticsDesktopRef.current?.contains(e.target) &&
          !analyticsMobileRef.current?.contains(e.target)
        ) {
          setAnalyticsOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen, analyticsOpen]);

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
            <AnalyticsDropdown
              open={analyticsOpen}
              setOpen={setAnalyticsOpen}
              innerRef={analyticsDesktopRef}
            />
            <NavLink to="/admin/knowledge" className={getLinkClass}>
              <BookOpen size={16} />
              <span className="hidden lg:inline">Knowledge</span>
            </NavLink>
            <NavLink to="/admin/activity" className={getLinkClass}>
              <Activity size={16} />
              <span className="hidden lg:inline">Activity</span>
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
            <AdminDropdown
              innerRef={desktopMenuRef}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              setAccountModalOpen={setAccountModalOpen}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              onLogout={onLogout}
            />
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
              <AnalyticsDropdown
                open={analyticsOpen}
                setOpen={setAnalyticsOpen}
                innerRef={analyticsMobileRef}
                onMobileClose={() => setIsMobileMenuOpen(false)}
              />
              <NavLink
                to="/admin/knowledge"
                onClick={toggleMenu}
                className={getLinkClass}
              >
                <BookOpen size={16} />
                <span>Knowledge</span>
              </NavLink>
              <NavLink
                to="/admin/activity"
                onClick={toggleMenu}
                className={getLinkClass}
              >
                <Activity size={16} />
                <span>Activity</span>
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
              <AdminDropdown
                innerRef={mobileMenuRef}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                setAccountModalOpen={setAccountModalOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                onLogout={onLogout}
              />
            </div>
          </div>
        )}
      </header>

      <SettingsModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((v) => !v)}
      />
    </>
  );
}
