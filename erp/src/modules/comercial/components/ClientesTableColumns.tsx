import type { Column } from "@/components/ui";
import { Badge } from "@/components/ui";
import type { ClienteListItem } from "../types";
import {
  ESTADO_CLIENTE_CFG,
  CLASIFICACION_ABC_CFG,
  ETIQUETA_CFG,
  NIVEL_ESTRATEGICO_CFG,
} from "../constants";

export const COLUMNS: Column<ClienteListItem>[] = [
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
              const cfg = ETIQUETA_CFG[e];
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
                  {cfg.label}
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
        {c.nit ?? "—"}
      </span>
    ),
  },
  {
    key: "ciudad_principal",
    header: "Ciudad",
    width: "140px",
    render: (c) => (
      <span style={{ fontSize: "var(--text-md)", color: "var(--gray-600)" }}>
        {c.ciudad_principal ?? "—"}
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
    key: "nivel_estrategico",
    header: "Nivel",
    width: "120px",
    render: (c) => {
      if (!c.nivel_estrategico) return <span style={{ color: "var(--gray-300)" }}>—</span>;
      const cfg = NIVEL_ESTRATEGICO_CFG[c.nivel_estrategico];
      return (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: "8px",
            background: cfg.bg,
            color: cfg.color,
          }}
        >
          {cfg.label}
        </span>
      );
    },
  },
  {
    key: "estado",
    header: "Estado",
    width: "110px",
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
      if (!c.alertas_count) return null;
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
