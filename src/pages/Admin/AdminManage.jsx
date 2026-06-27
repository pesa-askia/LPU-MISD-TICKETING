import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { UserPlus } from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { ADMIN_LEVEL_LABELS } from "../../utils/adminLevels";
import { NavbarActionButton } from "../../context/NavbarActionsContext";
import { useNavbarActions } from "../../context/useNavbarActions";
import { SearchInput } from "../../components/Controls";
import {
  DataTable,
  TableButton,
  TableBadge,
  TableSelect,
} from "../../components/DataTable";
import { FormModal } from "../../components/Modal";
import {
  FloatingInput,
  FloatingSelect,
  PrimaryButton,
  SecondaryButton,
} from "../../components/FormFields";

const PAGE_SIZE = 10;

function getAuthHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` };
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

export default function AdminManage() {
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
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
    <NavbarActionButton
      icon={UserPlus}
      label="Add Admin"
      onClick={() => setShowAddModal(true)}
    />,
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
      colWidth: "w-32 md:w-[15%]",
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
      label: "Role",
      colWidth: "w-36 md:w-[25%]",
      render: (row) => {
        const isSelf = row.id === currentId;
        const isBusy = saving === row.id;

        if (isSelf) {
          return (
            <TableBadge variant="info" className="w-full justify-start">
              {/* Desktop view */}
              <span className="hidden md:inline">
                {ADMIN_LEVEL_LABELS[row.admin_level] ?? row.admin_level} (You)
              </span>
              {/* Mobile view */}
              <span className="md:hidden">You</span>
            </TableBadge>
          );
        }
        if (row.is_root) {
          return (
            <TableBadge variant="info" className="w-full justify-start">
              {/* Desktop view */}
              <span className="hidden md:inline">
                {ADMIN_LEVEL_LABELS[row.admin_level] ?? row.admin_level} (Root)
              </span>
              {/* Mobile view */}
              <span className="md:hidden">Root</span>
            </TableBadge>
          );
        }
        return (
          <TableSelect
            value={row.admin_level}
            disabled={isBusy}
            className="w-full"
            options={Object.entries(ADMIN_LEVEL_LABELS).map(([val, label]) => ({
              value: val,
              label,
            }))}
            onChange={(e) => handleLevelChange(row, e.target.value)}
          />
        );
      },
    },
    {
      label: "Actions",
      colWidth: "w-28 md:w-[15%]",
      preventRowClick: true,
      render: (row) => {
        const isSelf = row.id === currentId;
        const isBusy = saving === row.id;

        if (isSelf) return null;
        if (row.is_root) return null;

        return (
          <div className="flex flex-col gap-2">
            <TableButton
              disabled={isBusy}
              onClick={() => handleToggleActive(row)}
              variant="secondary"
              color="maroon"
            >
              {row.is_active ? "Disable" : "Enable"}
            </TableButton>

            <TableButton
              disabled={isBusy}
              onClick={() => handleDeleteAdmin(row)}
              variant="primary"
            >
              Delete
            </TableButton>
          </div>
        );
      },
    },
  ];

  return (
    <section className="w-full px-6 py-4 md:py-6 font-poppins h-full overflow-hidden flex flex-col dark:text-gray-100">
      <div className="mb-4">
        <SearchInput
          placeholder="Search by name or email..."
          onSearch={handleSearch}
        />
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-4 rounded-xl font-semibold text-center border border-red-100 dark:border-red-900/30">
          {error}
        </div>
      ) : (
        <div className="w-full flex-1 min-h-0 flex flex-col">
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
    </section>
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
    <FormModal title="Add Admin Account" icon={UserPlus} onClose={onClose}>
      <form className="px-5 py-6 flex flex-col gap-5" onSubmit={onSubmit}>
        <FloatingInput
          label="Full Name"
          value={form.fullName}
          onChange={onChange("fullName")}
          autoComplete="name"
        />
        <FloatingInput
          label="Email (Required)"
          type="email"
          required
          value={form.email}
          onChange={onChange("email")}
          autoComplete="email"
        />
        <FloatingInput
          label="Password (Required)"
          type="password"
          required
          minLength={6}
          value={form.password}
          onChange={onChange("password")}
          autoComplete="new-password"
        />
        <FloatingSelect
          label="Role"
          name="adminLevel"
          value={form.adminLevel}
          onChange={onChange("adminLevel")}
          options={Object.entries(ADMIN_LEVEL_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {err && (
          <div className="text-xs text-red-800 dark:text-red-400 px-3 py-2 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-100 dark:border-red-900/30">
            {err}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <SecondaryButton
            label="Cancel"
            onClick={onClose}
            disabled={submitting}
          />
          <PrimaryButton label="Create" isLoading={submitting} />
        </div>
      </form>
    </FormModal>
  );
}
