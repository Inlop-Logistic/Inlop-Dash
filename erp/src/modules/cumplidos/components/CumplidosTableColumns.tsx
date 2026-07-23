import { parseFechaMDY } from "@/utils/parseFecha";
import type { Column } from "@/components/ui";
import type { CumplidoRecord } from "../types";
import { estadoViajeVisual, ESTADO_VIAJE_CFG } from "../constants";

/** Extrae fecha y hora de un string MM/DD/YYYY HH:MM:SS. */
function splitActivatedOn(raw: string | null | undefined): { fecha: string; hora: string } {
  if (!raw) return { fecha: "—", hora: "" };
  const d = parseFechaMDY(raw);
  if (!d) return { fecha: "—", hora: "" };
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    fecha: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`,
    hora:  `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

function lineaNegocio(raw: string | null | undefined): string {
  if (!raw) return "Carga Seca";
  return raw.trim().toLowerCase() === "granel liquido" ? "Carga Líquida" : "Carga Seca";
}

export const COLUMNS: Column<CumplidoRecord>[] = [
  {
    key: "activated_on",
    header: "Programado",
    width: "110px",
    render: (c) => {
      const { fecha, hora } = splitActivatedOn(c.activated_on);
      return (
        <div className="tabular-nums leading-none">
          <div className="text-[11px]" style={{ color: "var(--gray-500)" }}>{fecha}</div>
          {hora && hora !== "00:00" && (
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
    render: (c) => (
      <span className="text-[12px] font-mono" style={{ color: "var(--navy)" }}>
        {c.trip_number}
      </span>
    ),
  },
  {
    key: "license_plate",
    header: "Placa",
    width: "88px",
    render: (c) => (
      <span
        className="text-[13px] font-bold tracking-widest font-mono"
        style={{ color: c.license_plate ? "var(--navy)" : "var(--gray-300)" }}
      >
        {c.license_plate ?? "—"}
      </span>
    ),
  },
  {
    key: "tipo_servicio",
    header: "Tipo Servicio",
    width: "110px",
    render: (c) => {
      const o = (c.origin_city_name  ?? "").trim().toLowerCase();
      const d = (c.destiny_city_name ?? "").trim().toLowerCase();
      const tipo = o && d && o === d ? "URBANO" : o && d ? "NACIONAL" : null;
      return (
        <span
          className="text-[11px] font-semibold tracking-wide uppercase"
          style={{ color: tipo ? "var(--gray-700)" : "var(--gray-300)" }}
        >
          {tipo ?? "—"}
        </span>
      );
    },
  },
  {
    key: "linea_negocio",
    header: "Línea Negocio",
    width: "120px",
    render: (_c) => (
      <span className="text-[12px]" style={{ color: "var(--gray-700)" }}>
        {lineaNegocio(null)}
      </span>
    ),
  },
  {
    key: "company_customer_name",
    header: "Cliente",
    render: (c) => (
      <div
        className="text-[13px] font-medium truncate max-w-[160px]"
        style={{ color: c.company_customer_name ? "var(--gray-800)" : "var(--gray-300)" }}
        title={c.company_customer_name ?? undefined}
      >
        {c.company_customer_name ? c.company_customer_name.split(",")[0].trim() : "—"}
      </div>
    ),
  },
  {
    key: "origin_city_name",
    header: "Origen",
    width: "110px",
    render: (c) => (
      <div
        className="text-[12px] truncate"
        style={{ color: c.origin_city_name ? "var(--gray-700)" : "var(--gray-300)" }}
        title={c.origin_city_name ?? undefined}
      >
        {c.origin_city_name ?? "—"}
      </div>
    ),
  },
  {
    key: "destiny_city_name",
    header: "Destino",
    width: "110px",
    render: (c) => (
      <div
        className="text-[12px] truncate"
        style={{ color: c.destiny_city_name ? "var(--gray-700)" : "var(--gray-300)" }}
        title={c.destiny_city_name ?? undefined}
      >
        {c.destiny_city_name ?? "—"}
      </div>
    ),
  },
  {
    key: "driver_name",
    header: "Conductor",
    width: "130px",
    render: (c) => (
      <div
        className="text-[12px] truncate"
        style={{ color: c.driver_name ? "var(--gray-700)" : "var(--gray-300)" }}
        title={c.driver_name ?? undefined}
      >
        {c.driver_name ?? "—"}
      </div>
    ),
  },
  {
    key: "conductor_tel",
    header: "Teléfono",
    width: "110px",
    render: (c) => (
      <span
        className="text-[12px] font-mono"
        style={{ color: c.conductor_tel ? "var(--gray-700)" : "var(--gray-300)" }}
      >
        {c.conductor_tel ?? "—"}
      </span>
    ),
  },
  {
    key: "estado_viaje",
    header: "Estado",
    width: "120px",
    render: (c) => {
      const key = estadoViajeVisual(c);
      const cfg = ESTADO_VIAJE_CFG[key];
      return (
        <span
          className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-sm)] px-2.5 py-1 rounded-[var(--radius-full)]"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
          {cfg.label}
        </span>
      );
    },
  },
];
