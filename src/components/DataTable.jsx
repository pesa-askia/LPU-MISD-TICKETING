import React from "react";

export function DataTable({
  columns,
  data,
  onRowClick,
  emptyMessage = "No records found.",
  emptySubMessage = "Try adjusting your filters or search terms.",
}) {
  if (data.length === 0) {
    return (
      <div className="w-full rounded-xl border border-gray-100 bg-white">
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 rounded-xl">
          <p className="text-xl font-semibold">{emptyMessage}</p>
          {emptySubMessage && <p className="text-sm mt-1">{emptySubMessage}</p>}
        </div>
      </div>
    );
  }

  // 1. The Design System
  const renderCell = (col, row, rowIndex) => {
    const value =
      typeof col.accessor === "function"
        ? col.accessor(row)
        : row[col.accessor];

    if (col.render && !col.variant) return col.render(row, rowIndex);

    switch (col.variant) {
      case "badge":
        return (
          <span className="bg-gray-100 group-hover:bg-lpu-maroon group-hover:text-white px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap">
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
          <span className="text-sm font-medium text-lpu-maroon/80 tracking-tighter line-clamp-1">
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
          <span className="text-lpu-red font-semibold whitespace-nowrap">
            {new Date(value).toLocaleDateString()}
          </span>
        ) : (
          <span className="bg-green-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap">
            Active
          </span>
        );
      case "statusText":
        return (
          <span className="font-semibold text-gray-700 whitespace-nowrap">
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
          <select
            className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-lpu-maroon focus:border-lpu-maroon transition-all cursor-pointer"
            value={value || ""}
            onChange={(e) => col.onChange && col.onChange(row, e.target.value)}
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
        );
      case "action":
        const isPrimary = col.isPrimary ? col.isPrimary(row) : true;
        return (
          <button
            type="button"
            onClick={() => col.onClick && col.onClick(row)}
            className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors shadow-sm whitespace-nowrap ${
              isPrimary
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {col.getLabel ? col.getLabel(row) : "Action"}
          </button>
        );
      default:
        return (
          <span className="text-sm text-gray-700 line-clamp-1">
            {value || "-"}
          </span>
        );
    }
  };

  // 2. Auto-Layout
  const getColumnWidthClass = (variant) => {
    switch (variant) {
      case "badge":
        return "w-20 md:w-28";
      case "date":
      case "status":
      case "statusText":
      case "highlight":
      case "action":
        return "w-24 md:w-32";
      case "select":
        return "w-32 md:w-48";
      case "title":
        return "w-1/4 md:w-1/5";
      case "subtitle":
        return "w-1/3 md:w-1/4";
      default:
        return "w-24";
    }
  };

  return (
    // Outer Container: Enables horizontal scrolling on mobile, hides it on desktop
    <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm overflow-x-auto md:overflow-x-hidden">
      {/* Inner flex container to enforce a minimum width so mobile doesn't crush the table */}
      <div className="min-w-200 md:min-w-full flex flex-col">
        {/* HEADER TABLE (No Scrollbar) */}
        <div className="w-full bg-lpu-maroon text-white rounded-t-xl pr-1 md:pr-2">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              {columns.map((col, index) => (
                <col key={index} className={getColumnWidthClass(col.variant)} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((col, index) => (
                  <th
                    key={index}
                    className={`px-3 py-4 md:px-4 font-bold uppercase text-[11px] tracking-widest truncate ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* BODY TABLE (Vertical Scrollbar ONLY applies here) */}
        <div className="w-full max-h-150 overflow-y-auto overflow-x-hidden rounded-b-xl pb-2">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              {columns.map((col, index) => (
                <col key={index} className={getColumnWidthClass(col.variant)} />
              ))}
            </colgroup>
            <tbody className="divide-y divide-gray-100">
              {data.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  onClick={() => onRowClick && onRowClick(row)}
                  tabIndex={onRowClick ? 0 : -1}
                  style={{ animationDelay: `${rowIndex * 30}ms` }}
                  className={`group transition-colors duration-200 animate-in fade-in slide-in-from-left-4 ${onRowClick ? "cursor-pointer hover:bg-lpu-gold/5" : "hover:bg-gray-50"}`}
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-3 py-4 md:px-4 align-middle overflow-hidden ${col.align === "right" ? "text-right" : "text-left"}`}
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
      </div>
    </div>
  );
}
