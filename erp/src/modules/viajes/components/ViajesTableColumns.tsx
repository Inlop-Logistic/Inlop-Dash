import { ChevronRight, AlertTriangle } from "lucide-react";
import type { Column } from "@/components/ui";
import type { TmsViaje } from "../types";
import { VIAJES_COLUMNS_DEF } from "../viajes.definition";
import { EstadoBadge } from "./EstadoBadge";
import { GpsStatus } from "./GpsStatus";
import { parseFechaTMS } from "@/utils/parseFecha";
import { extraerFechaColombia } from "@/utils/date";
import { toTitleCase } from "@/utils/text";
import { lineaNegocio } from "@/utils/lineaNegocio";
import { esPanico } from "../constants";

// ── Paleta de texto unificada ────────────────────────────────────────────────
const TX  = { color: "var(--gray-700)" } as const;   // texto principal
const DIM = { color: "var(--gray-400)" } as const;   // placeholder / sin dato

// ── Helpers de presentación ──────────────────────────────────────────────────

/**
 * Nombre del cliente para la tabla.
 * Prioriza razón social del Maestro; cae a company_customer_name del TMS.
 * Aplica toTitleCase en ambos casos para normalizar mayúsculas y siglas.
 */
function clienteLabel(v: TmsViaje): string {
  const raw = v.razon_social
    ?? (v.company_customer_name ? v.company_customer_name.split(",")[0].trim() : null);
  return toTitleCase(raw);
}

/**
 * Celda de texto única línea con ellipsis y tooltip.
 *
 * maxW: ancho máximo visible en px — usar col_width - 8 como referencia.
 * Esto evita que el span desborde cuando table-layout:auto asigna espacio extra.
 */
function TxCell({
  value, dim = false, maxW, mono = false, semibold = false, upper = false,
}: {
  value: string; dim?: boolean; maxW?: number;
  mono?: boolean; semibold?: boolean; upper?: boolean;
}) {
  const display = upper ? value.toUpperCase() : value;
  const isDash  = value === "—";
  return (
    <span
      className={[
        "text-[12px] block truncate leading-none",
        mono     ? "font-mono tabular-nums" : "",
        semibold ? "font-semibold" : "",
      ].join(" ")}
      style={{ ...(dim || isDash ? DIM : TX), maxWidth: maxW }}
      title={!isDash ? display : undefined}
    >
      {display}
    </span>
  );
}

// ── Renderers por columna ────────────────────────────────────────────────────
// maxW = col_width - 8  (respira sin cortar texto legible)

const RENDERERS: Record<string, (v: TmsViaje) => React.ReactNode> = {

  // ── Fecha ─── solo DD/MM/AA, sin hora ────────────────────────────────────
  // col: 80px
  activated_on: (v) => {
    if (!v.activated_on) return <span style={DIM}>—</span>;
    const d = parseFechaTMS(v.activated_on, "MDY");
    if (!d) return <span style={DIM}>—</span>;
    const [Y, M, D] = extraerFechaColombia(d).split("-");
    return (
      <span className="text-[12px] font-mono tabular-nums leading-none" style={TX}>
        {D}/{M}/{Y.slice(2)}
      </span>
    );
  },

  // ── Manifiesto ─── MAYÚSCULAS + semibold, col: 100px ─────────────────────
  trip_number: (v) => (
    <div className="flex items-center gap-1.5">
      <TxCell value={v.trip_number} mono semibold upper />
      {esPanico(v) && (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#EF4444" }} />
      )}
    </div>
  ),

  // ── Cliente ─── Title Case + tooltip, col: 164px → maxW 156 ──────────────
  company_customer_name: (v) => (
    <TxCell value={clienteLabel(v)} maxW={156} />
  ),

  // ── Operación ─── col: 128px — "Carga Líquida" cabe en una línea ──────────
  // type_operation === "Granel Liquido" → Carga Líquida; cualquier otro → Carga Seca
  type_operation: (v) => (
    <span className="text-[12px] leading-none" style={TX}>
      {lineaNegocio(v.type_operation)}
    </span>
  ),

  // ── Tipo ─── texto plano, col: 88px — "Nacional" cabe centrado ───────────
  _tipo: (v) => {
    const urbano = !!(v.origin_city_name && v.origin_city_name === v.destiny_city_name);
    return (
      <span className="text-[12px] leading-none" style={TX}>
        {urbano ? "Urbano" : "Nacional"}
      </span>
    );
  },

  // ── Origen ─── Title Case + tooltip, col: 104px → maxW 96 ────────────────
  origin_city_name: (v) => (
    <TxCell
      value={toTitleCase(v.origin_city_name)}
      dim={!v.origin_city_name}
      maxW={96}
    />
  ),

  // ── Destino ─── Title Case + tooltip, col: 104px → maxW 96 ───────────────
  destiny_city_name: (v) => (
    <TxCell
      value={toTitleCase(v.destiny_city_name)}
      dim={!v.destiny_city_name}
      maxW={96}
    />
  ),

  // ── Placa ─── MAYÚSCULAS + semibold, col: 84px ───────────────────────────
  license_plate: (v) => v.license_plate
    ? <TxCell value={v.license_plate} mono semibold upper />
    : <span style={DIM}>—</span>,

  // ── Conductor ─── Title Case + tooltip, col: 140px → maxW 132 ────────────
  driver_name: (v) => (
    <TxCell
      value={v.driver_name ? toTitleCase(v.driver_name) : "Sin asignar"}
      dim={!v.driver_name}
      maxW={132}
    />
  ),

  // ── Teléfono ─── col: 104px ───────────────────────────────────────────────
  driver_phone: (v) => (
    <span
      className="text-[12px] font-mono leading-none"
      style={v.driver_phone ? TX : DIM}
    >
      {v.driver_phone ?? "—"}
    </span>
  ),

  // ── Estado ─── badge semántico + GPS hace X min ───────────────────────────
  state_travel: (v) => (
    <div className="flex flex-col items-start gap-1">
      <EstadoBadge estado={v.state_travel} />
      <div className="flex items-center gap-1">
        <span className="text-[10px]" style={{ color: "var(--gray-400)" }}>GPS</span>
        <GpsStatus report={v.latest_gps_report} compact />
      </div>
    </div>
  ),

  // ── Flecha del drawer ─────────────────────────────────────────────────────
  _actions: () => (
    <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />
  ),
};

// ── Columnas finales ─────────────────────────────────────────────────────────

export const COLUMNS: Column<TmsViaje>[] = VIAJES_COLUMNS_DEF.map((def) => ({
  key:    def.key,
  header: def.header,
  width:  def.width,
  align:  def.align,
  render: RENDERERS[def.key] ?? (() => null),
}));
