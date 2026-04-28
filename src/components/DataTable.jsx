import React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

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
    "border-lpu-maroon text-lpu-maroon hover:bg-lpu-gold hover:text-lpu-maroon hover:border-lpu-gold",
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
      className={`${UI_SHARED_BASE} focus:outline-none focus:ring-2 focus:ring-lpu-gold focus:ring-offset-1 ${style} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

const BADGE_STYLES = {
  default: "bg-gray-100 text-gray-700 border-gray-200",
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-orange-100 text-orange-700 border-orange-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-lpu-maroon/10 text-lpu-maroon border-lpu-maroon/20",
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
        className="w-full h-full appearance-none pl-3 pr-8 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none transition-all duration-200 focus:ring-2 focus:ring-lpu-gold focus:border-lpu-gold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-all duration-200 group-focus-within:rotate-180 group-focus-within:text-lpu-gold"
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

  if (data.length === 0) {
    return (
      <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 rounded-xl">
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
          <span className="h-9 inline-flex items-center justify-center px-3 bg-gray-100 group-hover:bg-lpu-maroon group-hover:text-white rounded-lg text-sm font-bold transition-colors whitespace-nowrap border border-transparent group-hover:border-lpu-maroon">
            #{value}
          </span>
        );
      case "title":
        return (
          <div
            className="text-sm font-bold text-gray-800 line-clamp-1"
            title={value}
          >
            {value || "-"}
          </div>
        );
      case "subtitle":
        return (
          <div
            className="text-sm text-gray-500 line-clamp-1 italic"
            title={value}
          >
            {value || "-"}
          </div>
        );
      case "highlight":
        return (
          <span className="text-sm font-bold text-lpu-maroon tracking-tighter line-clamp-1">
            {value || "-"}
          </span>
        );
      case "date":
        return (
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {value ? new Date(value).toLocaleDateString() : "-"}
          </span>
        );
      case "status":
        return value ? (
          <span className="text-sm text-lpu-maroon font-bold whitespace-nowrap">
            {new Date(value).toLocaleDateString()}
          </span>
        ) : (
          <TableBadge variant="success">Active</TableBadge>
        );
      case "statusText":
        return (
          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
            {value || "Open"}
          </span>
        );
      case "select":
        if (!col.options || col.options.length === 0) {
          return (
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {col.fallbackText ? col.fallbackText(row) : value || "—"}
            </span>
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
      case "action":
        const isPrimary = col.isPrimary ? col.isPrimary(row) : true;
        return (
          <TableButton
            onClick={() => col.onClick && col.onClick(row)}
            variant={isPrimary ? "primary" : "secondary"}
          >
            {col.getLabel ? col.getLabel(row) : "Action"}
          </TableButton>
        );
      default:
        return (
          <span className="text-sm text-gray-700 line-clamp-1">
            {value || "-"}
          </span>
        );
    }
  };

  const getColumnWidthClass = (col) => {
    if (col.colWidth) return col.colWidth;
    switch (col.variant) {
      case "badge":
        return "w-20 md:w-28";
      case "title":
        return "w-1/4 md:w-1/6";
      case "subtitle":
        return "w-1/3 md:w-1/3";
      case "action":
        return "w-24 md:w-25";
      case "select":
        return "w-45 md:w-55";
      case "date":
      case "highlight":
      default:
        return "w-24";
    }
  };

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm overflow-x-auto md:overflow-x-hidden">
      <div className="min-w-200 md:min-w-full flex flex-col">
        {/* HEADER TABLE */}
        <div className="w-full bg-lpu-maroon text-white rounded-t-xl pr-1 md:pr-2">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              {columns.map((col, index) => (
                <col key={index} className={getColumnWidthClass(col)} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((col, index) => (
                  <th
                    key={index}
                    className={`px-3 py-4 md:px-4 font-bold uppercase text-[11px] tracking-widest ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* BODY TABLE */}
        <div className="w-full max-h-150 overflow-y-auto overflow-x-hidden rounded-b-xl pb-2">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              {columns.map((col, index) => (
                <col key={index} className={getColumnWidthClass(col)} />
              ))}
            </colgroup>
            <tbody className="divide-y divide-gray-100">
              {data.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  onClick={() => onRowClick && onRowClick(row)}
                  tabIndex={onRowClick ? 0 : -1}
                  style={{ animationDelay: `${rowIndex * 30}ms` }}
                  className={`group transition-colors duration-200 animate-in fade-in slide-in-from-left-4 hover:bg-lpu-gold/10 ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-3 py-3 md:px-4 align-middle overflow-hidden ${
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
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white rounded-b-xl">
      <span className="text-sm text-gray-500 font-medium">
        Page <span className="font-bold text-gray-800">{page + 1}</span> of{" "}
        <span className="font-bold text-gray-800">{pageCount}</span>
        {totalCount !== undefined && (
          <span className="ml-1 text-gray-400">({totalCount} total)</span>
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
