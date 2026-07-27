import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Column } from "@/components/ui";
import { CodeCell, DateTimeCell, RouteCell } from "@/components/ui";
import type { Solicitud } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { CanalBadge } from "./CanalBadge";

/**
 * Celda de Remisión con botón copiar absoluto — sin espacio reservado cuando
 * el botón no está visible. Usa var(--font-mono) = DM Mono (sin ceros tachados).
 */
function RemisionCell({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!value) {
    return <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>—</span>;
  }

  return (
    <div className="relative group min-w-0">
      <span
        className="text-[12px] block truncate"
        style={{ color: "var(--gray-700)", fontFamily: "var(--font-mono)" }}
      >
        {value.trim()}
      </span>

      {/* Botón absoluto — se superpone sobre el texto sin reservar espacio fijo */}
      <button
        type="button"
        onClick={handleCopy}
        title="Copiar remisión"
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: copied ? "#059669" : "var(--gray-400)" }}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>

      {copied && (
        <span
          className="absolute bottom-full right-0 mb-1.5 text-[10px] font-semibold px-2 py-1 rounded whitespace-nowrap pointer-events-none"
          style={{ background: "var(--gray-800, #1f2937)", color: "#fff", zIndex: 20 }}
        >
          ✓ Copiado
        </span>
      )}
    </div>
  );
}

export const COLUMNS: Column<Solicitud>[] = [
  // ── Columnas fijas ─────────────────────────────────────────────────────────
  {
    key:    "codigo_solicitud",
    header: "Solicitud",
    width:  "112px",
    sticky: true,
    render: (s) => <CodeCell value={s.codigo_solicitud} />,
  },
  {
    key:    "external_ref",
    header: "Remisión",
    width:  "140px",
    sticky: true,
    render: (s) => <RemisionCell value={s.external_ref} />,
  },

  // ── Columnas desplazables ──────────────────────────────────────────────────
  {
    key:    "creado_en",
    header: "Fecha Solicitud",
    width:  "100px",
    render: (s) => <DateTimeCell iso={s.creado_en} />,
  },
  {
    key:    "cliente",
    header: "Cliente",
    width:  "160px",
    render: (s) => (
      /* Una sola línea con truncado elegante y tooltip sobre el nombre completo */
      <div
        className="text-[13px] font-medium truncate"
        style={{ color: "var(--gray-800)" }}
        title={s.cliente}
      >
        {s.cliente}
      </div>
    ),
  },
  {
    key:    "canal",
    header: "Canal",
    width:  "68px",
    align:  "center",
    render: (s) => <CanalBadge canal={s.canal} />,
  },
  {
    key:    "agencia",
    header: "Ubicación",
    width:  "110px",
    render: (s) => (
      <div
        className="text-[12px] truncate"
        style={{ color: s.agencia && s.agencia !== "—" ? "var(--gray-700)" : "var(--gray-300)" }}
        title={s.agencia && s.agencia !== "—" ? s.agencia : undefined}
      >
        {s.agencia}
      </div>
    ),
  },
  {
    key:    "tipo_operacion",
    header: "Tipo Servicio",
    width:  "92px",
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
    key:    "ruta",
    header: "Ruta",
    width:  "200px",
    render: (s) => <RouteCell origin={s.origen} destination={s.destino} />,
  },
  {
    key:    "fecha_requerida",
    header: "Cita Cargue",
    width:  "100px",
    render: (s) => <DateTimeCell iso={s.fecha_requerida} />,
  },
  {
    key:    "estado",
    header: "Estado",
    width:  "120px",
    align:  "center",
    render: (s) => <EstadoBadge estado={s.estado} />,
  },
  {
    key:    "conductor_nombre",
    header: "Responsable",
    width:  "110px",
    render: (_s) => (
      <span className="text-[12px]" style={{ color: "var(--gray-400)" }}>
        Sin asignar
      </span>
    ),
  },
];
