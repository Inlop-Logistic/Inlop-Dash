import type { CSSProperties, ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  /** Mantiene la columna fija durante el desplazamiento horizontal. */
  sticky?: boolean;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading = false,
  emptyMessage = "Sin resultados",
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="py-16 text-center text-[13px]" style={{ color: "var(--gray-400)" }}>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          Cargando…
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-[13px]" style={{ color: "var(--gray-400)" }}>
        {emptyMessage}
      </div>
    );
  }

  // Compute sticky left offsets: each sticky column's left = sum of preceding sticky column widths (border-box px).
  const stickyLeftMap = new Map<number, number>();
  const lastStickyIdx = columns.reduce((last, col, i) => (col.sticky ? i : last), -1);
  if (lastStickyIdx >= 0) {
    let cumLeft = 0;
    columns.forEach((col, i) => {
      if (col.sticky) {
        stickyLeftMap.set(i, cumLeft);
        cumLeft += parseInt(col.width ?? "0", 10);
      }
    });
  }

  function thStyle(col: Column<T>, i: number): CSSProperties {
    const base: CSSProperties = { color: "var(--gray-400)", width: col.width };
    if (!col.sticky) return base;
    return {
      ...base,
      position: "sticky",
      left: stickyLeftMap.get(i) ?? 0,
      zIndex: 3,
      background: "white",
      ...(i === lastStickyIdx ? { boxShadow: "2px 0 6px -2px rgba(0,0,0,0.08)" } : {}),
    };
  }

  function tdStyle(col: Column<T>, i: number): CSSProperties {
    if (!col.sticky) return {};
    return {
      position: "sticky",
      left: stickyLeftMap.get(i) ?? 0,
      zIndex: 2,
      background: "white",
      ...(i === lastStickyIdx ? { boxShadow: "2px 0 6px -2px rgba(0,0,0,0.08)" } : {}),
    };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left min-w-[640px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--gray-100)" }}>
            {columns.map((col, i) => (
              <th
                key={col.key}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                style={thStyle(col, i)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={`transition-colors ${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
              style={{ borderBottom: "1px solid var(--gray-100)" }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col, i) => (
                <td key={col.key} className="px-4 py-3" style={tdStyle(col, i)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
