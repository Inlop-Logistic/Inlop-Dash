// ─── Tipos de Configuración → Parámetros → Reportes Automáticos ──────────────

export interface ReporteAutomatico {
  id:                 string;
  nombre:             string;
  modulo_id:          string;
  tipo_reporte:       string;
  asunto:             string | null;
  cuerpo:             string | null;
  formato:            "excel" | "html_filas" | "html_columnas";
  frecuencia:         "diaria" | "semanal" | "mensual";
  activo:             boolean;
  proxima_ejecucion:  string | null;
  created_at:         string;
  updated_at:         string;
  created_by:         string | null;
  updated_by:         string | null;
}

/** Campos para crear o editar un reporte (Información básica). */
export interface ReporteBase {
  nombre:       string;
  modulo_id:    string;
  tipo_reporte: string;
  asunto:       string | null;
  cuerpo:       string | null;
  formato:      "excel" | "html_filas" | "html_columnas";
  activo:       boolean;
  /** frecuencia no forma parte de Información básica (Fase futura). Conservada en DB. */
  frecuencia:   "diaria" | "semanal" | "mensual";
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

// Claves de máquina estables. Si el label cambia, solo cambia aquí —
// los registros almacenados en DB usan modulo_id/tipo_reporte y nunca se rompen.

export const MODULOS = [
  { value: "gestion_logistica", label: "Gestión Logística" },
] as const;

export type Modulo = (typeof MODULOS)[number]["value"];

export const TIPOS_REPORTE = [
  { value: "viajes_activos", moduloId: "gestion_logistica", label: "Viajes Activos" },
] as const;

export type TipoReporte = (typeof TIPOS_REPORTE)[number]["value"];

export const FORMATOS = [
  { value: "excel",          label: "Excel"           },
  { value: "html_filas",     label: "HTML — Filas"    },
  { value: "html_columnas",  label: "HTML — Columnas" },
] as const;

export type Formato = (typeof FORMATOS)[number]["value"];

export const FRECUENCIAS = [
  { value: "diaria",  label: "Diaria"  },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
] as const;

export type Frecuencia = (typeof FRECUENCIAS)[number]["value"];

// ─── Helpers de presentación ──────────────────────────────────────────────────

export function labelModulo(valor: string): string {
  return MODULOS.find(m => m.value === valor)?.label ?? valor;
}

export function labelTipoReporte(valor: string): string {
  return TIPOS_REPORTE.find(t => t.value === valor)?.label ?? valor;
}

export function labelFormato(valor: string): string {
  return FORMATOS.find(f => f.value === valor)?.label ?? valor;
}

export function labelFrecuencia(valor: string): string {
  return FRECUENCIAS.find(f => f.value === valor)?.label ?? valor;
}

export function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
