import { ChevronRight, AlertTriangle } from "lucide-react";
import type { Column } from "@/components/ui";
import type { TmsViaje } from "../types";
import { VIAJES_COLUMNS_DEF } from "../viajes.definition";
import { EstadoBadge } from "./EstadoBadge";
import { GpsStatus } from "./GpsStatus";
import { parseFechaTMS } from "@/utils/parseFecha";
import { extraerFechaColombia } from "@/utils/date";
import { esPanico } from "../constants";

// Estilos base unificados para texto de celdas
const TX_NORMAL  = { color: "var(--gray-700)" } as const;
const TX_DIM     = { color: "var(--gray-400)" } as const;

/** Razón social del Maestro, con fallback al primer nombre TMS. */
function clienteDisplay(v: TmsViaje): string {
  if (v.razon_social) return v.razon_social;
  if (!v.company_customer_name) return "—";
  return v.company_customer_name.split(",")[0].trim() || "—";
}

/** Mapa de key → renderer para las columnas definidas en VIAJES_COLUMNS_DEF. */
const RENDERERS: Record<string, (v: TmsViaje) => React.ReactNode> = {

  // ── Fecha ─── solo fecha, sin hora ───────────────────────────────────────────
  activated_on: (v) => {
    if (!v.activated_on) return <span style={TX_DIM}>—</span>;
    const d = parseFechaTMS(v.activated_on, "MDY");
    if (!d) return <span style={TX_DIM}>—</span>;
    const [Y, M, D] = extraerFechaColombia(d).split("-");
    return (
      <span className="text-[12px] font-mono tabular-nums" style={TX_NORMAL}>
        {D}/{M}/{Y.slice(2)}
      </span>
    );
  },

  // ── Manifiesto ─── semibold, sin color azul ───────────────────────────────────
  trip_number: (v) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] font-semibold font-mono tabular-nums" style={TX_NORMAL}>
        {v.trip_number}
      </span>
      {esPanico(v) && (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#EF4444" }} />
      )}
    </div>
  ),

  // ── Cliente ───────────────────────────────────────────────────────────────────
  company_customer_name: (v) => {
    const nombre = clienteDisplay(v);
    return (
      <span
        className="text-[12px] block truncate"
        style={{ ...TX_NORMAL, maxWidth: 152 }}
        title={nombre !== "—" ? nombre : undefined}
      >
        {nombre}
      </span>
    );
  },

  // ── Operación ─────────────────────────────────────────────────────────────────
  type_operation: (v) => {
    const texto = v.type_operation === "Granel Liquido" ? "Carga Líquida" : (v.type_operation ?? "—");
    return (
      <span className="text-[12px]" style={{ color: "var(--gray-600)" }}>
        {texto}
      </span>
    );
  },

  // ── Tipo ─── texto plano, sin badge ──────────────────────────────────────────
  _tipo: (v) => {
    const urbano = !!(v.origin_city_name && v.origin_city_name === v.destiny_city_name);
    return (
      <span className="text-[12px]" style={{ color: "var(--gray-600)" }}>
        {urbano ? "Urbano" : "Nacional"}
      </span>
    );
  },

  // ── Origen ────────────────────────────────────────────────────────────────────
  origin_city_name: (v) => (
    <span
      className="text-[12px] truncate block"
      style={{ ...(v.origin_city_name ? TX_NORMAL : TX_DIM), maxWidth: 104 }}
      title={v.origin_city_name ?? undefined}
    >
      {v.origin_city_name ?? "—"}
    </span>
  ),

  // ── Destino ───────────────────────────────────────────────────────────────────
  destiny_city_name: (v) => (
    <span
      className="text-[12px] truncate block"
      style={{ ...(v.destiny_city_name ? TX_NORMAL : TX_DIM), maxWidth: 104 }}
      title={v.destiny_city_name ?? undefined}
    >
      {v.destiny_city_name ?? "—"}
    </span>
  ),

  // ── Placa ─── semibold, sin badge ────────────────────────────────────────────
  license_plate: (v) => v.license_plate ? (
    <span
      className="text-[12px] font-semibold font-mono tracking-widest"
      style={TX_NORMAL}
    >
      {v.license_plate}
    </span>
  ) : <span style={TX_DIM}>—</span>,

  // ── Conductor ─────────────────────────────────────────────────────────────────
  driver_name: (v) => (
    <span
      className="text-[12px] truncate block"
      style={{ ...(v.driver_name ? TX_NORMAL : TX_DIM), maxWidth: 132 }}
      title={v.driver_name ?? undefined}
    >
      {v.driver_name ?? "Sin asignar"}
    </span>
  ),

  // ── Teléfono ──────────────────────────────────────────────────────────────────
  driver_phone: (v) => (
    <span
      className="text-[12px] font-mono"
      style={v.driver_phone ? TX_NORMAL : TX_DIM}
    >
      {v.driver_phone ?? "—"}
    </span>
  ),

  // ── Estado ─── badge semántico + GPS (sin cambios) ────────────────────────────
  state_travel: (v) => (
    <div className="flex flex-col items-start gap-1">
      <EstadoBadge estado={v.state_travel} />
      <div className="flex items-center gap-1">
        <span className="text-[10px]" style={{ color: "var(--gray-400)" }}>GPS</span>
        <GpsStatus report={v.latest_gps_report} compact />
      </div>
    </div>
  ),

  // ── Flecha del drawer ─────────────────────────────────────────────────────────
  _actions: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
};

/** Columnas construidas a partir de la definición — listas para DataTable<TmsViaje>. */
export const COLUMNS: Column<TmsViaje>[] = VIAJES_COLUMNS_DEF.map((def) => ({
  key:    def.key,
  header: def.header,
  width:  def.width,
  align:  def.align,
  render: RENDERERS[def.key] ?? (() => null),
}));
