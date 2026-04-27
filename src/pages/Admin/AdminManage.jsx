import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { UserPlus, X } from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { ADMIN_LEVEL_LABELS } from "../../utils/adminLevels";
import { useNavbarActions } from "../../context/NavbarActionsContext";
import { SearchInput } from "../../components/DashboardControls";
import { DataTable, TableButton, TableBadge } from "../../components/DataTable";

const PAGE_SIZE = 10;

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

function getAuthHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` };
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

function parseFilter(str) {
  return new Set(
    (str || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function serializeFilter(set) {
  return [...set].join(",");
}

export default function AdminManage() {
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterTarget, setFilterTarget] = useState(null);
  const [saving, setSaving] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const decoded = (() => {
    try {
      return jwtDecode(localStorage.getItem("authToken") || "");
    } catch {
      return null;
    }
  })();
  const currentId = decoded?.id || decoded?.sub;

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(
      (a) =>
        (a.full_name || "").toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q),
    );
  }, [admins, search]);

  const pageCount = Math.ceil(filteredAdmins.length / PAGE_SIZE);
  const pagedAdmins = filteredAdmins.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const handleSearch = (val) => {
    setSearch(val);
    setPage(0);
  };

  useNavbarActions(
    <button
      type="button"
      onClick={() => setShowAddModal(true)}
      className="flex items-center justify-center gap-2 px-4 h-[40px] rounded-lg text-[15px] font-medium text-white/85 hover:bg-[var(--color-lpu-gold)] hover:text-[var(--color-lpu-maroon)] transition-all duration-200"
    >
      <UserPlus size={18} />
      Add Admin
    </button>,
  );

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

  const handleLevelChange = async (admin, newLevel) => {
    setSaving(admin.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/admins/${admin.id}`), {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
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
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
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
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
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
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
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

  const columns = [
    { label: "Name", accessor: "full_name", variant: "title" },
    { label: "Email", accessor: "email", variant: "subtitle" },
    {
      label: "Status",
      render: (row) =>
        !row.email_verified_at ? (
          <TableBadge
            variant="warning"
            title="User must open the link in the invitation email"
          >
            Pending email
          </TableBadge>
        ) : (
          <TableBadge variant="success">Verified</TableBadge>
        ),
    },
    {
      label: "Level",
      preventRowClick: true,
      render: (row) => {
        const isSelf = row.id === currentId;
        const isBusy = saving === row.id;
        if (isSelf) {
          return (
            <TableBadge variant="info">
              {ADMIN_LEVEL_LABELS[row.admin_level] ?? row.admin_level} (You)
            </TableBadge>
          );
        }
        return (
          <select
            className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-lpu-maroon focus:border-lpu-maroon transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            value={row.admin_level}
            disabled={isBusy}
            onChange={(e) => handleLevelChange(row, e.target.value)}
          >
            {Object.entries(ADMIN_LEVEL_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      label: "Ticket Filters",
      preventRowClick: true,
      render: (row) => {
        const isSelf = row.id === currentId;
        const tags = [
          row.filter_type,
          row.filter_department,
          row.filter_category,
          row.filter_site,
        ].flatMap((f) =>
          (f || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {tags.map((tag) => (
              <TableBadge key={tag}>{tag}</TableBadge>
            ))}
            {!isSelf && (
              <TableButton
                variant="secondary"
                color="maroon"
                onClick={() => setFilterTarget(row)}
                className="mt-0.5"
              >
                Edit Filters
              </TableButton>
            )}
          </div>
        );
      },
    },
    {
      label: "Actions",
      align: "right",
      preventRowClick: true,
      render: (row) => {
        const isSelf = row.id === currentId;
        const isBusy = saving === row.id;
        if (isSelf) return null;
        return (
          <div className="flex gap-2 justify-end">
            <TableButton
              disabled={isBusy}
              onClick={() => handleToggleActive(row)}
              variant="primary"
              color={row.is_active ? "red" : "green"}
            >
              {row.is_active ? "Deactivate" : "Activate"}
            </TableButton>
            <TableButton
              disabled={isBusy}
              onClick={() => handleDeleteAdmin(row)}
              variant="secondary"
              color="red"
            >
              Delete
            </TableButton>
          </div>
        );
      },
    },
  ];

  return (
    <div className="md:flex-1 md:overflow-y-auto">
      <section className="w-full max-w-330 mx-auto px-6 py-4 md:py-6">
        <div className="mb-4">
          <SearchInput
            placeholder="Search by name or email..."
            onSearch={handleSearch}
          />
        </div>

        {error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl font-semibold text-center border border-red-100">
            {error}
          </div>
        ) : (
          <div className="w-full rounded-xl border border-gray-100 shadow-sm bg-white">
            <DataTable
              columns={columns}
              data={pagedAdmins}
              emptyMessage="No admin accounts found."
              emptySubMessage="Adjust your search terms."
              page={page}
              pageCount={pageCount}
              totalCount={filteredAdmins.length}
              onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
              onNextPage={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            />
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
    </div>
  );
}

function ModalShell({ onClose, title, wide, children }) {
  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-1000"
      onClick={onClose}
      role="dialog"
    >
      <div
        className={`bg-white rounded-[18px] w-full shadow-[0_18px_48px_rgba(15,23,42,0.18)] overflow-hidden font-poppins ${wide ? "max-w-135" : "max-w-105"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 font-bold text-sm bg-[#980001] text-white">
          <span>{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-white opacity-80 hover:opacity-100 p-0.5 flex items-center transition-opacity"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fieldCls =
  "px-3 py-2.5 border border-gray-200 rounded-full text-sm outline-none bg-gray-50 focus:border-lpu-maroon focus:ring-2 focus:ring-lpu-maroon/20 transition-all";
const labelCls = "flex flex-col gap-1.5 text-xs font-semibold text-gray-800";

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
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
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
    <ModalShell onClose={onClose} title="Add Admin Account">
      <form className="flex flex-col gap-4 p-5" onSubmit={onSubmit}>
        <label className={labelCls}>
          Full Name
          <input
            value={form.fullName}
            onChange={onChange("fullName")}
            placeholder="Juan dela Cruz"
            className={fieldCls}
          />
        </label>
        <label className={labelCls}>
          Email <span className="text-red-600">*</span>
          <input
            type="email"
            required
            value={form.email}
            onChange={onChange("email")}
            placeholder="admin@example.com"
            className={fieldCls}
          />
        </label>
        <label className={labelCls}>
          Password <span className="text-red-600">*</span>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={onChange("password")}
            placeholder="Min. 6 characters"
            className={fieldCls}
          />
        </label>
        <label className={labelCls}>
          Level
          <select
            value={form.adminLevel}
            onChange={onChange("adminLevel")}
            className={fieldCls}
          >
            {Object.entries(ADMIN_LEVEL_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {err && (
          <p className="text-xs text-red-800 -mt-1.5 -mb-1 px-3 py-2 bg-red-50 rounded-lg">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-full text-sm font-semibold border border-lpu-maroon bg-lpu-maroon text-white hover:bg-lpu-red hover:border-lpu-red disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CheckboxGroup({ options, selected, onChange, twoColumns }) {
  const toggle = (val) => {
    const next = new Set(selected);
    next.has(val) ? next.delete(val) : next.add(val);
    onChange(next);
  };
  return (
    <div
      className={
        twoColumns
          ? "grid grid-rows-3 grid-flow-col gap-x-6 gap-y-2 justify-start"
          : "flex flex-col items-start gap-2"
      }
    >
      {options.map((v) => (
        <label
          key={v}
          className="flex flex-row items-center gap-2 text-xs font-medium cursor-pointer py-1 select-none whitespace-nowrap hover:opacity-70 transition-opacity"
        >
          <input
            type="checkbox"
            checked={selected.has(v)}
            onChange={() => toggle(v)}
            className="w-3.5 h-3.5 m-0 cursor-pointer accent-lpu-maroon shrink-0"
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
    <ModalShell
      onClose={onClose}
      title={`Ticket Filters: ${admin.full_name || admin.email}`}
      wide
    >
      <p className="mx-4.5 mt-2.5 text-[13px] text-gray-500">
        This admin sees all tickets matching any checked value, plus ones
        directly assigned to them.
      </p>
      <form className="flex flex-col gap-4 p-5" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-[0.04em]">
            Type
          </span>
          <CheckboxGroup
            options={TICKET_TYPES}
            selected={form.filterType}
            onChange={set("filterType")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-[0.04em]">
            Department
          </span>
          <CheckboxGroup
            options={TICKET_DEPARTMENTS}
            selected={form.filterDepartment}
            onChange={set("filterDepartment")}
            twoColumns
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-[0.04em]">
            Category
          </span>
          <CheckboxGroup
            options={TICKET_CATEGORIES}
            selected={form.filterCategory}
            onChange={set("filterCategory")}
            twoColumns
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-[0.04em]">
            Site
          </span>
          <CheckboxGroup
            options={TICKET_SITES}
            selected={form.filterSite}
            onChange={set("filterSite")}
          />
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-full text-sm font-semibold border border-lpu-maroon bg-lpu-maroon text-white hover:bg-lpu-red hover:border-lpu-red disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
