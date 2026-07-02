import { useEffect, useRef } from "react";
import { realtimeSupabase } from "../lib/realtimeSupabaseClient";
import {
  installAudioUnlock,
  playNewTicketSound,
} from "../utils/notificationSound";

const CLOSED_STATE_PAGE_SIZE = 1000;

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function isClosed(ticket) {
  return !!ticket?.closed_at;
}

export default function AdminTicketNotifications() {
  const closedTicketIdsRef = useRef(new Set());

  useEffect(() => installAudioUnlock(), []);

  useEffect(() => {
    let cancelled = false;

    const rememberClosedTicketIds = async () => {
      let from = 0;

      while (!cancelled) {
        const { data, error } = await realtimeSupabase
          .from("Tickets")
          .select("id")
          .not("closed_at", "is", null)
          .order("id", { ascending: true })
          .range(from, from + CLOSED_STATE_PAGE_SIZE - 1);

        if (cancelled || error) return;

        (data || []).forEach((ticket) => {
          if (ticket?.id != null) closedTicketIdsRef.current.add(ticket.id);
        });

        if (!data || data.length < CLOSED_STATE_PAGE_SIZE) return;
        from += CLOSED_STATE_PAGE_SIZE;
      }
    };

    void rememberClosedTicketIds();

    const channel = realtimeSupabase
      .channel("admin_ticket_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Tickets" },
        (payload) => {
          const ticket = payload.new;
          if (ticket?.id != null && isClosed(ticket)) {
            closedTicketIdsRef.current.add(ticket.id);
          }
          void playNewTicketSound();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Tickets" },
        (payload) => {
          const ticket = payload.new;
          if (ticket?.id == null) return;

          const nowClosed = isClosed(ticket);
          const wasClosed = hasOwn(payload.old, "closed_at")
            ? !!payload.old.closed_at
            : closedTicketIdsRef.current.has(ticket.id);

          if (wasClosed && !nowClosed) void playNewTicketSound();

          if (nowClosed) {
            closedTicketIdsRef.current.add(ticket.id);
          } else {
            closedTicketIdsRef.current.delete(ticket.id);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      realtimeSupabase.removeChannel(channel);
    };
  }, []);

  return null;
}
