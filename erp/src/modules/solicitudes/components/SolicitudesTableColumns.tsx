import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { splitISO } from "@/utils/date";
import type { Column } from "@/components/ui";
import type { Solicitud } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { CanalBadge } from "./CanalBadge";

/**
 * Doble línea fecha + hora — mismo estilo visual que la columna Programado
 * del módulo Programación. Reutiliza splitISO en lugar de splitSchedulate
 * porque las fechas de solicitudes son ISO, no formato TMS DD/MM/YYYY HH:MM:SS.
 */
function renderFechaHora(iso: string | null): React.ReactNode {
  const { fecha, hora } = splitISO(iso);
  return (
    <div className="tabular-nums leading-none">
      <div className="text-[11px]" style={{ color: "var(--gray-500)" }}>{fecha}</div>
      {hora && hora !== "00:00" && (
        <div className="text-[14px] font-bold mt-0.5" style={{ color: "var(--navy)" }}>{hora}</div>
      )}
    </div>
  );
}

/** Celda de Remisión con botón copiar y confirmación discreta. */
function RemisionCell({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // no abrir el panel de detalle
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!value) {
    return <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>—</span>;
  }

  return (
    <div className="flex items-center justify-between gap-1 group relative">
      <span className="text-[12px] font-mono truncate" style={{ color: "var(--gray-700)" }}>
        {value}
      </span>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          title="Copiar remisión"
          className="flex items-center justify-center w-5 h-5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: copied ? "#059669" : "var(--gray-400)" }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        {copied && (
          <span
            className="absolute bottom-full right-0 mb-1.5 text-[10px] font-semibold px-2 py-1 rounded whitespace-nowrap"
            style={{ background: "var(--gray-800, #1f2937)", color: "#fff", zIndex: 20 }}
          >
            Remisión copiada
          </span>
        )}
      </div>
    </div>
  );
}

export const COLUMNS: Column<Solicitud>[] = [
  // ── Columnas fijas ─────────────────────────────────────────────────────────
  {
    key: "codigo_solicitud",
    header: "Solicitud",
    width: "112px",
    sticky: true,
    render: (s) => (
      <span className="text-[13px] font-bold font-mono" style={{ color: "var(--navy)" }}>
        {s.codigo_solicitud}
      </span>
    ),
  },
  {
    key: "external_ref",
    header: "Remisión",
    width: "140px",
    sticky: true,
    render: (s) => <RemisionCell value={s.external_ref} />,
  },

  // ── Columnas desplazables ──────────────────────────────────────────────────
  {
    key: "creado_en",
    header: "Fecha Solicitud",
    width: "100px",
    render: (s) => renderFechaHora(s.creado_en),
  },
  {
    key: "cliente",
    header: "Cliente",
    width: "140px",
    render: (s) => (
      <div
        className="text-[13px] font-medium truncate"
        style={{ color: "var(--gray-800)", maxWidth: 108 }}
        title={s.cliente}
      >
        {s.cliente}
      </div>
    ),
  },
  {
    key: "solicitante",
    header: "Solicitante",
    width: "110px",
    render: (s) => (
      <div
        className="text-[12px] truncate"
        style={{ color: s.solicitante ? "var(--gray-700)" : "var(--gray-300)", maxWidth: 78 }}
        title={s.solicitante ?? undefined}
      >
        {s.solicitante ?? "—"}
      </div>
    ),
  },
  {
    key: "canal",
    header: "Canal",
    width: "68px",
    render: (s) => <CanalBadge canal={s.canal} />,
  },
  {
    key: "agencia",
    header: "Ubicación",
    width: "110px",
    render: (s) => (
      <div
        className="text-[12px] truncate"
        style={{ color: s.agencia && s.agencia !== "—" ? "var(--gray-700)" : "var(--gray-300)", maxWidth: 78 }}
        title={s.agencia}
      >
        {s.agencia}
      </div>
    ),
  },
  {
    key: "tipo_operacion",
    header: "Tipo Servicio",
    width: "92px",
    render: (s) => (
      <span
        className="text-[11px] font-semibold tracking-wide uppercase"
        style={{ color: s.tipo_operacion ? "var(--gray-700)" : "var(--gray-300)" }}
      >
        {s.tipo_operacion === "urbana" ? "URBANO" : s.tipo_operacion === "nacional" ? "NACIONAL" : "—"}
      </span>
    ),
  },
  {
    key: "tipo_vehiculo",
    header: "Tipo Vehículo",
    width: "100px",
    render: (s) => (
      <div
        className="text-[12px] truncate"
        style={{ color: s.tipo_vehiculo ? "var(--gray-600)" : "var(--gray-300)", maxWidth: 68 }}
        title={s.tipo_vehiculo || undefined}
      >
        {s.tipo_vehiculo || "—"}
      </div>
    ),
  },
  {
    key: "origen",
    header: "Origen",
    width: "96px",
    render: (s) => (
      <div
        className="text-[12px] truncate"
        style={{ color: s.origen ? "var(--gray-700)" : "var(--gray-300)", maxWidth: 64 }}
        title={s.origen || undefined}
      >
        {s.origen || "—"}
      </div>
    ),
  },
  {
    key: "destino",
    header: "Destino",
    width: "96px",
    render: (s) => (
      <div
        className="text-[12px] truncate"
        style={{ color: s.destino ? "var(--gray-700)" : "var(--gray-300)", maxWidth: 64 }}
        title={s.destino || undefined}
      >
        {s.destino || "—"}
      </div>
    ),
  },
  {
    key: "fecha_requerida",
    header: "Cita Cargue",
    width: "100px",
    render: (s) => renderFechaHora(s.fecha_requerida),
  },
  {
    key: "estado",
    header: "Estado",
    width: "110px",
    render: (s) => <EstadoBadge estado={s.estado} />,
  },
  {
    key: "conductor_nombre",
    header: "Responsable",
    width: "100px",
    render: (_s) => (
      <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>—</span>
    ),
  },
];
