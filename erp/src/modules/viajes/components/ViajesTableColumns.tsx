import { ChevronRight, AlertTriangle } from "lucide-react";
import type { Column } from "@/components/ui";
import type { TmsViaje } from "../types";
import { VIAJES_COLUMNS_DEF } from "../viajes.definition";
import { EstadoBadge } from "./EstadoBadge";
import { GpsStatus } from "./GpsStatus";
import { parseFechaMDY } from "@/utils/parseFecha";
import { esPanico } from "../constants";

/** Razón social del Maestro, con fallback al primer nombre TMS. */
function clienteDisplay(v: TmsViaje): string {
  if (v.razon_social) return v.razon_social;
  if (!v.company_customer_name) return "—";
  return v.company_customer_name.split(",")[0].trim() || "—";
}

/** Mapa de key → renderer para las columnas definidas en VIAJES_COLUMNS_DEF. */
const RENDERERS: Record<string, (v: TmsViaje) => React.ReactNode> = {

  activated_on: (v) => {
    if (!v.activated_on) return <span style={{ color: "var(--gray-300)" }}>—</span>;
    const d = parseFechaMDY(v.activated_on);
    if (!d) return <span style={{ color: "var(--gray-300)" }}>—</span>;
    const dd  = String(d.getDate()).padStart(2, "0");
    const mm  = String(d.getMonth() + 1).padStart(2, "0");
    const yy  = String(d.getFullYear()).slice(2);
    const hh  = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[12px] font-mono tabular-nums" style={{ color: "var(--gray-700)" }}>
          {dd}/{mm}/{yy}
        </span>
        <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--gray-400)" }}>
          {hh}:{min}
        </span>
      </div>
    );
  },

  trip_number: (v) => (
    <div className="flex items-center gap-1">
      <span className="text-[13px] font-bold font-mono tabular-nums" style={{ color: "var(--navy)" }}>
        {v.trip_number}
      </span>
      {esPanico(v) && <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#EF4444" }} />}
    </div>
  ),

  company_customer_name: (v) => {
    const nombre = clienteDisplay(v);
    return (
      <span
        className="text-[13px] block truncate"
        style={{ color: "var(--gray-700)", maxWidth: 152 }}
        title={nombre !== "—" ? nombre : undefined}
      >
        {nombre}
      </span>
    );
  },

  type_operation: (v) => {
    const cargaLiquida = v.type_operation === "Granel Liquido";
    return (
      <span className="text-[12px]" style={{ color: "var(--gray-600)" }}>
        {cargaLiquida ? "Carga Líquida" : "Carga Seca"}
      </span>
    );
  },

  _tipo: (v) => {
    const urbano = !!(v.origin_city_name && v.origin_city_name === v.destiny_city_name);
    return (
      <span
        className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={
          urbano
            ? { background: "#EFF6FF", color: "#2563EB" }
            : { background: "var(--gray-100)", color: "var(--gray-500)" }
        }
      >
        {urbano ? "Urbano" : "Nacional"}
      </span>
    );
  },

  origin_city_name: (v) => (
    <span
      className="text-[12px] font-mono uppercase"
      style={{ color: v.origin_city_name ? "var(--gray-700)" : "var(--gray-300)" }}
    >
      {v.origin_city_name ?? "—"}
    </span>
  ),

  destiny_city_name: (v) => (
    <span
      className="text-[12px] font-mono uppercase"
      style={{ color: v.destiny_city_name ? "var(--gray-600)" : "var(--gray-300)" }}
    >
      {v.destiny_city_name ?? "—"}
    </span>
  ),

  license_plate: (v) => v.license_plate ? (
    <span
      className="text-[11px] font-bold font-mono tracking-widest px-1.5 py-0.5 rounded"
      style={{ background: "var(--gray-100)", color: "var(--navy)", border: "1px solid var(--gray-200)" }}
    >
      {v.license_plate}
    </span>
  ) : <span style={{ color: "var(--gray-300)" }}>—</span>,

  driver_name: (v) => (
    <span
      className="text-[13px] truncate block"
      style={{ color: v.driver_name ? "var(--gray-700)" : "var(--gray-300)", maxWidth: 132 }}
    >
      {v.driver_name ?? "Sin asignar"}
    </span>
  ),

  driver_phone: (v) => (
    <span className="text-[12px] font-mono" style={{ color: v.driver_phone ? "var(--gray-700)" : "var(--gray-300)" }}>
      {v.driver_phone ?? "—"}
    </span>
  ),

  state_travel: (v) => (
    <div className="flex flex-col gap-0.5">
      <EstadoBadge estado={v.state_travel} />
      <GpsStatus report={v.latest_gps_report} compact />
    </div>
  ),

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
