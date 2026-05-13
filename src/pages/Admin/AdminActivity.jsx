import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { FilterSelect } from "../../components/Controls";
import { DataTable } from "../../components/DataTable";

const PAGE_SIZE = 20;

const ACTION_META = {
  TICKET_CLOSED:          { label: "Closed Ticket",           color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  TICKET_REOPENED:        { label: "Reopened Ticket",         color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  TICKET_ASSIGNED:        { label: "Assigned Ticket",         color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  KNOWLEDGE_ADDED:        { label: "Added Knowledge",         color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  KNOWLEDGE_EDITED:       { label: "Edited Knowledge",        color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  KNOWLEDGE_DELETED:      { label: "Deleted Knowledge",       color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  KNOWLEDGE_BULK_DELETED: { label: "Bulk Deleted Knowledge",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  ADMIN_CREATED:          { label: "Created Admin",           color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ADMIN_DELETED:          { label: "Deleted Admin",           color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  ADMIN_DISABLED:         { label: "Disabled Admin",          color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  ADMIN_ENABLED:          { label: "Enabled Admin",           color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  ADMIN_LEVEL_CHANGED:    { label: "Changed Admin Level",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

const FILTER_OPTIONS = ["All", "Ticket Actions", "Knowledge Actions", "Admin Actions"];
const FILTER_MAP = {
  "All": null,
  "Ticket Actions": "ticket",
  "Knowledge Actions": "knowledge",
  "Admin Actions": "admin",
};

function getAuthHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` };
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

export default function AdminActivity() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const decoded = useMemo(() => {
    try { return jwtDecode(localStorage.getItem("authToken") || ""); }
    catch { return null; }
  }, []);

  const isGlobal = Number(decoded?.admin_level) === 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    const type = FILTER_MAP[filter];
    const params = new URLSearchParams({ page });
    if (type) params.set("type", type);

    fetch(apiUrl(`/api/admin/activity?${params}`), { headers: getAuthHeader() })
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { setError(res.message || "Failed to load activity"); return; }
        setLogs(res.data || []);
        setTotalCount(res.total ?? 0);
        setError("");
      })
      .catch(() => setError("Network error"));
  }, [page, filter]);

  const handleFilter = (e) => {
    setFilter(e.target.value);
    setPage(0);
  };

  const columns = useMemo(() => {
    const cols = [];

    cols.push({
      label: "Date & Time",
      accessor: "created_at",
      variant: "date",
      colWidth: "w-36 md:w-40",
    });

    if (isGlobal) {
      cols.push({
        label: "Admin",
        accessor: (row) => row.admin?.full_name || row.admin?.email || "Unknown",
        variant: "title",
        colWidth: "w-36 md:w-44",
      });
    }

    cols.push({
      label: "Action",
      accessor: "action_type",
      render: (row) => {
        const meta = ACTION_META[row.action_type] || { label: row.action_type, color: "bg-gray-100 text-gray-600" };
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
            {meta.label}
          </span>
        );
      },
      colWidth: "w-44 md:w-52",
    });

    cols.push({
      label: "Target",
      accessor: (row) => row.target_label || row.target_id || "—",
      variant: "subtitle",
    });

    return cols;
  }, [isGlobal]);

  return (
    <section className="flex flex-col gap-4 p-4 md:p-6 min-h-0 flex-1">
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="w-full md:w-56">
          <FilterSelect
            value={filter}
            onChange={handleFilter}
            options={FILTER_OPTIONS}
          />
        </div>
        {!isGlobal && (
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Showing your activity only.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={logs}
          emptyMessage="No activity yet."
          emptySubMessage="Actions will appear here as admins use the system."
          page={page}
          pageCount={pageCount}
          totalCount={totalCount}
          onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
          onNextPage={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
        />
      </div>
    </section>
  );
}
