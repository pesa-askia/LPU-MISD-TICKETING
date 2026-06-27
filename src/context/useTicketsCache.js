import { useContext } from "react";
import { TicketsCacheContext } from "./ticketsCacheContextValue";

export function useTicketsCache() {
  const ctx = useContext(TicketsCacheContext);
  if (!ctx) {
    throw new Error("useTicketsCache must be used within TicketsCacheProvider");
  }
  return ctx;
}
