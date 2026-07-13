/**
 * Renderers de columna para la tabla de Viajes.
 *
 * Consume VIAJES_COLUMNS_DEF de viajes.definition.ts para mantener
 * la lista de columnas desacoplada de su presentación visual.
 * Cuando ARC llegue, este archivo se reemplaza por el View Engine
 * sin tocar el resto del módulo.
 */
import { ChevronRight, ArrowRight, AlertTriangle } from "lucide-react";
import type { Column } from "@/components/ui";
import type { TmsViaje } from "../types";
import { VIAJES_COLUMNS_DEF } from "../viajes.definition";
import { EstadoBadge } from "./EstadoBadge";
import { ProgressBar } from "./ProgressBar";
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

function clienteCorto(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.split(",")[0].trim().slice(0, 28) || "—";
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
  number_order: (v) => (
    <span className="text-[12px] font-mono" style={{ color: v.number_order ? "var(--gray-600)" : "var(--gray-300)" }}>
      {v.number_order ?? "—"}
    </span>
  ),
  company_customer_name: (v) => (
    <span className="text-[13px] truncate block" style={{ color: "var(--gray-700)" }}>
      {clienteCorto(v.company_customer_name)}
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
    <span className="text-[13px]" style={{ color: v.driver_name ? "var(--gray-700)" : "var(--gray-300)" }}>
      {v.driver_name ?? "Sin asignar"}
    </span>
  ),
  origin_city_name: (v) => (
    <span className="text-[12px]" style={{ color: "var(--gray-600)" }}>{v.origin_city_name ?? "—"}</span>
  ),
  destiny_city_name: (v) => (
    <div className="flex items-center gap-1 text-[12px]" style={{ color: "var(--gray-600)" }}>
      <ArrowRight className="w-3 h-3 shrink-0" style={{ color: "var(--gray-300)" }} />
      {v.destiny_city_name ?? "—"}
    </div>
  ),
  state_travel: (v) => <EstadoBadge estado={v.state_travel} />,
  percentage_travel: (v) => <ProgressBar value={v.percentage_travel} />,
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
