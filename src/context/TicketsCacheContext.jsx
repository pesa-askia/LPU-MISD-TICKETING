import { createContext, useContext, useMemo, useState } from "react";

const TicketsCacheContext = createContext(null);

export function TicketsCacheProvider({ children }) {
  const [userTickets, setUserTickets] = useState(null); // null = not loaded yet
  const [adminTickets, setAdminTickets] = useState(null); // null = not loaded yet
  const [ticketsById, setTicketsById] = useState(() => ({})); // { [ticketId]: ticket }
  const [messagesByTicketId, setMessagesByTicketId] = useState(() => ({})); // { [ticketId]: messages[] }

  const value = useMemo(
    () => ({
      userTickets,
      setUserTickets,
      adminTickets,
      setAdminTickets,
      getTicket(ticketId) {
        return ticketsById[String(ticketId)] || null;
      },
      setTicket(ticketId, ticket) {
        setTicketsById((prev) => ({
          ...prev,
          [String(ticketId)]: ticket,
        }));
      },
      getMessages(ticketId) {
        return messagesByTicketId[String(ticketId)] || null;
      },
      setMessages(ticketId, messages) {
        setMessagesByTicketId((prev) => ({
          ...prev,
          [String(ticketId)]: messages,
        }));
      },
      clearTicketsCache() {
        setUserTickets(null);
        setAdminTickets(null);
        setTicketsById({});
        setMessagesByTicketId({});
      },
    }),
    [userTickets, adminTickets, ticketsById, messagesByTicketId],
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

