import { useState, useCallback } from "react";
import { Calendar } from "lucide-react";

function toYMD(date) {
  return date.toISOString().slice(0, 10);
}

function subtractMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toYMD(d);
}

function formatDisplay(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return null;
  return `${m}/${d}/${y.slice(-2)}`;
}

const PRESETS = [
  { key: "1m", label: "1M", months: 1 },
  { key: "3m", label: "3M", months: 3 },
  { key: "6m", label: "6M", months: 6 },
  { key: "1y", label: "1Y", months: 12 },
  { key: "custom", label: "Custom", months: null },
];

function DatePill({ value, placeholder, onChange }) {
  const display = formatDisplay(value);

  const handleClick = (e) => {
    const input = e.currentTarget.querySelector('input[type="date"]');
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      input.focus();
      return;
    }
    input.focus();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) =>
        e.key === "Enter" && handleClick({ currentTarget: e.currentTarget })
      }
      className="relative cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-lg px-3 h-9 flex items-center gap-2 min-w-28 text-xs font-semibold shadow-sm hover:border-lpu-maroon/40 hover:shadow transition-all focus-within:ring-2 focus-within:ring-lpu-maroon/20 focus-within:border-lpu-maroon/40"
    >
      <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
      <span className="relative z-10 pointer-events-none whitespace-nowrap">
        {display ? (
          <span className="text-gray-800 dark:text-zinc-100">{display}</span>
        ) : (
          <span className="text-gray-400 dark:text-zinc-500">
            {placeholder}
          </span>
        )}
      </span>
      <input
        type="date"
        className="absolute inset-0 opacity-0 cursor-pointer z-20 w-full"
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export function DateRangeFilter({ onChange, className = "" }) {
  const [active, setActive] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const clearAll = useCallback(() => {
    setActive(null);
    setFrom("");
    setTo("");
    onChange("", "");
  }, [onChange]);

  const selectPreset = useCallback(
    (key) => {
      setActive(key);
      if (key === "custom") return;
      const preset = PRESETS.find((p) => p.key === key);
      onChange(subtractMonths(preset.months), toYMD(new Date()));
    },
    [onChange],
  );

  const handleFrom = useCallback(
    (e) => {
      setFrom(e.target.value);
      onChange(e.target.value, to);
    },
    [to, onChange],
  );

  const handleTo = useCallback(
    (e) => {
      setTo(e.target.value);
      onChange(from, e.target.value);
    },
    [from, onChange],
  );

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-2 ${className}`}
    >
      {/* Segmented preset control */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800/60 shadow-sm p-0.5 gap-0.5 cursor-alias">
        <button
          type="button"
          onClick={clearAll}
          className={`px-3 h-8 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
            active === null
              ? "bg-lpu-maroon text-white shadow-sm"
              : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-white/70 dark:hover:bg-zinc-700/60"
          }`}
        >
          All
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => selectPreset(p.key)}
            className={`px-3 h-8 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
              active === p.key
                ? "bg-lpu-maroon text-white shadow-sm"
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-white/70 dark:hover:bg-zinc-700/60"
            }`}
          >
            {p.key === "custom" ? (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Custom
              </span>
            ) : (
              p.label
            )}
          </button>
        ))}
      </div>

      {/* Custom date range pickers */}
      {active === "custom" && (
        <div className="flex items-center gap-1.5">
          <DatePill
            value={from}
            placeholder="From date"
            onChange={handleFrom}
          />
          <span className="text-xs font-medium text-gray-300 dark:text-zinc-600">
            —
          </span>
          <DatePill value={to} placeholder="To date" onChange={handleTo} />
        </div>
      )}
    </div>
  );
}
