import { createContext, useContext, useMemo, useState } from "react";

const TicketsCacheContext = createContext(null);

export function TicketsCacheProvider({ children }) {
  const [userTickets, setUserTickets] = useState(null); // null = not loaded yet
  const [adminTickets, setAdminTickets] = useState(null); // null = not loaded yet

  const value = useMemo(
    () => ({
      userTickets,
      setUserTickets,
      adminTickets,
      setAdminTickets,
      clearTicketsCache() {
        setUserTickets(null);
        setAdminTickets(null);
      },
    }),
    [userTickets, adminTickets],
  );

  return (
    <TicketsCacheContext.Provider value={value}>
      {children}
    </TicketsCacheContext.Provider>
  );
}

export function useTicketsCache() {
  const ctx = useContext(TicketsCacheContext);
  if (!ctx) {
    throw new Error("useTicketsCache must be used within TicketsCacheProvider");
  }
  return ctx;
}

