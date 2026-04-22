import { useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { ChevronDown, LogOut, Plus, Trash2, BookOpen, X } from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import AdminNavbar from "./components/AdminNavbar";
import "./AdminAnalytics.css";
import "./AdminTickets.css";
import "./AdminKnowledge.css";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addText, setAddText] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const menuRef = useRef(null);

  const decoded = (() => {
    try { return jwtDecode(localStorage.getItem("authToken") || ""); }
    catch { return null; }
  })();
  const isRoot = decoded?.admin_level === 0;

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const fetchEntries = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/knowledge?limit=100"), { headers: getAuthHeader() });
      const json = await res.json();
      if (!json.success) { setError(json.error || "Failed to load"); return; }
      setEntries(json.data || []);
      setTotal(json.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleAdd = async () => {
    if (!addText.trim()) { setAddError("Text is required"); return; }
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch(apiUrl("/api/knowledge"), {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ text: addText.trim(), title: addTitle.trim() || "Knowledge Entry" }),
      });
      const json = await res.json();
      if (!json.success) { setAddError(json.error || "Failed to add"); return; }
      setShowAddModal(false);
      setAddText("");
      setAddTitle("");
      fetchEntries();
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
      if (!json.success) { alert(json.error || "Failed to delete"); return; }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotal((t) => t - 1);
    } catch (e) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const onLogout = () => {
    ["authToken", "userId", "isLoggedIn", "userEmail", "userRole"].forEach((k) =>
      localStorage.removeItem(k)
    );
    window.location.href = "/";
  };

  const filtered = search.trim()
    ? entries.filter((e) =>
        e.content.toLowerCase().includes(search.toLowerCase()) ||
        e.metadata?.title?.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  return (
    <div className="knowledge-page">
      <AdminNavbar
        isRoot={isRoot}
        actions={
          <>
            <button
              type="button"
              className="analytics-export-btn"
              onClick={() => {
                setShowAddModal(true);
                setAddError("");
              }}
            >
              <Plus size={16} />
              Add Entry
            </button>
            <div className="admin-menu" ref={menuRef}>
              <button
                type="button"
                className="analytics-menu-btn"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span>Admin</span>
                <ChevronDown size={16} />
              </button>
              {menuOpen && (
                <div className="admin-menu-pop">
                  <button type="button" onClick={onLogout}>
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      {/* Content */}
      <div className="knowledge-content">
        <div className="knowledge-header">
          <div>
            <h2 className="knowledge-title">
              <BookOpen size={22} /> Knowledge Base
            </h2>
            <p className="knowledge-subtitle">{total} {total === 1 ? "entry" : "entries"}</p>
          </div>
        </div>

        <input
          type="text"
          className="knowledge-search"
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {error && <div className="knowledge-error">{error}</div>}

        {loading ? (
          <p style={{ color: "#888", fontSize: 14 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="knowledge-empty">
            <BookOpen size={40} />
            <p>No knowledge entries yet. Add your first entry above.</p>
          </div>
        ) : (
          <div className="knowledge-list">
            {filtered.map((entry) => (
              <div key={entry.id} className="knowledge-entry">
                <div className="knowledge-entry-body">
                  {entry.metadata?.title && (
                    <div className="knowledge-entry-title">{entry.metadata.title}</div>
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
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="knowledge-modal-overlay">
          <div className="knowledge-modal">
            <div className="knowledge-modal-header">
              <h3>Add Knowledge Entry</h3>
              <button className="knowledge-modal-close" onClick={() => setShowAddModal(false)}>
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
              placeholder={"Q: How do I reset my LMS password?\nA: Go to LMS login page → click Forgot Password → follow email instructions.\n\nQ: How do I access Microsoft 365?\nA: Go to portal.office.com → log in with your LPU email."}
            />
            <p className="knowledge-modal-hint">
              Separate sections with blank lines — each section becomes a searchable chunk.
            </p>

            {addError && <div className="knowledge-modal-error">{addError}</div>}

            <div className="knowledge-modal-footer">
              <button className="knowledge-modal-cancel" onClick={() => setShowAddModal(false)}>
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
