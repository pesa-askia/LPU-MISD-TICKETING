import { useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { ChevronDown, LogOut, Moon, UserPlus, X, User } from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { ADMIN_LEVEL_LABELS } from "../../utils/adminLevels";
import AdminNavbar from "./components/AdminNavbar";
import "./AdminTickets.css";
import "./AdminAnalytics.css";
import "./AdminManage.css";
import AdminAccountSettingsModal from "./components/AdminAccountSettingsModal";

const LEVEL_LABELS = { 0: "Root", 1: "Level 3", 2: "Level 2", 3: "Level 1   " };

function getAuthHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
  };
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

export default function AdminManage() {
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("adminDarkMode") === "true",
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterTarget, setFilterTarget] = useState(null); // admin being edited for filters
  const [saving, setSaving] = useState(null); // adminId being patched
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const menuRef = useRef(null);

  const decoded = (() => {
    try {
      return jwtDecode(localStorage.getItem("authToken") || "");
    } catch {
      return null;
    }
  })();
  const currentId = decoded?.id || decoded?.sub;
  const isRoot = decoded?.admin_level === 0;

  useEffect(() => {
    const root = document.querySelector(".admin-shell");
    if (!root) return;
    root.classList.toggle("admin-dark", darkMode);
    localStorage.setItem("adminDarkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const fetchAdmins = async () => {
    setError("");
    try {
      const res = await fetch(apiUrl("/api/admin/admins"), {
        headers: getAuthHeader(),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Failed to load admins");
        return;
      }
      setAdmins(json.data || []);
    } catch (e) {
      setError(e.message || "Failed to load admins");
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const onLogout = () => {
    ["authToken", "userId", "isLoggedIn", "userEmail", "userRole"].forEach(
      (k) => localStorage.removeItem(k),
    );
    window.location.href = "/";
  };

  const handleLevelChange = async (admin, newLevel) => {
    setSaving(admin.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/admins/${admin.id}`), {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ adminLevel: Number(newLevel) }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || "Failed to update");
        return;
      }
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? json.data : a)));
    } catch (e) {
      alert(e.message || "Failed to update");
    } finally {
      setSaving(null);
    }
  };

  const handleToggleActive = async (admin) => {
    setSaving(admin.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/admins/${admin.id}`), {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !admin.is_active }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || "Failed to update");
        return;
      }
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? json.data : a)));
    } catch (e) {
      alert(e.message || "Failed to update");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveFilters = async (admin, filters) => {
    setSaving(admin.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/admins/${admin.id}`), {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(filters),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || "Failed to save filters");
        return;
      }
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? json.data : a)));
      setFilterTarget(null);
    } catch (e) {
      alert(e.message || "Failed to save filters");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteAdmin = async (admin) => {
    const label = admin.full_name || admin.email || "this admin";
    const ok = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!ok) return;

    setSaving(admin.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/admins/${admin.id}`), {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || "Failed to delete admin");
        return;
      }
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
    } catch (e) {
      alert(e.message || "Failed to delete admin");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="admin-page analytics-page admin-tickets-page">
      <AdminNavbar
        isRoot={isRoot}
        actions={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 h-[40px] rounded-lg text-[15px] font-medium text-white/85 hover:bg-[var(--color-lpu-gold)] hover:text-[var(--color-lpu-maroon)] transition-all duration-200"
          >
            <UserPlus size={18} />
            Add Entry
          </button>
        }
      />

      <section className="admin-content analytics-content-wrap">
        <h2 className="manage-heading">Admin Accounts</h2>

        {error ? (
          <div className="admin-error">{error}</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Level</th>
                  <th>Ticket Filters</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-empty">
                      No admin accounts found.
                    </td>
                  </tr>
                ) : (
                  admins.map((a) => {
                    const isSelf = a.id === currentId;
                    const isBusy = saving === a.id;
                    return (
                      <tr key={a.id}>
                        <td>{a.full_name || "—"}</td>
                        <td>{a.email}</td>
                        <td>
                          {!a.email_verified_at ? (
                            <span
                              className="manage-verify-pending"
                              title="User must open the link in the invitation email"
                            >
                              Pending email
                            </span>
                          ) : (
                            <span className="manage-verify-ok">Verified</span>
                          )}
                        </td>
                        <td>
                          {isSelf ? (
                            <span className="manage-level-badge manage-level-self">
                              {ADMIN_LEVEL_LABELS[a.admin_level] ??
                                a.admin_level}{" "}
                              (You)
                            </span>
                          ) : (
                            <select
                              className="admin-assignee-select"
                              value={a.admin_level}
                              disabled={isBusy}
                              onChange={(e) =>
                                handleLevelChange(a, e.target.value)
                              }
                            >
                              {Object.entries(ADMIN_LEVEL_LABELS).map(
                                ([val, label]) => (
                                  <option key={val} value={val}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          )}
                        </td>
                        <td>
                          {[
                            a.filter_type,
                            a.filter_department,
                            a.filter_category,
                            a.filter_site,
                          ]
                            .flatMap((f) =>
                              (f || "")
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                            .map((tag) => (
                              <span key={tag} className="manage-filter-tag">
                                {tag}
                              </span>
                            ))}
                          {!isSelf && (
                            <button
                              type="button"
                              className="manage-filters-btn"
                              onClick={() => setFilterTarget(a)}
                            >
                              Edit Filters
                            </button>
                          )}
                        </td>
                        <td>
                          {a.created_at
                            ? new Date(a.created_at).toLocaleDateString()
                            : ":"}
                        </td>
                        <td>
                          {!isSelf && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleToggleActive(a)}
                                style={{
                                  padding: "4px 10px",
                                  border: "1px solid #888",
                                  borderRadius: 4,
                                  background: a.is_active
                                    ? "#e53935"
                                    : "#43a047",
                                  color: "white",
                                  cursor: isBusy ? "not-allowed" : "pointer",
                                  fontSize: 13,
                                }}
                              >
                                {a.is_active ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDeleteAdmin(a)}
                                style={{
                                  padding: "4px 10px",
                                  border: "1px solid rgba(229,57,53,0.55)",
                                  borderRadius: 4,
                                  background: "transparent",
                                  color: "#e53935",
                                  cursor: isBusy ? "not-allowed" : "pointer",
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAddModal && (
        <AddAdminModal
          onClose={() => setShowAddModal(false)}
          onCreated={(payload) => {
            setAdmins((prev) => [...prev, payload.data]);
            setShowAddModal(false);
            if (payload.verifyEmail && payload.invitationEmailSent) {
              alert(
                "An invitation was sent. The new admin must click the link in that email before they can sign in.",
              );
            } else if (payload.invitationEmailError) {
              alert(
                `Account was created, but the invitation email could not be sent: ${payload.invitationEmailError}`,
              );
            } else if (
              payload.verifyEmail &&
              payload.invitationEmailSent === false
            ) {
              alert(
                "Account created, but the invitation email was not sent. Check RESEND_ configuration or server logs.",
              );
            }
          }}
        />
      )}

      {filterTarget && (
        <EditFiltersModal
          admin={filterTarget}
          onClose={() => setFilterTarget(null)}
          onSave={(filters) => handleSaveFilters(filterTarget, filters)}
          saving={saving === filterTarget.id}
        />
      )}

      <AdminAccountSettingsModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />
    </div>
  );
}

function AddAdminModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    adminLevel: "1",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/admin/admins"), {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          adminLevel: Number(form.adminLevel),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.message || "Failed to create admin");
        return;
      }
      onCreated(json);
    } catch (e) {
      setErr(e.message || "Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="manage-modal-overlay" onClick={onClose} role="dialog">
      <div className="manage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manage-modal-header">
          <span>Add Admin Account</span>
          <button
            type="button"
            className="manage-modal-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <form className="manage-modal-form" onSubmit={onSubmit}>
          <label>
            Full Name
            <input
              value={form.fullName}
              onChange={onChange("fullName")}
              placeholder="Juan dela Cruz"
            />
          </label>
          <label>
            Email <span className="manage-required">*</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={onChange("email")}
              placeholder="admin@example.com"
            />
          </label>
          <label>
            Password <span className="manage-required">*</span>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={onChange("password")}
              placeholder="Min. 6 characters"
            />
          </label>
          <label>
            Level
            <select value={form.adminLevel} onChange={onChange("adminLevel")}>
              {Object.entries(ADMIN_LEVEL_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {err && <p className="manage-modal-err">{err}</p>}
          <div className="manage-modal-actions">
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="manage-modal-submit"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TICKET_TYPES = ["STUDENT", "FACULTY", "ADMIN"];
const TICKET_DEPARTMENTS = [
  "CAS",
  "CBA",
  "CITHM",
  "COECS",
  "LPU-SC",
  "HIGHSCHOOL",
];
const TICKET_CATEGORIES = [
  "LMS",
  "Microsoft 365",
  "STUDENT PORTAL",
  "ERP",
  "HARDWARE",
  "SOFTWARE",
  "OTHERS",
];
const TICKET_SITES = ["Onsite", "Online"];

// Parse a comma-separated filter string into a Set
function parseFilter(str) {
  return new Set(
    (str || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
// Serialize a Set back to a comma-separated string (empty string if nothing selected)
function serializeFilter(set) {
  return [...set].join(",");
}

function CheckboxGroup({ options, selected, onChange, twoColumns }) {
  const toggle = (val) => {
    const next = new Set(selected);
    next.has(val) ? next.delete(val) : next.add(val);
    onChange(next);
  };
  return (
    <div className={`manage-checkbox-group ${twoColumns ? "two-columns" : ""}`}>
      {options.map((v) => (
        <label key={v} className="manage-checkbox-label">
          <input
            type="checkbox"
            checked={selected.has(v)}
            onChange={() => toggle(v)}
          />
          <span>{v}</span>
        </label>
      ))}
    </div>
  );
}

function EditFiltersModal({ admin, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    filterType: parseFilter(admin.filter_type),
    filterDepartment: parseFilter(admin.filter_department),
    filterCategory: parseFilter(admin.filter_category),
    filterSite: parseFilter(admin.filter_site),
  });

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const onSubmit = (e) => {
    e.preventDefault();
    onSave({
      filterType: serializeFilter(form.filterType),
      filterDepartment: serializeFilter(form.filterDepartment),
      filterCategory: serializeFilter(form.filterCategory),
      filterSite: serializeFilter(form.filterSite),
    });
  };

  return (
    <div className="manage-modal-overlay" onClick={onClose} role="dialog">
      <div
        className="manage-modal manage-modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="manage-modal-header">
          <span>Ticket Filters: {admin.full_name || admin.email}</span>
          <button
            type="button"
            className="manage-modal-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p
          style={{
            margin: "10px 18px 0",
            fontSize: 13,
            color: "#666",
          }}
        >
          This admin sees all tickets matching any checked value, plus ones
          directly assigned to them.
        </p>
        <form className="manage-modal-form" onSubmit={onSubmit}>
          <div className="manage-filter-section">
            <span className="manage-filter-label">Type</span>
            <CheckboxGroup
              options={TICKET_TYPES}
              selected={form.filterType}
              onChange={set("filterType")}
            />
          </div>
          <div className="manage-filter-section">
            <span className="manage-filter-label">Department</span>
            <CheckboxGroup
              options={TICKET_DEPARTMENTS}
              selected={form.filterDepartment}
              onChange={set("filterDepartment")}
              twoColumns
            />
          </div>
          <div className="manage-filter-section">
            <span className="manage-filter-label">Category</span>
            <CheckboxGroup
              options={TICKET_CATEGORIES}
              selected={form.filterCategory}
              onChange={set("filterCategory")}
              twoColumns
            />
          </div>
          <div className="manage-filter-section">
            <span className="manage-filter-label">Site</span>
            <CheckboxGroup
              options={TICKET_SITES}
              selected={form.filterSite}
              onChange={set("filterSite")}
            />
          </div>
          <div className="manage-modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="manage-modal-submit"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
