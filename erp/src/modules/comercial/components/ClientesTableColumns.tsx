import type { Column } from "@/components/ui";
import { Badge } from "@/components/ui";
import type { ClienteListItem } from "../types";
import {
  ESTADO_CLIENTE_CFG,
  CLASIFICACION_ABC_CFG,
  TIPO_CLIENTE_CFG,
} from "../constants";

export const COLUMNS: Column<ClienteListItem>[] = [
  {
    key: "codigo_cliente",
    header: "Código",
    width: "110px",
    render: (c) => (
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--navy)",
          letterSpacing: "0.04em",
        }}
      >
        {c.codigo_cliente ?? "—"}
      </span>
    ),
  },
  {
    key: "razon_social",
    header: "Razón Social",
    render: (c) => (
      <div>
        <div className="font-semibold" style={{ color: "var(--gray-900)", fontSize: "var(--text-md)" }}>
          {c.razon_social}
        </div>
        {c.nombre_comercial && c.nombre_comercial !== c.razon_social && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)" }}>
            {c.nombre_comercial}
          </div>
        )}
        {c.etiquetas.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {c.etiquetas.slice(0, 2).map(e => {
              const TAG_CFG: Record<string, { color: string; bg: string }> = {
                estrategico:       { color: "#5B21B6", bg: "#EDE9FE" },
                cuenta_clave:      { color: "#1D4ED8", bg: "#DBEAFE" },
                vip:               { color: "#B45309", bg: "#FEF3C7" },
                proyecto_especial: { color: "#065F46", bg: "#D1FAE5" },
                alto_riesgo:       { color: "#9F1239", bg: "#FFE4E6" },
                exclusivo:         { color: "#6D28D9", bg: "#EDE9FE" },
                prospecto:         { color: "#374151", bg: "#F3F4F6" },
              };
              const cfg = TAG_CFG[e] ?? { color: "var(--gray-600)", bg: "var(--gray-100)" };
              return (
                <span
                  key={e}
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: "8px",
                    background: cfg.bg,
                    color: cfg.color,
                  }}
                >
                  {e.replace(/_/g, " ")}
                </span>
              );
            })}
          </div>
        )}
      </div>
    ),
  },
  {
    key: "nit",
    header: "NIT",
    width: "130px",
    render: (c) => (
      <span style={{ fontFamily: "monospace", fontSize: "var(--text-sm)", color: "var(--gray-600)" }}>
        {c.nit ? (c.dv ? `${c.nit}-${c.dv}` : c.nit) : "—"}
      </span>
    ),
  },
  {
    key: "ciudad_principal",
    header: "Ciudad",
    width: "130px",
    render: (c) => (
      <span style={{ fontSize: "var(--text-md)", color: "var(--gray-600)" }}>
        {c.ciudad_principal ?? "—"}
      </span>
    ),
  },
  {
    key: "tipo_cliente",
    header: "Tipo Cliente",
    width: "150px",
    render: (c) => (
      <span style={{ fontSize: "var(--text-sm)", color: "var(--gray-600)" }}>
        {c.tipo_cliente ? TIPO_CLIENTE_CFG[c.tipo_cliente] : "—"}
      </span>
    ),
  },
  {
    key: "ejecutivo_comercial",
    header: "Ejecutivo",
    width: "160px",
    render: (c) => (
      <span style={{ fontSize: "var(--text-md)", color: "var(--gray-600)" }}>
        {c.ejecutivo_comercial ?? "—"}
      </span>
    ),
  },
  {
    key: "clasificacion_abc",
    header: "ABC",
    width: "70px",
    render: (c) => {
      if (!c.clasificacion_abc) {
        return <span style={{ color: "var(--gray-300)", fontSize: "var(--text-sm)" }}>—</span>;
      }
      const cfg = CLASIFICACION_ABC_CFG[c.clasificacion_abc];
      return (
        <span
          style={{
            fontWeight: 700,
            fontSize: "11px",
            padding: "2px 10px",
            borderRadius: "10px",
            background: cfg.bg,
            color: cfg.color,
            display: "inline-block",
          }}
        >
          {c.clasificacion_abc}
        </span>
      );
    },
  },
  {
    key: "estado",
    header: "Estado",
    width: "120px",
    render: (c) => {
      const cfg = ESTADO_CLIENTE_CFG[c.estado];
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
  {
    key: "alertas_count",
    header: "Alertas",
    width: "80px",
    render: (c) => {
      if (!c.alertas_count) return <span style={{ color: "var(--gray-200)" }}>—</span>;
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 700,
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "10px",
            background: "#FEF3C7",
            color: "#92400E",
          }}
        >
          ⚠ {c.alertas_count}
        </span>
      );
    },
  },
];
