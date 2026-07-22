import { ChevronRight, AlertTriangle } from "lucide-react";
import type { Column } from "@/components/ui";
import type { TmsViaje } from "../types";
import { VIAJES_COLUMNS_DEF } from "../viajes.definition";
import { EstadoBadge } from "./EstadoBadge";
import { GpsStatus } from "./GpsStatus";
import { parseFechaDMY } from "@/utils/parseFecha";
import { esPanico } from "../constants";

const LOCALE = "es-CO";

function fmtActivado(str: string | null | undefined): string {
  if (!str) return "—";
  const d = parseFechaDMY(str);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Razón social del Maestro, con fallback al primer nombre TMS. */
function clienteDisplay(v: TmsViaje): string {
  if (v.razon_social) return v.razon_social;
  if (!v.company_customer_name) return "—";
  return v.company_customer_name.split(",")[0].trim() || "—";
}

/** Mapa de key → renderer para las columnas definidas en VIAJES_COLUMNS_DEF. */
const RENDERERS: Record<string, (v: TmsViaje) => React.ReactNode> = {
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
        style={{ color: "var(--gray-700)", maxWidth: 172 }}
        title={nombre !== "—" ? nombre : undefined}
      >
        {nombre}
      </span>
    );
  },

  license_plate: (v) => v.license_plate ? (
    <span
      className="text-[11px] font-bold font-mono tracking-widest px-1.5 py-0.5 rounded"
      style={{ background: "var(--gray-100)", color: "var(--navy)", border: "1px solid var(--gray-200)" }}
    >
      {v.license_plate}
    </span>
  ) : <span style={{ color: "var(--gray-300)" }}>—</span>,

  driver_name: (v) => (
    <span className="text-[13px] truncate block" style={{ color: v.driver_name ? "var(--gray-700)" : "var(--gray-300)", maxWidth: 152 }}>
      {v.driver_name ?? "Sin asignar"}
    </span>
  ),

  _ruta: (v) => (
    <div className="flex flex-col leading-snug">
      <span className="text-[12px]" style={{ color: "var(--gray-700)" }}>{v.origin_city_name ?? "—"}</span>
      <span className="text-[10px]" style={{ color: "var(--gray-300)" }}>↓</span>
      <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>{v.destiny_city_name ?? "—"}</span>
    </div>
  ),

  state_travel: (v) => <EstadoBadge estado={v.state_travel} />,

  latest_gps_report: (v) => <GpsStatus report={v.latest_gps_report} compact />,

  activated_on: (v) => (
    <span className="text-[11px] font-mono" style={{ color: "var(--gray-400)" }}>
      {fmtActivado(v.activated_on)}
    </span>
  ),

  _actions: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
};

/** Columnas construidas a partir de la definición — listas para DataTable<TmsViaje>. */
export const COLUMNS: Column<TmsViaje>[] = VIAJES_COLUMNS_DEF.map((def) => ({
  key:    def.key,
  header: def.header,
  width:  def.width,
  render: RENDERERS[def.key] ?? (() => null),
}));
