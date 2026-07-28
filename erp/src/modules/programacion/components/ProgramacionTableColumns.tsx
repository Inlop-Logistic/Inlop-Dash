import { fmtDDMMYYYY, extraerFechaColombia } from "@/utils/date";
import { parseFechaTMS } from "@/utils/parseFecha";
import type { Column } from "@/components/ui";
import type { ViajeResumen } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { estadoVisual } from "../constants";

const TZ_COL = "America/Bogota";

/** Extrae fecha DD/MM/YYYY y hora HH:mm de un string TMS DD/MM/YYYY HH:MM:SS, en hora Colombia. */
function splitSchedulate(raw: string | null | undefined): { fecha: string; hora: string } {
  if (!raw) return { fecha: "—", hora: "" };
  const d = parseFechaTMS(raw, "DMY");
  if (!d) return { fecha: "—", hora: "" };
  const [Y, M, D] = extraerFechaColombia(d).split("-");
  const hora = d.toLocaleTimeString("en-US", { timeZone: TZ_COL, hour: "2-digit", minute: "2-digit", hour12: false });
  return { fecha: `${D}/${M}/${Y}`, hora };
}

/** Transforma type_operation en etiqueta de Línea de Negocio. */
function lineaNegocio(raw: string | null | undefined): string {
  if (!raw) return "Carga Seca";
  return raw.trim().toLowerCase() === "granel liquido" ? "Carga Líquida" : "Carga Seca";
}

export const COLUMNS: Column<ViajeResumen>[] = [
  {
    key: "fecha_detectado",
    header: "Creado",
    width: "96px",
    render: (v) => (
      <div className="text-[12px] tabular-nums" style={{ color: "var(--gray-600)" }}>
        {fmtDDMMYYYY(v.fecha_detectado)}
      </div>
    ),
  },
  {
    key: "schedulate_origin",
    header: "Programado",
    width: "110px",
    render: (v) => {
      const { fecha, hora } = splitSchedulate(v.schedulate_origin);
      return (
        <div className="tabular-nums leading-none">
          <div className="text-[11px]" style={{ color: "var(--gray-500)" }}>{fecha}</div>
          {hora && (
            <div className="text-[14px] font-bold mt-0.5" style={{ color: "var(--navy)" }}>{hora}</div>
          )}
        </div>
      );
    },
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
    width: "88px",
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
    header: "Tipo Servicio",
    width: "110px",
    render: (v) => (
      <span
        className="text-[11px] font-semibold tracking-wide uppercase"
        style={{ color: v.tipo_servicio ? "var(--gray-700)" : "var(--gray-300)" }}
      >
        {v.tipo_servicio ?? "—"}
      </span>
    ),
  },
  {
    key: "linea_negocio",
    header: "Línea Negocio",
    width: "120px",
    render: (v) => (
      <span className="text-[12px]" style={{ color: "var(--gray-700)" }}>
        {lineaNegocio(v.type_operation)}
      </span>
    ),
  },
  {
    key: "cliente",
    header: "Cliente",
    render: (v) => (
      <div
        className="text-[13px] font-medium truncate max-w-[160px]"
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
      <div
        className="text-[12px] truncate"
        style={{ color: v.city_origin ? "var(--gray-700)" : "var(--gray-300)" }}
        title={v.city_origin ?? undefined}
      >
        {v.city_origin ?? "—"}
      </div>
    ),
  },
  {
    key: "city_destination",
    header: "Destino",
    width: "110px",
    render: (v) => (
      <div
        className="text-[12px] truncate"
        style={{ color: v.city_destination ? "var(--gray-700)" : "var(--gray-300)" }}
        title={v.city_destination ?? undefined}
      >
        {v.city_destination ?? "—"}
      </div>
    ),
  },
  {
    key: "driver_name",
    header: "Conductor",
    width: "130px",
    render: (v) => (
      <div
        className="text-[12px] truncate"
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
    width: "120px",
    render: (v) => <EstadoBadge estado={estadoVisual(v)} />,
  },
];
