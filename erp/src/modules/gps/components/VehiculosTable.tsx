import { ChevronRight } from "lucide-react";
import { DataTable } from "@/components/ui";
import type { Column } from "@/components/ui";
import { gpsRelativo } from "@/utils/parseFecha";
import { EstadoGpsBadge } from "./EstadoGpsBadge";
import { GPS_COLUMNS_DEF } from "../gps.definition";
import type { GpsRecord } from "../types";

function clienteCorto(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.split(",")[0].trim().slice(0, 22) || "—";
}

const RENDERERS: Record<string, (v: GpsRecord) => React.ReactNode> = {
  license_plate: (v) => v.license_plate ? (
    <span
      className="text-[11px] font-bold font-mono tracking-widest px-1.5 py-0.5 rounded"
      style={{ background: "var(--gray-100)", color: "var(--navy)", border: "1px solid var(--gray-200)" }}
    >
      {v.license_plate}
    </span>
  ) : <span style={{ color: "var(--gray-300)", fontSize: 11 }}>—</span>,

  driver_name: (v) => (
    <span className="text-[13px] truncate block" style={{ color: v.driver_name ? "var(--gray-700)" : "var(--gray-300)" }}>
      {v.driver_name ?? "Sin asignar"}
    </span>
  ),

  company_customer_name: (v) => (
    <span className="text-[12px] truncate block" style={{ color: "var(--gray-600)" }}>
      {clienteCorto(v.company_customer_name)}
    </span>
  ),

  estadoGps: (v) => <EstadoGpsBadge estado={v.estadoGps} size="sm" />,

  latest_gps_report: (v) => {
    const { label, color } = gpsRelativo(v.latest_gps_report);
    return (
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>
        {label}
      </span>
    );
  },

  trip_number: (v) => (
    <span className="text-[11px] font-mono" style={{ color: "var(--navy)" }}>
      {v.trip_number}
    </span>
  ),

  _actions: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
};

const COLUMNS: Column<GpsRecord>[] = GPS_COLUMNS_DEF.map((def) => ({
  key:    def.key,
  header: def.header,
  width:  def.width,
  render: RENDERERS[def.key] ?? (() => null),
}));

interface VehiculosTableProps {
  vehiculos:  GpsRecord[];
  loading:    boolean;
  selectedId: string | null;
  onSelect:   (id: string) => void;
}

export function VehiculosTable({ vehiculos, loading, onSelect }: VehiculosTableProps) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={vehiculos}
      rowKey={(v) => v.id}
      onRowClick={(v) => onSelect(v.id)}
      loading={loading}
      emptyMessage="No hay vehículos para los filtros seleccionados."
    />
  );
}
