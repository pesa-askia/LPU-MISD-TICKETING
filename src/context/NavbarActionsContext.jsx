import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { jwtDecode } from "jwt-decode";
import { isRootAdmin } from "../utils/adminLevels";

// Pages write to this — value is stable (useState setter), so pages never re-render from context changes
const NavbarActionsSetContext = createContext(null);

// AdminNavbar reads from this — updates when actions/isRoot change
const NavbarActionsGetContext = createContext(null);

export function NavbarActionsProvider({ children }) {
  const [actions, setActions] = useState(null);

  const isRoot = useMemo(() => {
    try {
      const decoded = jwtDecode(localStorage.getItem("authToken") || "");
      return isRootAdmin(decoded?.admin_level ?? 1);
    } catch {
      return false;
    }
  }, []);

  // useState setters are already stable, but wrap to be explicit
  const stableSetActions = useCallback((a) => setActions(a), []);

  const getValue = useMemo(
    () => ({ actions, isRoot }),
    [actions, isRoot],
  );

  return (
    <NavbarActionsSetContext.Provider value={stableSetActions}>
      <NavbarActionsGetContext.Provider value={getValue}>
        {children}
      </NavbarActionsGetContext.Provider>
    </NavbarActionsSetContext.Provider>
  );
}

// Pages call this — subscribes only to the stable setter context, never re-renders from actions changes
export function useNavbarActions(actions) {
  const setActions = useContext(NavbarActionsSetContext);

  useEffect(() => {
    setActions(actions);
  });

  useEffect(() => {
    return () => setActions(null);
  }, []);
}

// AdminNavbar calls this — subscribes to the state context
export function useNavbarActionsContext() {
  return useContext(NavbarActionsGetContext);
}
