import { ArrowRight } from "lucide-react";
import { fmtDDMMYYYYHm } from "@/utils/date";
import { parseFechaDMY } from "@/utils/parseFecha";
import type { Column } from "@/components/ui";
import type { ViajeResumen } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { estadoVisual } from "../constants";

/** DD/MM/YYYY HH:mm desde string TMS en formato DD/MM/YYYY HH:MM:SS. */
function fmtSchedulate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = parseFechaDMY(raw);
  if (!d) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const COLUMNS: Column<ViajeResumen>[] = [
  {
    key: "fecha_detectado",
    header: "Creado",
    width: "130px",
    render: (v) => (
      <div className="text-[12px] tabular-nums leading-tight" style={{ color: "var(--gray-700)" }}>
        {fmtDDMMYYYYHm(v.fecha_detectado)}
      </div>
    ),
  },
  {
    key: "schedulate_origin",
    header: "Programado",
    width: "130px",
    render: (v) => (
      <div className="text-[12px] tabular-nums leading-tight" style={{ color: "var(--gray-700)" }}>
        {fmtSchedulate(v.schedulate_origin)}
      </div>
    ),
  },
  {
    key: "trip_number",
    header: "Viaje",
    width: "110px",
    render: (v) => (
      <span className="text-[12px] font-mono" style={{ color: "var(--navy)" }}>
        {v.trip_number}
      </span>
    ),
  },
  {
    key: "license_plate",
    header: "Placa",
    width: "90px",
    render: (v) => (
      <span
        className="text-[13px] font-bold tracking-widest font-mono"
        style={{ color: v.license_plate ? "var(--navy)" : "var(--gray-300)" }}
      >
        {v.license_plate ?? "—"}
      </span>
    ),
  },
  {
    key: "tipo_servicio",
    header: "Tipo de Servicio",
    width: "120px",
    render: (v) => (
      <span
        className="text-[12px]"
        style={{ color: v.type_operation ? "var(--gray-700)" : "var(--gray-300)" }}
      >
        {v.type_operation ?? "—"}
      </span>
    ),
  },
  {
    key: "cliente",
    header: "Cliente",
    render: (v) => (
      <div
        className="text-[13px] font-medium truncate max-w-[180px]"
        style={{ color: v.nombre_cliente ? "var(--gray-800)" : "var(--gray-300)" }}
        title={v.nombre_cliente ?? undefined}
      >
        {v.nombre_cliente ?? "—"}
      </div>
    ),
  },
  {
    key: "ruta",
    header: "Origen - Destino",
    render: (v) => (
      <div className="flex items-center gap-1 text-[12px]" style={{ color: "var(--gray-600)" }}>
        <span className="font-medium">{v.city_origin ?? "—"}</span>
        <ArrowRight className="w-3 h-3 shrink-0" style={{ color: "var(--gray-300)" }} />
        <span>{v.city_destination ?? "—"}</span>
      </div>
    ),
  },
  {
    key: "driver_name",
    header: "Conductor",
    width: "140px",
    render: (v) => (
      <div
        className="text-[13px] truncate max-w-[130px]"
        style={{ color: v.driver_name ? "var(--gray-700)" : "var(--gray-300)" }}
        title={v.driver_name ?? undefined}
      >
        {v.driver_name ?? "—"}
      </div>
    ),
  },
  {
    key: "conductor_tel",
    header: "Teléfono",
    width: "120px",
    render: (v) => (
      <span
        className="text-[12px] font-mono"
        style={{ color: v.conductor_tel ? "var(--gray-700)" : "var(--gray-300)" }}
      >
        {v.conductor_tel ?? "—"}
      </span>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    width: "130px",
    render: (v) => <EstadoBadge estado={estadoVisual(v)} />,
  },
];
