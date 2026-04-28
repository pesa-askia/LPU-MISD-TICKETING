import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { jwtDecode } from "jwt-decode";
import { isGlobalAdmin } from "../utils/adminLevels";

const NavbarActionsSetContext = createContext(null);
const NavbarActionsGetContext = createContext(null);

export function NavbarActionsProvider({ children }) {
  const [actions, setActions] = useState(null);

  const isRoot = useMemo(() => {
    try {
      const decoded = jwtDecode(localStorage.getItem("authToken") || "");
      return isGlobalAdmin(decoded?.admin_level ?? 1);
    } catch {
      return false;
    }
  }, []);

  const stableSetActions = useCallback((a) => setActions(a), []);

  const getValue = useMemo(() => ({ actions, isRoot }), [actions, isRoot]);

  return (
    <NavbarActionsSetContext.Provider value={stableSetActions}>
      <NavbarActionsGetContext.Provider value={getValue}>
        {children}
      </NavbarActionsGetContext.Provider>
    </NavbarActionsSetContext.Provider>
  );
}

export function useNavbarActions(actions) {
  const setActions = useContext(NavbarActionsSetContext);

  useEffect(() => {
    setActions(actions);
  });

  useEffect(() => {
    return () => setActions(null);
  }, []);
}

export function useNavbarActionsContext() {
  return useContext(NavbarActionsGetContext);
}

export function NavbarActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 h-8 rounded-lg text-sm font-medium text-white/85 hover:bg-lpu-gold hover:text-lpu-maroon transition-all duration-200"
    >
      {Icon && <Icon size={16} />}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
