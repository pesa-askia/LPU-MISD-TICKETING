import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  Sparkles,
  BarChart3,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  BookOpen,
  Plus,
  Check,
  RefreshCw,
  XCircle,
  Play,
  Download,
} from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { useLoading } from "../../context/LoadingContext";
import {
  useNavbarActions,
  NavbarActionButton,
} from "../../context/NavbarActionsContext";

function getAuthHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` };
}
function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}
function escapeCsv(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replaceAll('"', '""')}"`;
  return s;
}
function getAdminLevel() {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return null;
    return jwtDecode(token)?.admin_level ?? null;
  } catch {
    return null;
  }
}

// ── period helpers ────────────────────────────────────────────────────────────

const PERIOD_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) =>
  String(new Date().getFullYear() - i),
);

function getISOWeek(date = new Date()) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function defaultPeriodKey(type) {
  const now = new Date();
  switch (type) {
    case "daily":
      return now.toISOString().slice(0, 10);
    case "weekly":
      return getISOWeek(now);
    case "monthly":
      return now.toISOString().slice(0, 7);
    case "yearly":
      return String(now.getFullYear());
    default:
      return "";
  }
}

// ── skeleton primitives ───────────────────────────────────────────────────────

function Sk({ className = "" }) {
  return (
    <div
      className={`bg-gray-100 dark:bg-zinc-800 rounded animate-pulse ${className}`}
    />
  );
}

function SkeletonAnalysisCard() {
  return (
    <Card>
      <div className="flex items-center gap-2 px-5 pt-3 pb-2.5 border-b border-gray-100 dark:border-white/5">
        <Sk className="w-6 h-6 rounded-lg" />
        <Sk className="h-4 w-32" />
      </div>
      <div className="px-4 py-3 space-y-0">
        {[80, 65, 50, 40].map((w, i) => (
          <div
            key={i}
            className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0"
          >
            <Sk className="w-5 h-5 shrink-0 mt-0.5 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Sk className="h-4 w-14 rounded" />
                <Sk className={`h-4 w-[${w}%]`} />
              </div>
              <Sk className="h-1.5 w-full rounded-full" />
              <Sk className="h-3 w-full" />
              <Sk className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SkeletonFeedbackCard() {
  return (
    <Card>
      <div className="flex items-center gap-2 px-5 pt-3 pb-2.5 border-b border-gray-100 dark:border-white/5">
        <Sk className="w-6 h-6 rounded-lg" />
        <Sk className="h-4 w-36" />
      </div>
      <div className="px-4 py-3 space-y-0">
        {[3, 2, 4].map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0"
          >
            <Sk className="w-5 h-5 shrink-0 mt-0.5 rounded-md" />
            <Sk className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function SkeletonKBCard() {
  return (
    <Card>
      <div className="flex items-center gap-2 px-5 pt-3 pb-2.5 border-b border-gray-100 dark:border-white/5">
        <Sk className="w-6 h-6 rounded-lg" />
        <Sk className="h-4 w-48" />
      </div>
      <div className="px-5 py-4 space-y-0">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="py-3.5 border-b border-gray-100 dark:border-white/5 last:border-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Sk className="h-3 w-4" />
                  <Sk className="h-4 w-2/3" />
                </div>
                <div className="flex items-start gap-2">
                  <Sk className="h-3 w-4 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <Sk className="h-3 w-full" />
                    <Sk className="h-3 w-4/5" />
                  </div>
                </div>
              </div>
              <Sk className="shrink-0 h-9 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SkeletonResults() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonAnalysisCard />
        <SkeletonAnalysisCard />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonFeedbackCard />
        <SkeletonFeedbackCard />
      </div>
      <SkeletonKBCard />
    </>
  );
}

// ── shared card components — identical to Stats page ─────────────────────────

function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-xl shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, aside }) {
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-2.5 border-b border-gray-100 dark:border-white/5">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-lpu-maroon/8 dark:bg-lpu-maroon/15">
          <Icon className="w-3.5 h-3.5 text-lpu-maroon" strokeWidth={2} />
        </span>
        <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-zinc-100">
          {title}
        </h3>
      </div>
      {aside && <div>{aside}</div>}
    </div>
  );
}

// ── category color map ────────────────────────────────────────────────────────

const CAT_STYLES = {
  LMS: {
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
    bar: "bg-blue-500",
  },
  Hardware: {
    badge:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800",
    bar: "bg-orange-500",
  },
  Software: {
    badge:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800",
    bar: "bg-purple-500",
  },
  "Microsoft 365": {
    badge:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800",
    bar: "bg-green-500",
  },
  "Student Portal": {
    badge:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800",
    bar: "bg-teal-500",
  },
  ERP: {
    badge:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800",
    bar: "bg-indigo-500",
  },
  Network: {
    badge:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800",
    bar: "bg-cyan-500",
  },
};
const CAT_DEFAULT = {
  badge:
    "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-white/10",
  bar: "bg-lpu-maroon",
};

function catStyle(cat) {
  return CAT_STYLES[cat] || CAT_DEFAULT;
}

// ── shared row — used by BOTH problems and solutions ──────────────────────────

function AnalysisRow({ index, category, primary, secondary, count, maxCount }) {
  const { badge, bar } = catStyle(category);
  const pct =
    maxCount > 0 && count != null ? Math.round((count / maxCount) * 100) : 0;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-gray-400 dark:text-zinc-500">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span
            className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge}`}
          >
            {category || "General"}
          </span>
          <span className="text-sm font-semibold text-gray-800 dark:text-zinc-100 min-w-0 truncate flex-1">
            {primary}
          </span>
          {count != null && (
            <span className="shrink-0 text-xs font-bold text-gray-400 dark:text-zinc-500 tabular-nums">
              {count}
            </span>
          )}
        </div>
        {count != null && (
          <div className="h-1 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full ${bar} rounded-full transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {secondary && (
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}

// ── shared feedback card — used by BOTH satisfied and dissatisfied ────────────

function FeedbackCard({ positive, themes }) {
  const Icon = positive ? ThumbsUp : ThumbsDown;
  const title = positive ? "Satisfied Feedback" : "Dissatisfied Feedback";
  const numBg = positive
    ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400"
    : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400";
  const bar = positive ? "bg-green-500" : "bg-rose-500";

  // support both legacy string[] and new {theme,count}[]
  const normalized = themes.map((t) =>
    typeof t === "string" ? { theme: t, count: null } : t,
  );
  const maxCount = normalized.reduce((m, t) => Math.max(m, t.count || 0), 1);

  return (
    <Card>
      <CardHeader icon={Icon} title={title} />
      <div className="px-4 py-3">
        {normalized.length > 0 ? (
          normalized.map((t, i) => {
            const pct =
              t.count != null ? Math.round((t.count / maxCount) * 100) : 0;
            return (
              <div
                key={i}
                className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0"
              >
                <span
                  className={`shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${numBg}`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-gray-800 dark:text-zinc-100 flex-1">
                      {t.theme}
                    </span>
                    {t.count != null && (
                      <span className="shrink-0 text-xs font-bold text-gray-400 dark:text-zinc-500 tabular-nums">
                        {t.count}
                      </span>
                    )}
                  </div>
                  {t.count != null && (
                    <div className="h-1 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4 italic">
            No feedback comments to analyze
          </p>
        )}
      </div>
    </Card>
  );
}

// ── KB suggestion entry ───────────────────────────────────────────────────────

function KBEntry({ entry, index, added, adding, onAdd }) {
  return (
    <div
      className={`py-3.5 border-b border-gray-100 dark:border-white/5 last:border-0 ${added ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mr-2">
              Q
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
              {entry.question}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mr-2">
              A
            </span>
            <span className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
              {entry.answer}
            </span>
          </div>
        </div>
        <button
          onClick={() => onAdd(index)}
          disabled={added || adding}
          className={`shrink-0 mt-0.5 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-95 ${
            added
              ? "bg-[#EDF3EC] text-[#346538] border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 cursor-default"
              : adding
                ? "bg-lpu-maroon/60 text-white border-lpu-maroon cursor-wait"
                : "cursor-pointer bg-lpu-maroon text-white border-lpu-maroon hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {added ? (
            <Check size={11} />
          ) : adding ? (
            <RefreshCw size={11} className="animate-spin" />
          ) : (
            <Plus size={11} />
          )}
          {added ? "Saved" : adding ? "Saving…" : "Save Entry"}
        </button>
      </div>
    </div>
  );
}

// ── period selector toggle ────────────────────────────────────────────────────

function ToggleBtn({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
        active
          ? "bg-lpu-maroon text-white shadow-sm"
          : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-white/70 dark:hover:bg-zinc-700/60"
      }`}
    >
      {label}
    </button>
  );
}

// ── period date input ─────────────────────────────────────────────────────────

function PeriodInput({
  periodType,
  periodKey,
  setPeriodKey,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}) {
  const cls =
    "cursor-pointer px-2.5 h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-xs text-gray-800 dark:text-zinc-100 focus:outline-none focus:border-lpu-maroon dark:focus:border-lpu-maroon transition-colors";

  if (periodType === "daily") {
    return (
      <input
        type="date"
        value={periodKey}
        onChange={(e) => setPeriodKey(e.target.value)}
        className={cls}
      />
    );
  }
  if (periodType === "weekly") {
    return (
      <input
        type="week"
        value={periodKey}
        onChange={(e) => setPeriodKey(e.target.value)}
        className={cls}
      />
    );
  }
  if (periodType === "monthly") {
    return (
      <input
        type="month"
        value={periodKey}
        onChange={(e) => setPeriodKey(e.target.value)}
        className={cls}
      />
    );
  }
  if (periodType === "yearly") {
    return (
      <select
        value={periodKey}
        onChange={(e) => setPeriodKey(e.target.value)}
        className={cls}
      >
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    );
  }
  if (periodType === "custom") {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={customStart}
          onChange={(e) => setCustomStart(e.target.value)}
          className={cls}
        />
        <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>
        <input
          type="date"
          value={customEnd}
          onChange={(e) => setCustomEnd(e.target.value)}
          className={cls}
        />
      </div>
    );
  }
  return null;
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AdminAIAnalytics() {
  const adminLevel = getAdminLevel();
  if (adminLevel === null) return <Navigate to="/" replace />;

  const { showLoading, hideLoading } = useLoading();

  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [alreadyAnalyzed, setAlreadyAnalyzed] = useState(false);
  const [checkingPeriod, setCheckingPeriod] = useState(true);

  const [periodType, setPeriodType] = useState("monthly");
  const [periodKey, setPeriodKey] = useState(() => defaultPeriodKey("monthly"));
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const [periodTicketCount, setPeriodTicketCount] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [addedEntries, setAddedEntries] = useState(new Set());
  const [addingEntry, setAddingEntry] = useState(null);
  const [kbError, setKbError] = useState(null);

  const checkPeriod = useCallback(async (type, key, cStart, cEnd) => {
    setCheckingPeriod(true);
    try {
      const params = new URLSearchParams({ period_type: type });
      if (type === "custom") {
        params.set("customStart", cStart);
        params.set("customEnd", cEnd);
      } else {
        params.set("period_key", key);
      }
      const r = await fetch(apiUrl(`/api/ai-analytics/check?${params}`), {
        headers: getAuthHeader(),
      });
      const d = await r.json();
      if (d.success) {
        setAlreadyAnalyzed(d.analyzed);
        setPeriodTicketCount(d.ticketCount ?? null);
      }
    } catch {
      /* non-fatal */
    } finally {
      setCheckingPeriod(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/ai-analytics/status"), {
        headers: getAuthHeader(),
      });
      const d = await r.json();
      if (d.success) setStatus(d);
    } catch {
      /* non-fatal */
    }
  }, []);

  const fetchResults = useCallback(async (type, key, cStart, cEnd) => {
    try {
      const params = new URLSearchParams({ period_type: type });
      if (type === "custom") {
        params.set("customStart", cStart);
        params.set("customEnd", cEnd);
      } else {
        params.set("period_key", key);
      }
      const r = await fetch(apiUrl(`/api/ai-analytics/results?${params}`), {
        headers: getAuthHeader(),
      });
      const d = await r.json();
      if (d.success) setResults(d.data);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    (async () => {
      showLoading();
      await Promise.all([
        fetchStatus(),
        fetchResults(periodType, periodKey, customStart, customEnd),
      ]);
      hideLoading();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCategoryFilter(null);
  }, [results]);

  useEffect(() => {
    checkPeriod(periodType, periodKey, customStart, customEnd);
    fetchResults(periodType, periodKey, customStart, customEnd);
  }, [
    periodType,
    periodKey,
    customStart,
    customEnd,
    checkPeriod,
    fetchResults,
  ]);

  const runAnalysis = async (force = false) => {
    setAnalyzing(true);
    setError(null);
    setAlreadyAnalyzed(false);
    setAddedEntries(new Set());
    setKbError(null);
    try {
      const body =
        periodType === "custom"
          ? { period_type: periodType, customStart, customEnd, force }
          : { period_type: periodType, period_key: periodKey, force };

      const r = await fetch(apiUrl("/api/ai-analytics/analyze"), {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();

      if (d.alreadyAnalyzed) {
        setAlreadyAnalyzed(true);
        return;
      }
      if (!d.success) throw new Error(d.error || "Analysis failed");

      await Promise.all([
        fetchStatus(),
        fetchResults(periodType, periodKey, customStart, customEnd),
      ]);
      await checkPeriod(periodType, periodKey, customStart, customEnd);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const addToKb = async (index) => {
    const suggestions = results?.results?.suggested_kb_entries || [];
    const entry = suggestions[index];
    if (!entry) return;
    setAddingEntry(index);
    setKbError(null);
    try {
      const r = await fetch(apiUrl("/api/ai-analytics/add-knowledge"), {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          question: entry.question,
          answer: entry.answer,
          title: entry.title,
        }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Failed to add entry");
      setAddedEntries((prev) => new Set([...prev, index]));
    } catch (err) {
      setKbError(err.message);
    } finally {
      setAddingEntry(null);
    }
  };

  const onExportCsv = () => {
    if (!results) return;
    const rows = [];
    const headers = ["type", "category", "label", "count", "description"];

    for (const p of [...(results.results?.problems || [])].sort(
      (a, b) => (b.count || 0) - (a.count || 0),
    )) {
      rows.push([
        "Problem",
        p.category || "",
        p.issue || "",
        p.count ?? "",
        p.description || "",
      ]);
    }
    for (const s of [...(results.results?.solutions || [])].sort(
      (a, b) => (b.count || 0) - (a.count || 0),
    )) {
      rows.push([
        "Solution",
        s.category || "",
        s.problem || "",
        s.count ?? "",
        s.description || s.solution || "",
      ]);
    }
    for (const t of results.results?.satisfied_themes || []) {
      rows.push(["Satisfied Theme", "", t, "", ""]);
    }
    for (const t of results.results?.dissatisfied_themes || []) {
      rows.push(["Dissatisfied Theme", "", t, "", ""]);
    }

    const periodLabel =
      periodType === "custom" ? `${customStart}_${customEnd}` : periodKey;
    const csv = [headers, ...rows]
      .map((r) => r.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `insights-${periodType}-${periodLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useNavbarActions(
    <NavbarActionButton
      icon={Download}
      label="Export CSV"
      onClick={onExportCsv}
    />,
  );

  const unanalyzedCount = alreadyAnalyzed ? 0 : (periodTicketCount ?? null);
  const unknownRe =
    /^(unknown|unidentified|other issue|n\/a|none|unclear|unspecified)$/i;
  const problems = [...(results?.results?.problems || [])]
    .filter((p) => p.issue && !unknownRe.test(p.issue.trim()))
    .sort((a, b) => (b.count || 0) - (a.count || 0));
  const solutions = [...(results?.results?.solutions || [])]
    .filter((s) => s.problem && !unknownRe.test(s.problem.trim()))
    .sort((a, b) => (b.count || 0) - (a.count || 0));
  const satisfiedThemes = results?.results?.satisfied_themes || [];
  const dissatisfiedThemes = results?.results?.dissatisfied_themes || [];
  const kbSuggestions = results?.results?.suggested_kb_entries || [];

  const availableCategories = [
    ...new Set([
      ...problems.map((p) => p.category).filter(Boolean),
      ...solutions.map((s) => s.category).filter(Boolean),
    ]),
  ].sort();

  const filteredProblems = categoryFilter
    ? problems.filter((p) => p.category === categoryFilter)
    : problems;
  const filteredSolutions = categoryFilter
    ? solutions.filter((s) => s.category === categoryFilter)
    : solutions;

  const maxProblemCount = filteredProblems.reduce(
    (m, p) => Math.max(m, p.count || 0),
    1,
  );
  const maxSolutionCount = filteredSolutions.reduce(
    (m, s) => Math.max(m, s.count || 0),
    1,
  );
  const hasResults =
    problems.length +
      solutions.length +
      satisfiedThemes.length +
      dissatisfiedThemes.length >
    0;

  return (
    <section className="w-full max-w-330 mx-auto px-6 py-4 md:py-6 font-poppins dark:text-gray-100">
      <div className="flex flex-col gap-4">
        {/* ── Run Analysis ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Left: period tabs + date input */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800/60 shadow-sm p-0.5 gap-0.5">
                {PERIOD_TYPES.map((pt) => (
                  <ToggleBtn
                    key={pt.value}
                    active={periodType === pt.value}
                    onClick={() => {
                      setPeriodType(pt.value);
                      if (pt.value !== "custom")
                        setPeriodKey(defaultPeriodKey(pt.value));
                      setAlreadyAnalyzed(false);
                      setCheckingPeriod(true);
                      setError(null);
                    }}
                    label={pt.label}
                  />
                ))}
              </div>

              <PeriodInput
                periodType={periodType}
                periodKey={periodKey}
                setPeriodKey={setPeriodKey}
                customStart={customStart}
                setCustomStart={setCustomStart}
                customEnd={customEnd}
                setCustomEnd={setCustomEnd}
              />
            </div>

            {/* Right: stats + action buttons */}
            <div className="flex items-center gap-3">
              {status != null && (
                <span className="flex items-center gap-2 text-xs">
                  <span>
                    <span className="font-semibold tabular-nums text-gray-800 dark:text-zinc-200">
                      {status.totalClosed}
                    </span>
                    <span className="ml-1 text-gray-400 dark:text-zinc-500">
                      closed
                    </span>
                  </span>
                  <span className="text-gray-300 dark:text-white/10 select-none">
                    ·
                  </span>
                  <span>
                    <span className="font-semibold tabular-nums text-gray-800 dark:text-zinc-200">
                      {checkingPeriod ? "—" : (unanalyzedCount ?? "—")}
                    </span>
                    <span className="ml-1 text-gray-400 dark:text-zinc-500">
                      unanalyzed
                    </span>
                  </span>
                </span>
              )}

              <div className="flex items-center gap-1.5">
                <div
                  title={
                    periodType === "custom"
                      ? "Custom range is view-only, please select a fixed period to analyze"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => runAnalysis(false)}
                    disabled={
                      analyzing ||
                      checkingPeriod ||
                      alreadyAnalyzed ||
                      periodType === "custom"
                    }
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold bg-lpu-maroon text-white border border-lpu-maroon hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {analyzing ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <Play size={11} />
                    )}
                    Analyze
                  </button>
                </div>

                <div
                  title={
                    periodType === "custom"
                      ? "Custom range is view-only — select a fixed period to analyze"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => runAnalysis(true)}
                    disabled={analyzing || periodType === "custom"}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-lpu-maroon dark:text-lpu-gold border border-lpu-maroon dark:border-lpu-gold hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold dark:hover:bg-lpu-gold dark:hover:text-lpu-maroon dark:hover:border-lpu-gold active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <AlertTriangle size={11} />
                    Force Analyze
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && !analyzing && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-[#FDEBEC] dark:bg-rose-950/20 border border-red-100 dark:border-rose-800 rounded-xl text-sm text-[#9F2F2D] dark:text-rose-400">
              <XCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* ── results ── */}
        {analyzing ? (
          <SkeletonResults />
        ) : hasResults ? (
          <>
            {/* Category filter */}
            {availableCategories.length > 1 && (
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800/60 shadow-sm p-0.5 gap-0.5 flex-wrap">
                <ToggleBtn
                  active={!categoryFilter}
                  onClick={() => setCategoryFilter(null)}
                  label="All"
                />
                {availableCategories.map((cat) => (
                  <ToggleBtn
                    key={cat}
                    active={categoryFilter === cat}
                    onClick={() =>
                      setCategoryFilter(categoryFilter === cat ? null : cat)
                    }
                    label={cat}
                  />
                ))}
              </div>
            )}

            {/* Problems + Solutions — 50/50 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader icon={BarChart3} title="Common Problems" />
                <div className="px-4 py-3">
                  {filteredProblems.length > 0 ? (
                    filteredProblems.map((p, i) => (
                      <AnalysisRow
                        key={i}
                        index={i}
                        category={p.category}
                        primary={p.issue}
                        secondary={p.description}
                        count={p.count}
                        maxCount={maxProblemCount}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4 italic">
                      No problem patterns found
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader icon={Lightbulb} title="Common Solutions" />
                <div className="px-4 py-3">
                  {filteredSolutions.length > 0 ? (
                    filteredSolutions.map((s, i) => (
                      <AnalysisRow
                        key={i}
                        index={i}
                        category={s.category}
                        primary={s.problem}
                        secondary={s.description || s.solution}
                        count={s.count}
                        maxCount={maxSolutionCount}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4 italic">
                      No solutions found in admin messages
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Satisfied + Dissatisfied — 50/50 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FeedbackCard positive={true} themes={satisfiedThemes} />
              <FeedbackCard positive={false} themes={dissatisfiedThemes} />
            </div>

            {/* KB suggestions */}
            {kbSuggestions.length > 0 && (
              <Card>
                <CardHeader
                  icon={BookOpen}
                  title="Suggested Knowledge Entries"
                  aside={
                    <span className="text-xs text-gray-400 dark:text-zinc-500">
                      {addedEntries.size}/{kbSuggestions.length} added
                    </span>
                  }
                />
                <div className="px-5 py-4">
                  {kbError && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[#FDEBEC] dark:bg-rose-950/20 border border-red-100 dark:border-rose-800 rounded-lg text-xs text-[#9F2F2D] dark:text-rose-400">
                      <XCircle size={11} className="shrink-0" />
                      {kbError}
                    </div>
                  )}
                  {kbSuggestions.map((entry, i) => (
                    <KBEntry
                      key={i}
                      entry={entry}
                      index={i}
                      added={addedEntries.has(i)}
                      adding={addingEntry === i}
                      onAdd={addToKb}
                    />
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-lpu-maroon/8 dark:bg-lpu-maroon/15 mb-3">
                <Sparkles
                  className="w-6 h-6 text-lpu-maroon"
                  strokeWidth={1.5}
                />
              </span>
              <p className="text-sm font-bold text-gray-800 dark:text-zinc-100 mb-1">
                No analysis results yet
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                Select a period and run an analysis to generate insights from
                closed tickets.
              </p>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
