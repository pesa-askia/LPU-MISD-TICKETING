import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { NavbarActionButton } from "../../context/NavbarActionsContext";
import { useNavbarActions } from "../../context/useNavbarActions";
import { SearchInput } from "../../components/Controls";
import {
  PrimaryButton,
  SecondaryButton,
  FloatingInput,
  FloatingTextarea,
} from "../../components/FormFields";
import { FormModal } from "../../components/Modal";

const PAGE_SIZE = 10;

function getAuthHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` };
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

function EntryForm({
  title,
  setTitle,
  text,
  setText,
  error,
  saving,
  onSave,
  onCancel,
  saveLabel,
}) {
  return (
    <div className="px-5 py-6 flex flex-col gap-5">
      <FloatingInput
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required={false}
      />
      <FloatingTextarea
        label="Content (Required)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        heightClass="h-[40vh] md:h-[clamp(300px,55vh,800px)]"
      />
      {error && (
        <div className="text-xs text-red-800 dark:text-red-400 px-3 py-2 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-100 dark:border-red-900/30">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <SecondaryButton label="Cancel" onClick={onCancel} disabled={saving} />
        <PrimaryButton label={saveLabel} onClick={onSave} isLoading={saving} />
      </div>
    </div>
  );
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

  const [editingEntry, setEditingEntry] = useState(null);
  const [editText, setEditText] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");

  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil(total / PAGE_SIZE);

  const fetchEntries = useCallback(async (currentPage = page, currentSearch = search) => {
    setLoading(true);
    setError("");
    try {
      if (currentSearch.trim()) {
        const params = new URLSearchParams({ limit: 1000, offset: 0 });
        const res = await fetch(apiUrl(`/api/knowledge?${params}`), {
          headers: getAuthHeader(),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error || "Failed to load");
          return;
        }
        const q = currentSearch.trim().toLowerCase();
        const filtered = (json.data || []).filter(
          (e) =>
            (e.metadata?.title || "").toLowerCase().includes(q) ||
            (e.content || "").toLowerCase().includes(q),
        );
        setTotal(filtered.length);
        setEntries(
          filtered.slice(
            currentPage * PAGE_SIZE,
            (currentPage + 1) * PAGE_SIZE,
          ),
        );
      } else {
        const params = new URLSearchParams({
          limit: PAGE_SIZE,
          page: String(currentPage + 1),
        });
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
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchEntries(page, search);
  }, [page, search, fetchEntries]);

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

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setEditTitle(entry.metadata?.title || "");
    setEditText(entry.content || "");
    setEditError("");
  };

  const handleEdit = async () => {
    if (!editText.trim()) {
      setEditError("Text is required");
      return;
    }
    setEditing(true);
    setEditError("");
    try {
      const res = await fetch(apiUrl(`/api/knowledge/${editingEntry.id}`), {
        method: "PUT",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editText.trim(),
          title: editTitle.trim() || "Knowledge Entry",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setEditError(json.error || "Failed to update");
        return;
      }
      setEditingEntry(null);
      fetchEntries(page, search);
    } catch (e) {
      setEditError(e.message);
    } finally {
      setEditing(false);
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
    <NavbarActionButton
      icon={Plus}
      label="Add Entry"
      onClick={() => {
        setShowAddModal(true);
        setAddError("");
        setAddText("");
        setAddTitle("");
      }}
    />,
  );

  return (
    <div className="w-full h-full flex flex-col flex-1 overflow-hidden dark:text-gray-100">
      <section className="w-full flex flex-col flex-1 h-full px-4 py-4 md:px-6 md:py-6 font-poppins min-h-0">
        {/* Search bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-4 shrink-0">
          <SearchInput
            placeholder="Search entries..."
            onSearch={handleSearch}
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-4 rounded-xl font-semibold text-center border border-red-100 dark:border-red-900/30 mb-4 shrink-0">
            {error}
          </div>
        )}

        {/* Main Grid Wrapper: We apply overflow-y-auto HERE so mobile can scroll normally */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto pr-1 flex flex-col">
          {loading ? (
            <p className="text-gray-500 dark:text-zinc-400 text-sm">
              Loading...
            </p>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full w-full text-gray-400 dark:text-zinc-500">
              <BookOpen size={40} className="mb-2 opacity-50" />
              <p>No knowledge entries found.</p>
            </div>
          ) : (
            <div className="h-full w-full">
              {/* Added lg: modifiers: Desktop acts as a stretched rigid grid. Mobile acts as a standard scrolling list. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 min-h-full lg:h-full lg:auto-rows-fr pb-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    // min-h-[140px] guarantees the cards will never squish down to tiny slivers on mobile
                    className="flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm w-full hover:shadow-md transition-shadow min-h-35 lg:min-h-0 h-full"
                  >
                    {entry.metadata?.title && (
                      <p className="font-bold text-lpu-maroon dark:text-lpu-gold text-sm tracking-tight mb-2 leading-snug shrink-0">
                        {entry.metadata.title}
                      </p>
                    )}

                    {/* Strictly Truncated Text: No scroll, strictly respects container bounds */}
                    <p className="flex-1 min-h-0 text-xs text-gray-600 dark:text-zinc-400 whitespace-pre-wrap text-justify leading-relaxed overflow-hidden text-ellipsis">
                      {entry.content.length > 250
                        ? entry.content.slice(0, 250) + "…"
                        : entry.content}
                    </p>

                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800 shrink-0">
                      <span className="bg-lpu-maroon/10 dark:bg-lpu-maroon/20 text-lpu-maroon dark:text-lpu-gold text-xs font-bold px-2 py-1 rounded-md border border-lpu-maroon/20 dark:border-lpu-maroon/30 tabular-nums">
                        ID: {entry.id}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          className="flex items-center justify-center w-7 h-7 text-lpu-maroon border border-lpu-maroon dark:text-lpu-gold dark:border-lpu-gold rounded-md hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold dark:hover:bg-lpu-gold dark:hover:text-lpu-maroon dark:hover:border-lpu-gold transition-all duration-200 cursor-pointer shadow-sm"
                          onClick={() => openEdit(entry)}
                          title="Edit entry"
                        >
                          <Pencil size={12} strokeWidth={2.5} />
                        </button>
                        <button
                          className="flex items-center justify-center w-7 h-7 bg-lpu-maroon text-white border border-lpu-maroon rounded-md hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          title="Delete entry"
                        >
                          <Trash2 size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 shrink-0">
            <span className="text-sm text-gray-500 dark:text-zinc-400 font-medium">
              Page{" "}
              <span className="font-bold text-gray-800 dark:text-zinc-100">
                {page + 1}
              </span>{" "}
              of{" "}
              <span className="font-bold text-gray-800 dark:text-zinc-100">
                {pageCount}
              </span>
              <span className="ml-1 text-gray-400 dark:text-zinc-500">
                ({total} total)
              </span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-9 inline-flex items-center justify-center px-3 text-sm font-bold rounded-lg border transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-lpu-gold focus:ring-offset-1 border-lpu-maroon text-lpu-maroon dark:border-lpu-gold dark:text-lpu-gold hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold dark:hover:bg-lpu-gold dark:hover:text-lpu-maroon dark:hover:border-lpu-gold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} className="mr-1" /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="h-9 inline-flex items-center justify-center px-3 text-sm font-bold rounded-lg border transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-lpu-gold focus:ring-offset-1 border-lpu-maroon text-lpu-maroon dark:border-lpu-gold dark:text-lpu-gold hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold dark:hover:bg-lpu-gold dark:hover:text-lpu-maroon dark:hover:border-lpu-gold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={16} className="ml-1" />
              </button>
            </div>
          </div>
        )}
      </section>
      {showAddModal && (
        <FormModal
          title="Add Knowledge Entry"
          icon={Plus}
          onClose={() => setShowAddModal(false)}
        >
          <EntryForm
            title={addTitle}
            setTitle={setAddTitle}
            text={addText}
            setText={setAddText}
            error={addError}
            saving={adding}
            onSave={handleAdd}
            onCancel={() => setShowAddModal(false)}
            saveLabel="Save Entry"
          />
        </FormModal>
      )}
      {editingEntry && (
        <FormModal
          title="Edit Knowledge Entry"
          icon={Pencil}
          onClose={() => setEditingEntry(null)}
        >
          <EntryForm
            title={editTitle}
            setTitle={setEditTitle}
            text={editText}
            setText={setEditText}
            error={editError}
            saving={editing}
            onSave={handleEdit}
            onCancel={() => setEditingEntry(null)}
            saveLabel="Update Entry"
          />
        </FormModal>
      )}
    </div>
  );
}
