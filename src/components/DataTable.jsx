import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";

/**
 * STRICT UNIFORM SIZING SYSTEM
 * Height: h-9 (36px)
 * Text: text-sm font-bold
 * Rounding: rounded-lg
 */
const UI_SHARED_BASE =
  "h-9 inline-flex items-center justify-center px-3 text-sm font-bold rounded-lg border transition-all whitespace-nowrap";

const BTN_STYLES = {
  primary:
    "bg-lpu-maroon border-lpu-maroon text-white hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold",
  secondary:
    "border-lpu-maroon text-lpu-maroon dark:border-lpu-gold dark:text-lpu-gold hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold dark:hover:bg-lpu-gold dark:hover:text-lpu-maroon dark:hover:border-lpu-gold",
};

export function TableButton({
  onClick,
  disabled,
  children,
  variant = "primary",
  className = "",
}) {
  // Directly maps to either "primary" or "secondary" (defaults to primary if misspelled)
  const style = BTN_STYLES[variant] || BTN_STYLES.primary;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(e);
      }}
      disabled={disabled}
      className={`${UI_SHARED_BASE} focus:outline-none focus:ring-2 focus:ring-lpu-gold focus:ring-offset-1 ${style} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

const BADGE_STYLES = {
  default:
    "bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  success:
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/25 dark:text-green-400 dark:border-green-700/40",
  warning:
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-700/30",
  danger:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/30",
  info: "bg-lpu-maroon/10 text-lpu-maroon border-lpu-maroon/20 dark:bg-lpu-maroon/20 dark:text-lpu-gold dark:border-lpu-maroon/30",
  "status-ongoing":
    "bg-green-800/10 text-green-800 border-green-800/30 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/30",
  "status-unassigned":
    "bg-lpu-gold/10 text-yellow-700 border-lpu-gold/50 dark:bg-lpu-gold/10 dark:text-yellow-400 dark:border-lpu-gold/30",
  "status-overdue":
    "bg-lpu-red/10 text-lpu-red border-lpu-red/40 dark:bg-lpu-red/15 dark:text-red-400 dark:border-lpu-red/30",
  "status-complete":
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700/30",
};

export function TableBadge({
  children,
  variant = "default",
  title,
  className = "",
}) {
  return (
    <span
      title={title}
      className={`${UI_SHARED_BASE} ${BADGE_STYLES[variant] ?? BADGE_STYLES.default} ${className}`}
    >
      {children}
    </span>
  );
}

export function TableSelect({
  value,
  options = [],
  onChange,
  placeholder,
  disabled,
  className = "",
}) {
  return (
    <div
      className={`relative h-9 group inline-block w-full min-w-32.5 ${className}`}
      onClick={(e) => e.stopPropagation()} // PREVENTS ROW CLICK BUG
    >
      <select
        className="w-full h-full appearance-none pl-3 pr-8 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-gray-700 dark:text-zinc-100 outline-none transition-all duration-200 focus:ring-2 focus:ring-lpu-gold focus:border-lpu-gold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        value={value || ""}
        disabled={disabled}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()} // Double protection for Safari/Firefox
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt, i) => (
          <option key={i} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-all duration-200 group-focus-within:rotate-180"
      />
    </div>
  );
}

export function DataTable({
  columns,
  data,
  onRowClick,
  emptyMessage = "No records found.",
  emptySubMessage = "Try adjusting your filters or search terms.",
  page,
  pageCount,
  totalCount,
  onPrevPage,
  onNextPage,
}) {
  const hasPagination = pageCount !== undefined && pageCount > 0;
  const headerRef = useRef(null);
  const bodyRef = useRef(null);
  const [scrollbarW, setScrollbarW] = useState(0);
  // Sort state: { index, direction: "asc" | "desc" } — null = unsorted
  const [sortConfig, setSortConfig] = useState(null);

  const isSortable = (col) =>
    col.sortable !== false &&
    col.variant !== "action" &&
    col.variant !== "select" &&
    col.accessor != null;

  const getSortValue = (col, row) =>
    typeof col.accessor === "function" ? col.accessor(row) : row[col.accessor];

  const handleSort = (col, index) => {
    if (!isSortable(col)) return;
    setSortConfig((prev) => {
      if (!prev || prev.index !== index) return { index, direction: "asc" };
      if (prev.direction === "asc") return { index, direction: "desc" };
      return null; // third click clears sort
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    const col = columns[sortConfig.index];
    if (!col) return data;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const isDateCol = col.variant === "date" || col.variant === "status";
    return [...data].sort((a, b) => {
      const av = getSortValue(col, a);
      const bv = getSortValue(col, b);
      // Empty values sink to bottom regardless of direction
      const aEmpty = av == null || av === "";
      const bEmpty = bv == null || bv === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      let cmp;
      if (isDateCol) {
        cmp = new Date(av).getTime() - new Date(bv).getTime();
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      return cmp * dir;
    });
  }, [data, columns, sortConfig]);
  const hasBodyRows = data.length > 0;

  // Measure vertical scrollbar width
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setScrollbarW(el.offsetWidth - el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasBodyRows]);

  // Sync header horizontal scroll with body
  useEffect(() => {
    const body = bodyRef.current;
    const header = headerRef.current;
    if (!body || !header) return;
    const sync = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener("scroll", sync, { passive: true });
    return () => body.removeEventListener("scroll", sync);
  });

  if (data.length === 0) {
    return (
      <div className="datatable-root flex flex-col w-full h-full min-h-125 rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex flex-1 flex-col items-center justify-center text-gray-400 dark:text-zinc-500 bg-gray-50/50 dark:bg-zinc-900 rounded-xl">
          <p className="text-xl font-semibold">{emptyMessage}</p>
          {emptySubMessage && <p className="text-sm mt-1">{emptySubMessage}</p>}
        </div>

        {hasPagination && pageCount > 1 && (
          <PaginationFooter
            page={page}
            pageCount={pageCount}
            totalCount={totalCount}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
          />
        )}
      </div>
    );
  }

  const renderCell = (col, row, rowIndex) => {
    const value =
      typeof col.accessor === "function"
        ? col.accessor(row)
        : row[col.accessor];

    if (col.render) return col.render(row, rowIndex);

    switch (col.variant) {
      case "badge":
        return (
          <span className="h-9 inline-flex items-center justify-center px-3 bg-gray-100 dark:bg-zinc-800 dark:text-zinc-200 group-hover:bg-lpu-maroon group-hover:text-white dark:group-hover:bg-lpu-gold dark:group-hover:text-black rounded-lg text-sm font-bold transition-colors whitespace-nowrap">
            #{value}
          </span>
        );
      case "title":
        return (
          <div
            className="text-sm font-bold text-gray-800 dark:text-zinc-100 truncate"
            title={value}
          >
            {value || "-"}
          </div>
        );
      case "subtitle":
        return (
          <div
            className="text-sm text-gray-500 dark:text-zinc-400 truncate italic"
            title={value}
          >
            {value || "-"}
          </div>
        );
      case "highlight":
        return (
          <span className="text-sm font-bold text-lpu-maroon dark:text-lpu-gold tracking-tighter truncate block">
            {value || "-"}
          </span>
        );
      case "date":
        return (
          <span className="text-sm text-gray-500 dark:text-zinc-400 whitespace-nowrap">
            {value ? new Date(value).toLocaleDateString() : "-"}
          </span>
        );
      case "status":
        return value ? (
          <span className="text-sm text-lpu-maroon dark:text-lpu-gold font-bold whitespace-nowrap">
            {new Date(value).toLocaleDateString()}
          </span>
        ) : (
          <TableBadge variant="success">Active</TableBadge>
        );
      case "statusText":
        return (
          <span className="text-sm font-bold text-gray-700 dark:text-zinc-200 whitespace-nowrap">
            {value || "Open"}
          </span>
        );
      case "select": {
        if (!col.options || col.options.length === 0) {
          return (
            <span className="text-sm text-gray-500 dark:text-zinc-400 whitespace-nowrap">
              {col.fallbackText ? col.fallbackText(row) : value || "—"}
            </span>
          );
        }
        const selectExtraClass =
          typeof col.selectClassName === "function"
            ? col.selectClassName(row, value)
            : col.selectClassName || "";
        const pillClassName =
          typeof col.pillClassName === "function"
            ? col.pillClassName(row, value)
            : col.pillClassName || "";

        if (pillClassName) {
          return (
            <div
              className="relative w-full h-9 group"
              onClick={(e) => e.stopPropagation()}
            >
              <select
                className={`w-full h-full appearance-none pl-3 pr-8 rounded-lg text-sm font-bold outline-none transition-all duration-200 focus:ring-2 focus:ring-lpu-gold focus:border-lpu-gold cursor-pointer ${pillClassName} ${selectExtraClass}`}
                value={value || ""}
                onChange={(e) =>
                  col.onChange && col.onChange(row, e.target.value)
                }
                onClick={(e) => e.stopPropagation()}
              >
                {col.placeholder && (
                  <option value="" disabled>
                    {col.placeholder}
                  </option>
                )}
                {col.options.map((opt, i) => (
                  <option key={i} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 opacity-70 group-focus-within:rotate-180 group-focus-within:opacity-100"
              />
            </div>
          );
        }
        return (
          <TableSelect
            value={value}
            options={col.options}
            placeholder={col.placeholder}
            onChange={(e) => col.onChange && col.onChange(row, e.target.value)}
          />
        );
      }
      case "action": {
        const isPrimary = col.isPrimary ? col.isPrimary(row) : true;
        return (
          <TableButton
            onClick={() => col.onClick && col.onClick(row)}
            variant={isPrimary ? "primary" : "secondary"}
          >
            {col.getLabel ? col.getLabel(row) : "Action"}
          </TableButton>
        );
      }
      default:
        return (
          <span className="text-sm text-gray-700 dark:text-zinc-200 truncate block">
            {value || "-"}
          </span>
        );
    }
  };

  const getColumnWidthClass = (col) => {
    if (col.colWidth != null) return col.colWidth;
    switch (col.variant) {
      case "badge":        return "w-20";
      case "title":        return "w-40";
      case "subtitle":     return "w-48";
      case "action":       return "w-24";
      case "select":       return "w-45";
      case "date":
      case "highlight":
      default:             return "w-28";
    }
  };

  return (
    <div className="datatable-root w-full h-full rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col">
      {/* Header — overflow-x hidden, scrollLeft synced via JS */}
      <div ref={headerRef} className="overflow-x-hidden rounded-t-xl shrink-0">
        <table className="w-full min-w-325 text-left border-collapse table-fixed">
          <colgroup>
            {columns.map((col, index) => (
              <col key={index} className={getColumnWidthClass(col)} />
            ))}
            {scrollbarW > 0 && <col style={{ width: scrollbarW }} />}
          </colgroup>
          <thead className="bg-lpu-maroon text-white">
            <tr>
              {columns.map((col, index) => {
                const sortable = isSortable(col);
                const active = sortConfig?.index === index;
                return (
                  <th
                    key={index}
                    onClick={() => handleSort(col, index)}
                    className={`px-3 py-4 md:px-4 font-bold uppercase text-[11px] tracking-widest select-none ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${index === 0 ? "rounded-tl-xl" : ""} ${
                      index === columns.length - 1 && scrollbarW === 0 ? "rounded-tr-xl" : ""
                    } ${sortable ? "cursor-pointer hover:bg-white/10 transition-colors" : ""}`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 ${
                        col.align === "right" ? "flex-row-reverse" : ""
                      }`}
                    >
                      {col.label}
                      {sortable &&
                        (!active ? (
                          <ChevronsUpDown size={12} className="opacity-40" />
                        ) : sortConfig.direction === "asc" ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        ))}
                    </span>
                  </th>
                );
              })}
              {scrollbarW > 0 && (
                <th style={{ width: scrollbarW, padding: 0 }} className="rounded-tr-xl bg-lpu-maroon" />
              )}
            </tr>
          </thead>
        </table>
      </div>
      {/* Body — vertical + horizontal scroll both here */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-auto pb-2">
        <table className="w-full min-w-325 text-left border-collapse table-fixed">
          <colgroup>
            {columns.map((col, index) => (
              <col key={index} className={getColumnWidthClass(col)} />
            ))}
          </colgroup>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {sortedData.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                onClick={() => onRowClick && onRowClick(row)}
                tabIndex={onRowClick ? 0 : -1}
                style={{ animationDelay: `${rowIndex * 30}ms` }}
                className={`group transition-colors duration-200 animate-in fade-in slide-in-from-left-4 hover:bg-lpu-gold/10 dark:hover:bg-lpu-maroon/20 ${
                  rowIndex % 2 === 0
                    ? "bg-white dark:bg-zinc-900"
                    : "bg-gray-50 dark:bg-[#1f1f23]"
                } ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-3 py-3 md:px-4 align-middle overflow-hidden whitespace-nowrap ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                    onClick={(e) => {
                      if (col.preventRowClick) e.stopPropagation();
                    }}
                  >
                    {renderCell(col, row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasPagination && (
        <PaginationFooter
          page={page}
          pageCount={pageCount}
          totalCount={totalCount}
          onPrevPage={onPrevPage}
          onNextPage={onNextPage}
        />
      )}
    </div>
  );
}

function PaginationFooter({
  page,
  pageCount,
  totalCount,
  onPrevPage,
  onNextPage,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-b-xl">
      <span className="text-sm text-gray-500 dark:text-zinc-400 font-medium">
        Page{" "}
        <span className="font-bold text-gray-800 dark:text-zinc-100">
          {page + 1}
        </span>{" "}
        of{" "}
        <span className="font-bold text-gray-800 dark:text-zinc-100">
          {pageCount}
        </span>
        {totalCount !== undefined && (
          <span className="ml-1 text-gray-400 dark:text-zinc-500">
            ({totalCount} total)
          </span>
        )}
      </span>
      <div className="flex gap-2">
        <TableButton
          onClick={onPrevPage}
          disabled={page === 0}
          variant="secondary"
        >
          <ChevronLeft size={16} className="mr-1" /> Prev
        </TableButton>
        <TableButton
          onClick={onNextPage}
          disabled={page >= pageCount - 1}
          variant="secondary"
        >
          Next <ChevronRight size={16} className="ml-1" />
        </TableButton>
      </div>
    </div>
  );
}
