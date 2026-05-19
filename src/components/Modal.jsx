import {
  Smile,
  Frown,
  CheckCircle2,
  Settings,
  User,
  Lock,
  Palette,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { realtimeSupabase } from "../lib/realtimeSupabaseClient";
import {
  FloatingInput,
  FloatingTextarea,
  PrimaryButton,
  SecondaryButton,
} from "./FormFields";

/**
 * Modal — generic reusable modal shell.
 *
 * Props:
 *   header    – ReactNode rendered in the header bar (optional)
 *   children  – modal body content
 *   className – extra classes on the inner card (optional)
 */
export function Modal({ header, children, className = "", onClose }) {
  return (
    /*
     * z-1200 clears SidePanel (z-[1001]) and toggle handle (z-1002).
     * pb-18 on mobile offsets the bottom nav (~70px) so flex centering
     * visually lands in the space above the nav bar.
     */
    <div
      className="fixed inset-0 z-1200 flex items-center justify-center p-4 pb-18 md:pb-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden font-poppins border-t-[6px] border-lpu-maroon dark:border-lpu-gold ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {header && (
          <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-zinc-800">
            {header}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * FeedbackModal — ticket close satisfaction survey. Composed from Modal.
 *
 * Props:
 *   ticket   – closed ticket object { id, Summary, Description, Category }
 *   onSubmit – fn(satisfied: boolean, comment: string | null) called on submit
 *   onClose  – fn() called 2s after submit (auto-close)
 */
export function FeedbackModal({ ticket, onSubmit, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [satisfied, setSatisfied] = useState(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const handleSelect = (val) => {
    setSatisfied(val);
    setError("");
  };

  const handleBack = () => {
    setSatisfied(null);
    setComment("");
    setError("");
  };

  const handleSubmit = () => {
    if (satisfied === null) return;
    const trimmed = comment.trim();
    if (satisfied === false && !trimmed) {
      setError("Please add a short comment so we can improve.");
      return;
    }
    setSubmitted(true);
    onSubmit?.(satisfied, trimmed || null);
    setTimeout(() => onClose?.(), 2000);
  };

  const handleCommentKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const header = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <CheckCircle2 size={20} className="shrink-0 text-lpu-maroon" />
        <h2 className="text-lpu-maroon font-black text-lg tracking-tight leading-tight">
          Ticket Closed
        </h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {ticket.Category && (
          <span className="text-sm font-bold text-lpu-maroon bg-lpu-maroon/10 border border-lpu-maroon/20 px-2.5 py-1 rounded-full tracking-tight">
            {ticket.Category}
          </span>
        )}
        <span className="bg-lpu-maroon text-white text-sm font-black px-2.5 py-1 rounded-full">
          #{ticket.id}
        </span>
      </div>
    </>
  );

  return (
    <Modal header={header} className="max-w-md" onClose={onClose}>
      {/* Ticket info */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <p className="text-gray-800 font-bold text-base leading-snug line-clamp-2 mb-1.5">
          {ticket.Summary}
        </p>
        {ticket.Description && (
          <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
            {ticket.Description}
          </p>
        )}
      </div>

      {/* Feedback area */}
      <div className="px-5 py-4">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-2">
            {satisfied ? (
              <Smile size={48} className="text-green-500" />
            ) : (
              <Frown size={48} className="text-lpu-red" />
            )}
            <p className="text-lpu-maroon font-black text-lg">
              Thank you for your feedback!
            </p>
            <p className="text-gray-400 text-base">
              {satisfied ? "Glad we could help." : "We'll work to improve."}
            </p>
          </div>
        ) : satisfied === null ? (
          <>
            <p className="text-gray-600 font-semibold text-base text-center mb-4">
              Were you satisfied with the resolution?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSelect(true)}
                className="flex-1 flex flex-col items-center gap-2.5 py-4 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 active:scale-95 transition-all duration-200 group cursor-pointer"
              >
                <Smile
                  size={36}
                  className="text-gray-300 group-hover:text-green-500 transition-colors duration-200"
                />
                <span className="text-sm font-bold text-gray-400 group-hover:text-green-600 transition-colors duration-200">
                  Satisfied
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect(false)}
                className="flex-1 flex flex-col items-center gap-2.5 py-4 rounded-xl border-2 border-gray-200 hover:border-lpu-red hover:bg-red-50 active:scale-95 transition-all duration-200 group cursor-pointer"
              >
                <Frown
                  size={36}
                  className="text-gray-300 group-hover:text-lpu-red transition-colors duration-200"
                />
                <span className="text-sm font-bold text-gray-400 group-hover:text-lpu-red transition-colors duration-200">
                  Not Satisfied
                </span>
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {satisfied ? (
                  <Smile size={22} className="text-green-500" />
                ) : (
                  <Frown size={22} className="text-lpu-red" />
                )}
                <span className="text-sm font-bold text-gray-600">
                  {satisfied ? "Satisfied" : "Not Satisfied"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleBack}
                className="text-xs font-bold text-gray-400 hover:text-lpu-maroon transition-colors"
              >
                Change
              </button>
            </div>

            <FloatingTextarea
              label={`Comment ${satisfied ? "(optional)" : "(required)"}`}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (error && e.target.value.trim()) setError("");
              }}
              required={satisfied === false}
              autoResize
              heightClass="min-h-[96px] max-h-[220px] overflow-y-auto"
              aria-required={satisfied === false}
              onKeyDown={handleCommentKeyDown}
            />
            {error && (
              <p className="mt-2 text-sm font-semibold text-red-500">{error}</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <SecondaryButton label="Back" onClick={handleBack} />
              <PrimaryButton
                label="Send feedback"
                type="button"
                onClick={handleSubmit}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * FormModal — reusable headered modal shell. Composed from Modal.
 *
 * Props:
 *   title     – header title string
 *   icon      – Lucide icon component
 *   onClose   – optional close handler (adds close button)
 *   className – extra classes on the inner card
 *   children  – form body content
 */
export function FormModal({
  title,
  icon: Icon,
  onClose,
  className = "",
  children,
}) {
  const header = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <Icon
            size={20}
            className="shrink-0 text-lpu-maroon dark:text-lpu-gold"
          />
        )}
        <h2 className="text-lpu-maroon dark:text-lpu-gold font-black text-lg tracking-tight leading-tight truncate">
          {title}
        </h2>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-lpu-maroon hover:bg-gray-100 dark:text-zinc-500 dark:hover:text-lpu-gold dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      )}
    </>
  );

  return (
    <Modal
      header={header}
      className={`max-w-7xl max-h-[90vh] overflow-y-auto ${className}`.trim()}
      onClose={onClose}
    >
      {children}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// SettingsModal helpers
// ---------------------------------------------------------------------------

function getAuthHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
  };
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

function FieldInput({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
        {label}
      </span>
      <input
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#2b2b2f] bg-white dark:bg-[#1c1c1f] text-sm font-medium text-gray-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-lpu-maroon/30 focus:border-lpu-maroon transition-all"
        {...props}
      />
    </label>
  );
}

function StatusLine({ msg, err }) {
  if (err)
    return (
      <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-lg px-3 py-2">
        {err}
      </p>
    );
  if (msg)
    return (
      <p className="text-xs font-semibold text-green-600 bg-green-50 rounded-lg px-3 py-2">
        {msg}
      </p>
    );
  return null;
}

function ProfileSection({ loading, loadErr, profile, setProfile, onClose }) {
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(loadErr || "");
  const [saving, setSaving] = useState(false);

  const { fullName, email } = profile;
  const setFullName = (v) => setProfile((p) => ({ ...p, fullName: v }));
  const setEmail = (v) => setProfile((p) => ({ ...p, email: v }));

  const onSave = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        method: "PUT",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.message || "Update failed");
        return;
      }
      if (json.user?.email) localStorage.setItem("userEmail", json.user.email);
      if (json.user?.full_name !== undefined)
        localStorage.setItem("userFullName", json.user.full_name || "");
      if (json.token) {
        localStorage.setItem("authToken", json.token);
        realtimeSupabase.realtime.setAuth(json.token);
      }
      setMsg("Profile saved.");
    } catch (e) {
      setErr(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">
        Loading…
      </p>
    );

  return (
    <form onSubmit={onSave} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-[#2b2b2f]">
        <div className="w-10 h-10 rounded-full bg-lpu-maroon/10 dark:bg-lpu-maroon/20 flex items-center justify-center shrink-0">
          <User size={20} className="text-lpu-maroon" />
        </div>
        <div>
          <p className="text-sm font-black text-gray-800 dark:text-zinc-100">
            {fullName || "Admin"}
          </p>
          <p className="text-xs text-gray-400 dark:text-zinc-500">{email}</p>
        </div>
      </div>

      <FloatingInput
        label="Full Name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
      />
      <FloatingInput
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      <StatusLine msg={msg} err={err} />

      <div className="flex gap-3 pt-1">
        <SecondaryButton
          label="Cancel"
          onClick={onClose}
          disabled={saving}
          className="flex-1"
        />
        <PrimaryButton
          label={saving ? "Saving…" : "Save changes"}
          isLoading={saving}
          className="flex-1"
        />
      </div>
    </form>
  );
}

function SecuritySection() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (newPassword.length < 6) {
      setErr("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/auth/change-password"), {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.message || "Could not change password");
        return;
      }
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg("Password updated.");
    } catch (e) {
      setErr(e.message || "Could not change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSave} className="flex flex-col gap-4">
      <FloatingInput
        label="Current Password"
        type="password"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <FloatingInput
        label="New Password"
        type="password"
        minLength={6}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
        required
      />
      <FloatingInput
        label="Confirm New Password"
        type="password"
        minLength={6}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        required
      />

      <StatusLine msg={msg} err={err} />

      <PrimaryButton
        label={saving ? "Updating…" : "Change password"}
        isLoading={saving}
        className="w-full"
      />
    </form>
  );
}

function AppearanceSection({ darkMode, onToggleDark }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-[#2b2b2f] hover:border-gray-200 dark:hover:border-zinc-500 transition-colors">
        <div className="flex items-center gap-3">
          {darkMode ? (
            <Moon size={18} className="text-lpu-maroon" />
          ) : (
            <Sun size={18} className="text-lpu-maroon" />
          )}
          <p className="text-sm font-bold text-gray-800 dark:text-zinc-100">
            Dark Mode
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            role="switch"
            aria-checked={darkMode}
            checked={darkMode}
            onChange={onToggleDark}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 rounded-full bg-zinc-300 dark:bg-zinc-600 peer-checked:bg-lpu-maroon dark:peer-checked:bg-lpu-maroon transition-colors duration-200 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-5" />
        </label>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "account", icon: User, label: "Account" },
  { id: "security", icon: Lock, label: "Security" },
  { id: "appearance", icon: Palette, label: "Appearance" },
];

/**
 * SettingsModal — admin account settings with sidebar navigation.
 *
 * Props:
 *   open         – boolean
 *   onClose      – fn()
 *   darkMode     – boolean (current dark mode state)
 *   onToggleDark – fn() toggle dark mode
 */
export function SettingsModal({ open, onClose, darkMode, onToggleDark }) {
  const [activeSection, setActiveSection] = useState("account");
  const [profile, setProfile] = useState({ fullName: "", email: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadErr, setProfileLoadErr] = useState("");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setProfileLoading(true);
    setProfileLoadErr("");
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), {
          headers: getAuthHeader(),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!json.success || !json.user) {
          setProfileLoadErr(json.message || "Could not load profile");
          return;
        }
        setProfile({
          fullName: json.user.full_name || "",
          email: json.user.email || "",
        });
      } catch (e) {
        if (!cancelled)
          setProfileLoadErr(e.message || "Could not load profile");
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-1200 flex items-center justify-center p-4 pb-18 md:pb-4 bg-black/50 backdrop-blur-sm">
      <div className="settings-modal-panel w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden font-poppins border-t-[6px] border-lpu-maroon dark:border-lpu-gold flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Settings
              size={20}
              className="shrink-0 text-lpu-maroon dark:text-lpu-gold"
            />
            <h2 className="text-lpu-maroon dark:text-lpu-gold font-black text-lg tracking-tight leading-tight">
              Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-lpu-maroon hover:bg-gray-100 dark:hover:text-lpu-gold dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <nav className="w-44 shrink-0 border-r border-gray-100 dark:border-[#2b2b2f] p-2 flex flex-col gap-1 overflow-y-auto">
            {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  activeSection === id
                    ? "bg-lpu-maroon text-white font-bold"
                    : "text-gray-600 dark:text-zinc-400 hover:bg-lpu-maroon/5 dark:hover:bg-white/5 hover:text-lpu-maroon dark:hover:text-zinc-100 font-medium"
                }`}
              >
                <Icon size={15} className="shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Content pane */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-w-0">
            <h3 className="text-base font-black text-gray-800 dark:text-lpu-gold border-b border-gray-100 dark:border-zinc-800 pb-3">
              {NAV_ITEMS.find((i) => i.id === activeSection)?.label}
            </h3>
            {activeSection === "account" && (
              <ProfileSection
                loading={profileLoading}
                loadErr={profileLoadErr}
                profile={profile}
                setProfile={setProfile}
                onClose={onClose}
              />
            )}
            {activeSection === "security" && <SecuritySection />}
            {activeSection === "appearance" && (
              <AppearanceSection
                darkMode={darkMode}
                onToggleDark={onToggleDark}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
