import type { EstadoDocumental, DocumentoCheck, CumplidoRecord } from "./types";

export const REFRESH_INTERVAL_MS = 120_000;

/** Estados del TMS que indican que el viaje es cumplible. */
export const ESTADOS_CUMPLIBLES = new Set(["completado", "finalizado"]);

// ── Configuración visual de estados documentales ──────────────────────────────

export const ESTADO_DOC_CFG: Record<EstadoDocumental, {
  label: string; color: string; bg: string; dot: string;
}> = {
  pendiente:           { label: "Pendiente",           color: "#92400E", bg: "#FEF3C7", dot: "#D97706" },
  en_revision:         { label: "En revisión",         color: "#1D4ED8", bg: "#DBEAFE", dot: "#3B82F6" },
  con_observaciones:   { label: "Con observaciones",   color: "#7C3AED", bg: "#EDE9FE", dot: "#8B5CF6" },
  aprobado:            { label: "Aprobado",            color: "#065F46", bg: "#D1FAE5", dot: "#059669" },
  rechazado:           { label: "Rechazado",           color: "#9F1239", bg: "#FFE4E6", dot: "#DC2626" },
  listo_facturacion:   { label: "Listo para facturar", color: "#0F4C75", bg: "#DBEAFE", dot: "#1D4ED8" },
};

// ── Checklist documental base ─────────────────────────────────────────────────

/** Definición base de los documentos requeridos por expediente. */
export const DOCUMENTOS_BASE: Omit<DocumentoCheck, "presente">[] = [
  { id: "remision",        label: "Remisión",               requerido: true  },
  { id: "manifiesto",      label: "Manifiesto de carga",    requerido: true  },
  { id: "soporte_entrega", label: "Soporte de entrega",     requerido: true  },
  { id: "fotos",           label: "Registro fotográfico",   requerido: false },
  { id: "firma",           label: "Firma del receptor",     requerido: true  },
  { id: "novedades",       label: "Registro de novedades",  requerido: false },
  { id: "observaciones",   label: "Observaciones",          requerido: false },
];

// ── Tabs ──────────────────────────────────────────────────────────────────────

export const TABS = [
  { id: "todos",              label: "Todos"              },
  { id: "pendientes",         label: "Pendientes"         },
  { id: "enRevision",         label: "En revisión"        },
  { id: "conObservaciones",   label: "Con observaciones"  },
  { id: "validados",          label: "Validados"          },
  { id: "listosFacturacion",  label: "Listos p/facturar"  },
  { id: "rechazados",         label: "Rechazados"         },
] as const;

export type TabCumplidos = (typeof TABS)[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Conteo por tab para los badges. */
export function tabCount(data: CumplidoRecord[], tabId: string): number {
  if (tabId === "todos")             return data.length;
  if (tabId === "pendientes")        return data.filter(c => c.estado_documental === "pendiente").length;
  if (tabId === "enRevision")        return data.filter(c => c.estado_documental === "en_revision").length;
  if (tabId === "conObservaciones")  return data.filter(c => c.estado_documental === "con_observaciones").length;
  if (tabId === "validados")         return data.filter(c => c.estado_documental === "aprobado").length;
  if (tabId === "listosFacturacion") return data.filter(c => c.estado_documental === "listo_facturacion").length;
  if (tabId === "rechazados")        return data.filter(c => c.estado_documental === "rechazado").length;
  return 0;
}
