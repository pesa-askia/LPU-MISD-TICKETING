import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  BookOpen,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { useNavbarActions } from "../../context/NavbarActionsContext";
import { SearchInput } from "../../components/DashboardControls";
import "./AdminAnalytics.css";
import "./AdminTickets.css";
import "./AdminKnowledge.css";

const PAGE_SIZE = 10;

function getAuthHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` };
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

export default function AdminKnowledge() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addText, setAddText] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil(total / PAGE_SIZE);

  const fetchEntries = async (currentPage = page, currentSearch = search) => {
    setLoading(true);
    setError("");
    try {
      const offset = currentPage * PAGE_SIZE;
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
      if (currentSearch.trim()) params.set("q", currentSearch.trim());

      const res = await fetch(apiUrl(`/api/knowledge?${params}`), {
        headers: getAuthHeader(),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to load");
        return;
      }
      setEntries(json.data || []);
      setTotal(json.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries(page, search);
  }, [page, search]);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(0);
  };

  const handleAdd = async () => {
    if (!addText.trim()) {
      setAddError("Text is required");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch(apiUrl("/api/knowledge"), {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          text: addText.trim(),
          title: addTitle.trim() || "Knowledge Entry",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setAddError(json.error || "Failed to add");
        return;
      }
      setShowAddModal(false);
      setAddText("");
      setAddTitle("");
      fetchEntries(0, search);
      setPage(0);
    } catch (e) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this knowledge entry?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(apiUrl(`/api/knowledge/${id}`), {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to delete");
        return;
      }
      fetchEntries(page, search);
    } catch (e) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  useNavbarActions(
    <button
      type="button"
      onClick={() => {
        setShowAddModal(true);
        setAddError("");
      }}
      className="flex items-center justify-center gap-2 px-4 h-[40px] rounded-lg text-[15px] font-medium text-white/85 hover:bg-[var(--color-lpu-gold)] hover:text-[var(--color-lpu-maroon)] transition-all duration-200"
    >
      <Plus size={18} />
      Add Entry
    </button>,
  );

  return (
    <div className="knowledge-page">
      <div className="knowledge-content">
        <div className="knowledge-header">
          <div>
            <h2 className="knowledge-title">
              <BookOpen size={22} /> Knowledge Base
            </h2>
            <p className="knowledge-subtitle">
              {total} {total === 1 ? "entry" : "entries"}
            </p>
          </div>
        </div>

        <SearchInput placeholder="Search entries..." onSearch={handleSearch} />

        {error && <div className="knowledge-error">{error}</div>}

        {loading ? (
          <p style={{ color: "#888", fontSize: 14 }}>Loading...</p>
        ) : entries.length === 0 ? (
          <div className="knowledge-empty">
            <BookOpen size={40} />
            <p>No knowledge entries found.</p>
          </div>
        ) : (
          <div className="knowledge-list">
            {entries.map((entry) => (
              <div key={entry.id} className="knowledge-entry">
                <div className="knowledge-entry-body">
                  {entry.metadata?.title && (
                    <div className="knowledge-entry-title">
                      {entry.metadata.title}
                    </div>
                  )}
                  <p className="knowledge-entry-content">
                    {entry.content.length > 300
                      ? entry.content.slice(0, 300) + "…"
                      : entry.content}
                  </p>
                  <div className="knowledge-entry-meta">ID: {entry.id}</div>
                </div>
                <button
                  className="knowledge-delete-btn"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  title="Delete entry"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Page <strong>{page + 1}</strong> of <strong>{pageCount}</strong>
              <span className="ml-1 text-gray-400">({total} total)</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-lpu-maroon hover:text-white hover:border-lpu-maroon disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-lpu-maroon hover:text-white hover:border-lpu-maroon disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="knowledge-modal-overlay">
          <div className="knowledge-modal">
            <div className="knowledge-modal-header">
              <h3>Add Knowledge Entry</h3>
              <button
                className="knowledge-modal-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <label className="knowledge-modal-label">Title (optional)</label>
            <input
              type="text"
              className="knowledge-modal-input"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="e.g. LMS FAQ, Microsoft 365 Guide..."
            />

            <label className="knowledge-modal-label">
              Content <span style={{ color: "#e53935" }}>*</span>
            </label>
            <textarea
              className="knowledge-modal-textarea"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              rows={14}
              placeholder={
                "Q: How do I reset my LMS password?\nA: Go to LMS login page → click Forgot Password → follow email instructions.\n\nQ: How do I access Microsoft 365?\nA: Go to portal.office.com → log in with your LPU email."
              }
            />
            <p className="knowledge-modal-hint">
              Separate sections with blank lines — each section becomes a
              searchable chunk.
            </p>

            {addError && (
              <div className="knowledge-modal-error">{addError}</div>
            )}

            <div className="knowledge-modal-footer">
              <button
                className="knowledge-modal-cancel"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="knowledge-modal-save"
                onClick={handleAdd}
                disabled={adding}
              >
                {adding ? "Embedding & Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
