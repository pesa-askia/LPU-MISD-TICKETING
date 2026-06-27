import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  ChevronRight,
  Ticket,
  PlusCircle,
  CircleUser,
  LogOut,
  UserCog,
} from "lucide-react";
import logo from "../assets/lpul-logo.png";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { FormModal } from "./Modal";
import {
  FloatingInput,
  FloatingSelect,
  PrimaryButton,
  SecondaryButton,
} from "./FormFields";

const SidePanel = ({ collapsed, onToggleCollapse, onAccountMenuChange }) => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail") || "Guest";

  const [profileOpen, setProfileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  const toggleAccountMenu = useCallback((val) => {
    setAccountMenuOpen(val);
    onAccountMenuChange?.(val);
  }, [onAccountMenuChange]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target))
        toggleAccountMenu(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [toggleAccountMenu]);
  const [profileName, setProfileName] = useState(
    () => localStorage.getItem("userFullName") || userEmail.split("@")[0],
  );
  const [profileType, setProfileType] = useState(
    () => localStorage.getItem("userType") || "",
  );
  const [profileDept, setProfileDept] = useState(
    () => localStorage.getItem("userDepartment") || "",
  );

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    fetch(`${getApiBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !json.user) return;
        const { full_name, user_type, department } = json.user;
        if (full_name) {
          setProfileName(full_name);
          localStorage.setItem("userFullName", full_name);
        }
        if (user_type) {
          setProfileType(user_type);
          localStorage.setItem("userType", user_type);
        }
        if (department) {
          setProfileDept(department);
          localStorage.setItem("userDepartment", department);
        }
        if (!user_type || !department) setProfileOpen(true);
      })
      .catch(() => {
        const type = localStorage.getItem("userType");
        const dept = localStorage.getItem("userDepartment");
        if (!type || !dept) setProfileOpen(true);
      });
  }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("authToken");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: profileName,
          userType: profileType || null,
          department: profileDept || null,
        }),
      });
      const json = await res.json();
      if (json.success && json.token) {
        localStorage.setItem("authToken", json.token);
      }
    } catch (err) {
      console.error("Profile update failed:", err);
    }
    localStorage.setItem("userFullName", profileName);
    localStorage.setItem("userType", profileType);
    localStorage.setItem("userDepartment", profileDept);
    setProfileOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userFullName");
    localStorage.removeItem("userType");
    localStorage.removeItem("userDepartment");
    navigate("/");
  };

  const desktopIconAnchor = collapsed
    ? "md:left-1/2 md:-translate-x-1/2"
    : "md:left-3 md:translate-x-0";

  const navItemBase = `
    relative flex items-center w-full rounded-lg transition-[background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer border-none no-underline
    max-md:flex-col max-md:gap-0.5 max-md:py-2 max-md:px-1 max-md:flex-1 max-md:text-[0.6rem]
    md:text-lg md:min-h-14 md:px-3 md:py-4
    hover:bg-lpu-gold hover:text-lpu-maroon
  `;

  const activeClass = "bg-lpu-red text-white";
  const inactiveClass = "text-white bg-transparent";

  return (
    <aside
      className={`
        flex flex-col bg-lpu-maroon z-1001 font-['Bai_Jamjuree',sans-serif] relative
        
        /* Desktop */
        md:fixed md:top-0 md:left-0 md:h-full
        md:transition-[width,padding] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)]
        ${collapsed ? "md:w-25" : "md:w-87.5"}
        md:p-4

        /* Mobile */
        max-md:order-last max-md:shrink-0 max-md:w-full max-md:h-auto max-md:flex-row
        max-md:rounded-t-2xl 
        max-md:pb-[env(safe-area-inset-bottom)]
        max-md:shadow-[0_-2px_12px_rgba(0,0,0,0.15)]
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
            size={22}
            className={`shrink-0 md:w-7 md:h-7 md:absolute md:top-1/2 md:-translate-y-1/2 md:transition-[left,transform] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${desktopIconAnchor}`}
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
            size={22}
            className={`shrink-0 md:w-7 md:h-7 md:absolute md:top-1/2 md:-translate-y-1/2 md:transition-[left,transform] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${desktopIconAnchor}`}
          />
          <span
            className={`hidden md:block font-semibold whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "max-w-0 opacity-0 pl-0" : "max-w-40 opacity-100 pl-11"}`}
          >
            Submit Ticket
          </span>
          <span className="md:hidden">Submit</span>
        </NavLink>

        {/* Desktop: profile button + logout */}
        <div className="hidden md:flex flex-col mt-auto mb-2 w-full gap-2">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className={`${navItemBase} ${inactiveClass} text-left`}
          >
            <CircleUser
              size={22}
              className={`shrink-0 md:w-7 md:h-7 md:absolute md:top-1/2 md:-translate-y-1/2 md:transition-[left,transform] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${desktopIconAnchor}`}
            />
            <div
              className={`h-7 flex flex-col justify-center min-w-0 overflow-hidden transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "max-w-0 opacity-0 pl-0" : "max-w-72 opacity-100 pl-11"}`}
            >
              <p className="text-sm font-semibold leading-none whitespace-nowrap">
                {profileName || userEmail.split("@")[0]}
              </p>
              <p className="text-[10px] opacity-70 leading-none whitespace-nowrap">
                {userEmail}
              </p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className={`${navItemBase} ${inactiveClass}`}
          >
            <LogOut
              size={22}
              className={`shrink-0 md:w-7 md:h-7 md:absolute md:top-1/2 md:-translate-y-1/2 md:transition-[left,transform] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${desktopIconAnchor}`}
            />
            <span
              className={`font-semibold whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "max-w-0 opacity-0 pl-0" : "max-w-28 opacity-100 pl-11"}`}
            >
              Logout
            </span>
          </button>
        </div>

        {/* Mobile: Account button with upward dropdown */}
        <div className="relative md:hidden flex-1" ref={accountMenuRef}>
          {accountMenuOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-white rounded-xl shadow-xl py-2 border border-gray-100 flex flex-col z-50">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(true);
                  toggleAccountMenu(false);
                }}
                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-lpu-maroon transition-colors w-full text-left"
              >
                <UserCog size={16} />
                <span>Edit Profile</span>
              </button>
              <div className="h-px bg-gray-100 my-1" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full text-left"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleAccountMenu(!accountMenuOpen)}
            className={`${navItemBase} ${inactiveClass} w-full`}
          >
            <CircleUser size={22} />
            <span className="md:hidden">Account</span>
          </button>
        </div>

        {profileOpen && (
          <FormModal
            title="Edit Profile"
            icon={UserCog}
            onClose={() => setProfileOpen(false)}
          >
            <form
              onSubmit={handleProfileSave}
              className="flex flex-col gap-4 p-5"
            >
              <p className="text-sm text-gray-500 dark:text-zinc-400 -mt-1">
                Set your name, type, and department so you won't have to fill
                them in every ticket.
              </p>
              <FloatingInput
                label="Full Name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                autoComplete="name"
              />
              <FloatingSelect
                label="Type"
                value={profileType}
                onChange={(e) => setProfileType(e.target.value)}
                options={["Student", "Faculty", "Admin"]}
                required={false}
              />
              <FloatingSelect
                label="Department"
                value={profileDept}
                onChange={(e) => setProfileDept(e.target.value)}
                options={[
                  "CAS",
                  "CBA",
                  "CITHM",
                  "COECS",
                  "LPU-SC",
                  "Highschool",
                ]}
                required={false}
              />
              <div className="flex gap-3 pt-1">
                <SecondaryButton
                  label="Skip"
                  onClick={() => setProfileOpen(false)}
                  className="flex-1"
                />
                <PrimaryButton label="Save" className="flex-1" />
              </div>
            </form>
          </FormModal>
        )}
      </div>
    </aside>
  );
};

export default SidePanel;
