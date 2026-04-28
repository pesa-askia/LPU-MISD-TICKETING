import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useLoading } from "../../context/LoadingContext";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import ChatHeader from "./ChatHeader";
import TicketDetails from "./TicketDetails";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import AttachmentViewer from "./AttachmentViewer";

export default function TicketChat({ adminView = false } = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const {
    getTicket,
    getMessages,
    setTicket: cacheTicket,
    setMessages: cacheMessages,
  } = useTicketsCache();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedSummary, setExpandedSummary] = useState(false);
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const [timelineHistory, setTimelineHistory] = useState([]);
  const scrollRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const userIdRef = useRef(null);
  const seenMessageIdsRef = useRef(new Set());
  const [viewerId, setViewerId] = useState(null);
  const [viewerEmail, setViewerEmail] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [adminDirectory, setAdminDirectory] = useState({});
  const adminDirectoryRef = useRef({});
  const [creatorProfile, setCreatorProfile] = useState(null);

  const normalizeTicketId = (value) => {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  };

  const ticketKey = normalizeTicketId(id);
  const cachedMessages = getMessages(ticketKey);

  const getDisplayName = (name, email, role, senderId) => {
    const trimmedName = (name || "").trim();
    const emailValue = (email || "").trim();
    const emailKey = emailValue.toLowerCase();
    const adminName =
      role === "admin"
        ? (senderId && adminDirectory[senderId]) ||
          (emailKey && adminDirectory[emailKey]) ||
          ""
        : "";

    if (adminName) return adminName;
    if (trimmedName) return trimmedName;
    if (emailValue) return emailValue.split("@")[0];
    return role === "admin" ? "Admin" : "Student";
  };

  const getStoredProfile = () => {
    const storedName = (localStorage.getItem("userFullName") || "").trim();
    const storedEmail = (localStorage.getItem("userEmail") || "").trim();
    const email = storedEmail || viewerEmail || "";
    const name = storedName || (email ? email.split("@")[0] : "");
    return { name, email };
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const isTicketClosed = (ticketData) => {
    if (!ticketData) return false;
    if (ticketData.closed_at) return true;
    const statusValue =
      ticketData?.status ??
      ticketData?.Status ??
      ticketData?.state ??
      ticketData?.State;
    return String(statusValue || "")
      .toLowerCase()
      .includes("closed");
  };

  const handleCloseTicket = async () => {
    if (!ticket) return;

    try {
      showLoading();
      const now = new Date().toISOString();
      const nextClosed = !isTicketClosed(ticket);
      const payload = nextClosed
        ? { status: "Closed", closed_at: now }
        : { status: "Open", closed_at: null };

      const token = localStorage.getItem("authToken");
      const res = await fetch(
        `${getApiBaseUrl()}/api/tickets/${ticket.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        alert(json.message || "Failed to update ticket status");
        return;
      }

      const updated = json.data || { ...ticket, ...payload };
      setTicket(updated);
      cacheTicket(id, updated);
    } catch (err) {
      console.error("Unexpected error updating ticket:", err);
      alert("Unexpected error updating ticket status");
    } finally {
      hideLoading();
    }
  };

  // Fetch ticket directly from Supabase (RLS enforces ownership)
  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setError(null);

        const cached = getTicket(id);
        if (cached) {
          setTicket(cached);
        } else {
          showLoading();
        }

        const token = localStorage.getItem("authToken");
        if (!token) {
          setError("You must be logged in to view tickets.");
          hideLoading();
          return;
        }

        const decoded = jwtDecode(token);
        userIdRef.current = decoded.id;
        setViewerId(decoded.id);
        setViewerEmail(decoded.email || "");

        let q = realtimeSupabase.from("Tickets").select("*").eq("id", id);
        if (!adminView) q = q.eq("created_by", decoded.id);
        const { data, error } = await q.single();

        if (error) {
          setError(
            error.code === "PGRST116"
              ? "Ticket not found or you don't have permission to view this ticket."
              : error.message || "Failed to load ticket",
          );
        } else if (!data) {
          setError(
            "Ticket not found or you don't have permission to view this ticket.",
          );
        } else {
          setTicket(data);
          cacheTicket(id, data);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred");
      } finally {
        hideLoading();
      }
    };

    fetchTicket();
  }, [id, adminView, getTicket, cacheTicket, showLoading, hideLoading]);

  // Fetch timeline history snapshots (admin-only visibility depends on RLS)
  useEffect(() => {
    if (!id) return;
    let isCancelled = false;
    const ticketId = normalizeTicketId(id);

    const isMissingTable = (err) => {
      if (!err) return false;
      const msg = String(err.message || "").toLowerCase();
      return msg.includes("ticket_sla_history") && msg.includes("could not find");
    };

    const loadHistory = async () => {
      try {
        const res = await realtimeSupabase
          .from("ticket_sla_history")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("closed_at", { ascending: false })
          .limit(25);

        if (res.error) {
          if (isMissingTable(res.error)) return;
          console.error("[Timeline] Failed to load history:", res.error);
          return;
        }
        if (isCancelled) return;
        setTimelineHistory(res.data || []);
      } catch (e) {
        console.error("[Timeline] Unexpected error:", e);
      }
    };

    loadHistory();

    // Realtime updates: when a new snapshot is inserted, refetch
    const channel = realtimeSupabase
      .channel(`ticket_sla_history_${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_sla_history",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          loadHistory();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR")
          console.error("Realtime channel error for ticket_sla_history");
      });

    return () => {
      isCancelled = true;
      realtimeSupabase.removeChannel(channel);
    };
  }, [id, ticket?.closed_at]);

  useEffect(() => {
    if (!ticket?.created_by) return;

    const existingName = (
      ticket.full_name ||
      ticket.created_by_name ||
      ""
    ).trim();
    if (existingName) {
      setCreatorProfile(null);
      return;
    }

    let isCancelled = false;

    const fetchCreatorProfile = async () => {
      const creatorId = ticket.created_by;
      const selectFields = "id, full_name, email";

      const getFromTable = async (table) => {
        const { data, error } = await realtimeSupabase
          .from(table)
          .select(selectFields)
          .eq("id", creatorId)
          .limit(1);
        if (error) return null;
        return data?.[0] || null;
      };

      const adminRow = await getFromTable("admin_users");
      const row = adminRow || (await getFromTable("auth_users"));
      if (!row || isCancelled) return;

      const fullName = (row.full_name || "").trim();
      const email = (row.email || "").trim();
      if (!fullName && !email) return;

      setCreatorProfile({ fullName, email });
    };

    fetchCreatorProfile();

    return () => {
      isCancelled = true;
    };
  }, [ticket?.created_by, ticket?.created_by_name, ticket?.full_name]);

  useEffect(() => {
    if (!ticketKey) return;
    const cached = getMessages(ticketKey);
    if (Array.isArray(cached) && cached.length > 0) {
      setMessages(cached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketKey]);

  // Load existing messages + subscribe to realtime updates
  useEffect(() => {
    const ticketId = ticketKey;
    if (!ticketId) return;

    let isCancelled = false;

    const mapRow = (row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderRole: row.sender_role,
      senderName: row.sender_name || null,
      senderEmail: row.sender_email || null,
      text: row.message_text,
      attachments: parseMessageAttachments(row.attachments),
      time: row.created_at,
    });

    const isMissingColumn = (err, column) => {
      if (!err) return false;
      const message = String(err.message || "").toLowerCase();
      const details = String(err.details || "").toLowerCase();
      return (
        err.code === "42703" ||
        message.includes(column) ||
        details.includes(column)
      );
    };

    const loadMessages = async () => {
      try {
        let res = await realtimeSupabase
          .from("ticket_messages")
          .select(
            "id, sender_id, sender_role, sender_name, sender_email, message_text, attachments, created_at",
          )
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false })
          .range(0, 99);

        if (res.error && isMissingColumn(res.error, "attachments")) {
          res = await realtimeSupabase
            .from("ticket_messages")
            .select(
              "id, sender_id, sender_role, sender_name, sender_email, message_text, created_at",
            )
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: false })
            .range(0, 99);
        }

        if (res.error) {
          console.error("[Chat] Error loading messages:", res.error);
          return;
        }
        if (isCancelled) return;

        const mapped = (res.data || [])
          .map((row) => {
            seenMessageIdsRef.current.add(row.id);
            return mapRow(row);
          })
          .reverse();
        setMessages(mapped);
      } catch (err) {
        console.error("Unexpected error loading messages:", err);
      }
    };

    loadMessages();

    const channel = realtimeSupabase
      .channel(`ticket_messages_${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row || seenMessageIdsRef.current.has(row.id)) return;
          seenMessageIdsRef.current.add(row.id);
          setMessages((prev) => {
            return [...prev, mapRow(row)];
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR")
          console.error("Realtime channel error for ticket_messages");
      });

    return () => {
      isCancelled = true;
      realtimeSupabase.removeChannel(channel);
    };
  }, [ticketKey]);

  useEffect(() => {
    if (!ticketKey || !messages.length) return;
    cacheMessages(ticketKey, messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketKey, messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateStickiness = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      isAtBottomRef.current = distanceFromBottom < 120;
    };

    updateStickiness();
    el.addEventListener("scroll", updateStickiness);
    return () => el.removeEventListener("scroll", updateStickiness);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const adminIds = new Set();

    for (const msg of messages) {
      if (msg.senderRole !== "admin") continue;
      if (msg.senderId) adminIds.add(msg.senderId);
    }

    if (!adminIds.size) return;

    adminDirectoryRef.current = adminDirectory;
    const missingIds = Array.from(adminIds).filter((id) => !adminDirectoryRef.current[id]);

    if (!missingIds.length) return;

    let isCancelled = false;

    const fetchAdminDirectory = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      const baseUrl = getApiBaseUrl();
      const next = { ...adminDirectoryRef.current };
      let didUpdate = false;

      const setEntry = (key, value) => {
        if (!key || !value) return;
        if (next[key] === value) return;
        next[key] = value;
        didUpdate = true;
      };

      const res = await fetch(`${baseUrl}/api/tickets/${id}/admin-names`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      let payload = null;
      try {
        payload = await res.json();
      } catch {
        return;
      }

      if (!payload?.success || !Array.isArray(payload.data)) return;

      payload.data.forEach((row) => {
        if (!row) return;
        const fullName = (row.full_name || "").trim();
        if (!fullName) return;
        if (row.id) setEntry(row.id, fullName);
        const emailKey = (row.email || "").trim().toLowerCase();
        if (emailKey) setEntry(emailKey, fullName);
      });

      if (isCancelled || !didUpdate) return;
      setAdminDirectory(next);
    };

    fetchAdminDirectory();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, id, adminView]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;

    const senderId = userIdRef.current;
    if (!senderId) {
      alert("Session error: please log in again and retry.");
      return;
    }

    const senderRole = adminView ? "admin" : "user";
    const storedProfile = getStoredProfile();
    const senderName = getDisplayName(
      storedProfile.name,
      storedProfile.email,
      senderRole,
    );
    const senderEmail = storedProfile.email || "";

    setText("");

    const tempId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setMessages((prev) => {
      const next = [
        ...prev,
        {
          id: tempId,
          senderId,
          senderRole,
          senderName,
          senderEmail,
          text: trimmed,
          attachments: [],
          time: new Date().toISOString(),
          pending: true,
        },
      ];
      return next;
    });

    try {
      const { data, error } = await realtimeSupabase
        .from("ticket_messages")
        .insert([
          {
            ticket_id: normalizeTicketId(id),
            sender_id: senderId,
            sender_role: senderRole,
            sender_name: senderName,
            sender_email: senderEmail || null,
            message_text: trimmed,
            ticket_owner_id: ticket?.created_by || null,
          },
        ])
        .select(
          "id, sender_id, sender_role, sender_name, sender_email, message_text, attachments, created_at",
        );

      if (error) {
        alert(error.message || "Failed to send message");
        setText(trimmed);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      if (adminView && senderId && ticket) {
        const slots = ["Assignee1", "Assignee2", "Assignee3"];
        const assigned = slots.map((s) => ticket[s]).filter(Boolean);
        if (!assigned.includes(senderId)) {
          const emptySlot = slots.find((s) => !ticket[s]);
          if (emptySlot) {
            const assignPayload = {
              Assignee1: ticket.Assignee1 || null,
              Assignee2: ticket.Assignee2 || null,
              Assignee3: ticket.Assignee3 || null,
            };
            assignPayload[emptySlot] = senderId;
            const { data: ticketData, error: assignErr } = await realtimeSupabase
              .from("Tickets")
              .update(assignPayload)
              .eq("id", ticket.id)
              .select();
            if (!assignErr && ticketData?.[0]) {
              setTicket(ticketData[0]);
              cacheTicket(id, ticketData[0]);
            }
          }
        }
      }

      if (data && data[0]) {
        const row = data[0];
        if (!seenMessageIdsRef.current.has(row.id)) {
          seenMessageIdsRef.current.add(row.id);
          setMessages((prev) => {
            return prev.map((m) =>
              m.id === tempId
                ? {
                    id: row.id,
                    senderId: row.sender_id,
                    senderRole: row.sender_role,
                    senderName: row.sender_name || senderName,
                    senderEmail: row.sender_email || senderEmail || null,
                    text: row.message_text,
                    attachments: parseMessageAttachments(row.attachments),
                    time: row.created_at,
                  }
                : m,
            );
          });
        }
      }
    } catch (err) {
      console.error("Unexpected error sending message:", err);
      setText(trimmed);
    }
  }

  const getAttachmentSrc = (attachment) =>
    attachment.url || attachment.data || "";

  const downloadAttachment = async (attachment) => {
    const src = getAttachmentSrc(attachment);
    if (!src) return;

    if (attachment.url) {
      try {
        const res = await fetch(attachment.url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(src, "_blank");
      }
      return;
    }

    // Legacy base64 path
    const link = document.createElement("a");
    link.href = src;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isImageFile = (filename) => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
  };

  const parseMessageAttachments = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const isBotTicket = useMemo(
    () =>
      messages.some(
        (m) =>
          m.text?.startsWith("[You]\n") ||
          m.text?.startsWith("[MISD Support Bot]\n"),
      ),
    [messages],
  );

  const adminParticipants = useMemo(() => {
    if (adminView) return [];
    const unique = new Map();
    for (const msg of messages) {
      if (msg.senderRole !== "admin") continue;
      const email = (msg.senderEmail || "").trim();
      const emailKey = email.toLowerCase();
      const resolvedName =
        (msg.senderId && adminDirectory[msg.senderId]) ||
        (emailKey && adminDirectory[emailKey]) ||
        "";
      const name = (resolvedName || msg.senderName || "").trim();
      if (!name && !email) continue;
      const key = msg.senderId || emailKey || name;
      if (unique.has(key)) continue;
      unique.set(key, {
        id: key,
        name: name || (email ? email.split("@")[0] : "Admin"),
        email,
      });
    }
    return Array.from(unique.values());
  }, [messages, adminView, adminDirectory]);

  if (error) {
    return (
      <div className={`chat-wrapper${adminView ? " chat-wrapper-admin" : ""}`}>
        <div
          className="chat-card"
          style={{
            textAlign: "center",
            color: "#d32f2f",
            padding: "40px",
          }}
        >
          <h2>Error Loading Ticket</h2>
          <p>{error}</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className={`chat-wrapper${adminView ? " chat-wrapper-admin" : ""}`}>
        <div
          className="chat-card"
          style={{ textAlign: "center", padding: "40px" }}
        >
          <h2>Loading Ticket Details...</h2>
        </div>
      </div>
    );
  }

  const creatorName = (() => {
    const name = (
      ticket.full_name ||
      ticket.created_by_name ||
      creatorProfile?.fullName ||
      ""
    ).trim();
    if (name) return name;
    const email = (
      ticket.created_by_email ||
      creatorProfile?.email ||
      ""
    ).trim();
    if (email) return email.split("@")[0];
    return ticket.Department || "Student";
  })();
  const creatorEmail = (
    ticket.created_by_email ||
    creatorProfile?.email ||
    ""
  ).trim();
  const headerInitial = creatorName.trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col w-full h-full max-h-full overflow-hidden bg-gray-50">
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-5xl mx-auto bg-white sm:my-2 sm:rounded-2xl border-x border-gray-100 overflow-hidden shadow-sm">
        <ChatHeader
          adminView={adminView}
          creatorName={creatorName}
          creatorEmail={creatorEmail}
          headerInitial={headerInitial}
          adminParticipants={adminParticipants}
          isBotTicket={isBotTicket}
          onBack={() => navigate(-1)}
        />
        <TicketDetails
          ticket={ticket}
          adminView={adminView}
          expandedSummary={expandedSummary}
          onToggleSummary={() => setExpandedSummary((prev) => !prev)}
          expandedTimeline={expandedTimeline}
          onToggleTimeline={() => setExpandedTimeline((prev) => !prev)}
          timelineHistory={timelineHistory}
          onCloseTicket={handleCloseTicket}
          isTicketClosed={isTicketClosed}
          formatDateTime={formatDateTime}
        />
        <ChatMessages
          messages={messages}
          viewerId={viewerId}
          adminView={adminView}
          getDisplayName={getDisplayName}
          scrollRef={scrollRef}
          nowMs={nowMs}
          getAttachmentSrc={getAttachmentSrc}
          isImageFile={isImageFile}
          onOpenAttachment={setSelectedImage}
          onDownloadAttachment={downloadAttachment}
          transcriptCreatorName={creatorName}
        />
        <ChatInput text={text} onTextChange={setText} onSend={handleSend} />
      </div>

      <AttachmentViewer
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
        getAttachmentSrc={getAttachmentSrc}
        onDownload={downloadAttachment}
      />
    </div>
  );
}
