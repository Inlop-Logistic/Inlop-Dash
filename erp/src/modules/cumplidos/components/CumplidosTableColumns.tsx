import { ChevronRight } from "lucide-react";
import type { Column } from "@/components/ui";
import type { CumplidoRecord } from "../types";
import { CUMPLIDOS_COLUMNS_DEF } from "../cumplidos.definition";
import { EstadoDocumental } from "./EstadoDocumental";
import { fmtTms } from "@/utils/parseFecha";

function clienteCorto(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.split(",")[0].trim().slice(0, 28) || "—";
}

function fmtFecha(str: string | null | undefined): string {
  return fmtTms(str, "DMY", {
    day: "2-digit", month: "short", year: "numeric",
    timeZone: "America/Bogota",
  });
}

const RENDERERS: Record<string, (c: CumplidoRecord) => React.ReactNode> = {
  trip_number: (c) => (
    <span className="text-[13px] font-bold font-mono tabular-nums" style={{ color: "var(--navy)" }}>
      {c.trip_number}
    </span>
  ),
  number_order: (c) => (
    <span className="text-[12px] font-mono" style={{ color: c.number_order ? "var(--gray-600)" : "var(--gray-300)" }}>
      {c.number_order ?? "—"}
    </span>
  ),
  company_customer_name: (c) => (
    <span className="text-[13px] truncate block" style={{ color: "var(--gray-700)" }}>
      {clienteCorto(c.company_customer_name)}
    </span>
  ),
  license_plate: (c) => c.license_plate ? (
    <span
      className="text-[11px] font-bold font-mono tracking-widest px-1.5 py-0.5 rounded"
      style={{ background: "var(--gray-100)", color: "var(--navy)", border: "1px solid var(--gray-200)" }}
    >
      {c.license_plate}
    </span>
  ) : <span style={{ color: "var(--gray-300)" }}>—</span>,
  driver_name: (c) => (
    <span className="text-[13px]" style={{ color: c.driver_name ? "var(--gray-700)" : "var(--gray-300)" }}>
      {c.driver_name ?? "Sin asignar"}
    </span>
  ),
  fecha_cumplido: (c) => (
    <span className="text-[11px] font-mono" style={{ color: "var(--gray-500)" }}>
      {fmtFecha(c.fecha_cumplido)}
    </span>
  ),
  estado_documental: (c) => <EstadoDocumental estado={c.estado_documental} />,
  observaciones: (c) => c.observaciones ? (
    <span
      className="text-[11px] truncate block max-w-[200px]"
      style={{ color: "var(--gray-500)" }}
      title={c.observaciones}
    >
      {c.observaciones}
    </span>
  ) : <span style={{ color: "var(--gray-300)", fontSize: 11 }}>—</span>,
  responsable: (c) => (
    <span className="text-[12px]" style={{ color: c.responsable ? "var(--gray-600)" : "var(--gray-300)" }}>
      {c.responsable ?? "—"}
    </span>
  ),
  _actions: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
};

export const COLUMNS: Column<CumplidoRecord>[] = CUMPLIDOS_COLUMNS_DEF.map((def) => ({
  key:    def.key,
  header: def.header,
  width:  def.width,
  render: RENDERERS[def.key] ?? (() => null),
}));

