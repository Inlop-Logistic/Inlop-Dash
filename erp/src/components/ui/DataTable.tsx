import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left min-w-[640px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--gray-100)" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                style={{ color: "var(--gray-400)", width: col.width }}
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
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
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
