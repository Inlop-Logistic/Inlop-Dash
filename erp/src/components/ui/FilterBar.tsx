import { Search, Trash2 } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";

export interface SelectFilter {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
  minWidth?: number;
  /** Permite ocultar un select cuando su lista de opciones aún no está disponible. */
  show?: boolean;
}

interface FilterBarProps {
  // Búsqueda de texto libre
  busqueda?: string;
  onBusqueda?: (v: string) => void;
  searchPlaceholder?: string;

  // Selector de rango de fechas
  fechaDesde?: string;
  fechaHasta?: string;
  onFechaRango?: (desde: string, hasta: string) => void;

  // Selects adicionales configurados por el módulo (estado, cliente, línea de negocio…)
  selects?: SelectFilter[];

  // Botón Limpiar
  hayFiltros?: boolean;
  onLimpiar?: () => void;
}

const INPUT_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: 10,
  padding:      "8px 12px",
  color:        "var(--gray-700)",
  background:   "#fff",
};

export function FilterBar({
  busqueda,
  onBusqueda,
  searchPlaceholder = "Buscar…",
  fechaDesde,
  fechaHasta,
  onFechaRango,
  selects,
  hayFiltros,
  onLimpiar,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">

      {/* Búsqueda */}
      {onBusqueda !== undefined && (
        <div className="flex-1 min-w-[220px] relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "var(--gray-400)" }}
          />
          <input
            type="text"
            value={busqueda ?? ""}
            aria-label={searchPlaceholder}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full text-[13px] outline-none"
            style={{ ...INPUT_STYLE, padding: "8px 12px 8px 36px" }}
          />
        </div>
      )}

      {/* Selects configurables: estado, cliente, línea de negocio, etc. */}
      {selects?.map((s, i) =>
        s.show === false ? null : (
          <select
            key={i}
            value={s.value}
            onChange={(e) => s.onChange(e.target.value)}
            aria-label={s.ariaLabel}
            className="text-[13px] outline-none"
            style={{ ...INPUT_STYLE, minWidth: s.minWidth ?? 160 }}
          >
            <option value="">{s.placeholder}</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )
      )}

      {/* Selector de rango de fechas */}
      {onFechaRango !== undefined && (
        <DateRangePicker
          desde={fechaDesde ?? ""}
          hasta={fechaHasta ?? ""}
          onChange={onFechaRango}
        />
      )}

      {/* Limpiar filtros */}
      {onLimpiar !== undefined && (
        <button
          type="button"
          onClick={onLimpiar}
          disabled={!hayFiltros}
          aria-label="Limpiar todos los filtros"
          title="Limpiar filtros"
          className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-colors"
          style={{
            border:     `1.5px solid ${hayFiltros ? "var(--inlop-red)" : "var(--gray-100)"}`,
            color:      hayFiltros ? "var(--inlop-red)"  : "var(--gray-300)",
            background: hayFiltros ? "#FFF1F2"           : "var(--gray-50)",
            cursor:     hayFiltros ? "pointer"           : "not-allowed",
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpiar
        </button>
      )}
    </div>
  );
}
