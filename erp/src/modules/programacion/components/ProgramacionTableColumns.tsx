import { ChevronRight } from "lucide-react";
import { fmtFecha } from "@/utils/date";
import { fmtTms } from "@/utils/parseFecha";
import type { Column } from "@/components/ui";
import type { ViajeResumen } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { estadoVisual } from "../constants";

export const COLUMNS: Column<ViajeResumen>[] = [
  {
    key: "fecha_detectado",
    header: "Fecha/Hora Despacho",
    width: "140px",
    render: (v) => (
      <div className="text-[12px] tabular-nums leading-tight" style={{ color: "var(--gray-700)" }}>
        {fmtFecha(v.fecha_detectado)}
      </div>
    ),
  },
  {
    key: "schedulate_origin",
    header: "Fecha/Hora Programación",
    width: "150px",
    render: (v) => (
      <div className="text-[12px] tabular-nums leading-tight" style={{ color: "var(--gray-700)" }}>
        {fmtTms(v.schedulate_origin, "DMY", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        })}
      </div>
    ),
  },
  {
    key: "linea_negocio",
    header: "Línea de Negocio",
    width: "100px",
    render: () => (
      <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>—</span>
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
    width: "110px",
    render: () => (
      <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>—</span>
    ),
  },
  {
    key: "tipologia_vehiculo",
    header: "Tipología de Vehículo",
    width: "130px",
    render: () => (
      <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>—</span>
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
    key: "city_origin",
    header: "Origen",
    width: "110px",
    render: (v) => (
      <span className="text-[12px]" style={{ color: v.city_origin ? "var(--gray-700)" : "var(--gray-300)" }}>
        {v.city_origin ?? "—"}
      </span>
    ),
  },
  {
    key: "city_destination",
    header: "Destino",
    width: "110px",
    render: (v) => (
      <span className="text-[12px]" style={{ color: v.city_destination ? "var(--gray-700)" : "var(--gray-300)" }}>
        {v.city_destination ?? "—"}
      </span>
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
    width: "110px",
    render: () => (
      <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>—</span>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    width: "130px",
    render: (v) => <EstadoBadge estado={estadoVisual(v)} />,
  },
  {
    key: "arrow",
    header: "",
    width: "28px",
    render: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
  },
];
