// ─── Tipos de Configuración → Parámetros → Reportes Automáticos ──────────────

export interface ReporteAutomatico {
  id:                 string;
  nombre:             string;
  tipo_reporte:       string;
  frecuencia:         "diaria" | "semanal" | "mensual";
  activo:             boolean;
  proxima_ejecucion:  string | null;
  created_at:         string;
  updated_at:         string;
  created_by:         string | null;
  updated_by:         string | null;
}

/** Campos requeridos para crear o editar un reporte. */
export interface ReporteBase {
  nombre:       string;
  tipo_reporte: string;
  frecuencia:   "diaria" | "semanal" | "mensual";
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

export const TIPOS_REPORTE = [
  { value: "viajes_activos", label: "Viajes Activos" },
] as const;

export type TipoReporte = (typeof TIPOS_REPORTE)[number]["value"];

export const FRECUENCIAS = [
  { value: "diaria",  label: "Diaria"  },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
] as const;

export type Frecuencia = (typeof FRECUENCIAS)[number]["value"];

// ─── Helpers de presentación ──────────────────────────────────────────────────

export function labelTipoReporte(valor: string): string {
  return TIPOS_REPORTE.find(t => t.value === valor)?.label ?? valor;
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
