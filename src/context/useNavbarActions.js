import { useContext, useEffect } from "react";
import {
  NavbarActionsGetContext,
  NavbarActionsSetContext,
} from "./navbarActionsContextValue";

export function useNavbarActions(actions) {
  const setActions = useContext(NavbarActionsSetContext);

  useEffect(() => {
    if (!setActions) return undefined;
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);
}

export function useNavbarActionsContext() {
  return useContext(NavbarActionsGetContext) || { actions: null, isRoot: false };
}
