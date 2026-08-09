import type { EstadoDocumental, CumplidoRecord, TipoDocumento } from "./types";

export const ESTADO_VIAJE_CFG = {
  pendiente:  { label: "Pendiente",  color: "#92400E", bg: "#FEF3C7", dot: "#D97706" },
  finalizado: { label: "Finalizado", color: "#065F46", bg: "#D1FAE5", dot: "#059669" },
} as const;

export function estadoViajeVisual(c: CumplidoRecord): "pendiente" | "finalizado" {
  return c.fecha_cumplido ? "finalizado" : "pendiente";
}

export const REFRESH_INTERVAL_MS = 120_000;

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

// ─── Soportes de Cumplido — tipos documentales ─────────────────────────────
// Única fuente de verdad en el frontend — refleja TIPOS_DOCUMENTO_CUMPLIDO en
// index.js. Antes existían dos listas desconectadas: DOCUMENTOS_BASE (backend,
// nunca persistida) y TIPOS_BASE (frontend, la que realmente nombraba
// archivos). El backend infiere el tipo a partir de la descripción que el
// usuario escribe al cargar; esta lista se usa aquí solo para mostrar el
// progreso ("3/5 requeridos").
export interface TipoDocumentoConfig {
  id:        TipoDocumento;
  label:     string;
  requerido: boolean;
}

export const TIPOS_DOCUMENTO_CUMPLIDO: TipoDocumentoConfig[] = [
  { id: "remesa",     label: "Remesa",                  requerido: true  },
  { id: "cumplido",   label: "Cumplido",                requerido: true  },
  { id: "manifiesto", label: "Manifiesto",              requerido: true  },
  { id: "evidencias", label: "Evidencias fotográficas", requerido: false },
  { id: "tiquete",    label: "Tiquete báscula",         requerido: false },
];

export const TIPO_DOCUMENTO_GUT: TipoDocumentoConfig = { id: "gut", label: "GUT", requerido: true };

export function tiposDocumentoParaViaje(typeOperation: string | null): TipoDocumentoConfig[] {
  const esGranel = (typeOperation ?? "").trim().toLowerCase() === "granel liquido";
  return esGranel ? [...TIPOS_DOCUMENTO_CUMPLIDO, TIPO_DOCUMENTO_GUT] : TIPOS_DOCUMENTO_CUMPLIDO;
}
