// ─── Tipos de Configuración → Parámetros → Reportes Automáticos ──────────────
import { CATALOGO_REPORTES } from "./catalogos/datasetsReportes";

// ─── Filtros ──────────────────────────────────────────────────────────────────

/**
 * Un filtro tal como se persiste en la columna JSONB `filtros` de la DB.
 * Sin `id` local de React.
 */
export interface FiltroDB {
  campo:        string;
  operador:     string;
  valor?:       string | null;
  valor_desde?: string | null;
  valor_hasta?: string | null;
}

/**
 * Un filtro con `id` local para las keys de React.
 * Se serializa a FiltroDB (sin `id`) al persistir.
 */
export interface FiltroItem extends FiltroDB {
  /** UUID local — solo para React keys, nunca se envía a la DB. */
  id: string;
}

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
  borrador:           boolean;
  filtros:            FiltroDB[];
  /** Columnas seleccionadas, en el orden definido por el usuario. [] = todas. */
  columnas:           string[];
  proxima_ejecucion:  string | null;
  created_at:         string;
  updated_at:         string;
  created_by:         string | null;
  updated_by:         string | null;
}

/** Campos para crear o editar un reporte. */
export interface ReporteBase {
  nombre:       string;
  modulo_id:    string;
  tipo_reporte: string;
  asunto:       string | null;
  cuerpo:       string | null;
  formato:      "excel" | "html_filas" | "html_columnas";
  activo:       boolean;
  borrador?:    boolean;
  /** frecuencia: preservada en DB; no expuesta en Información básica (Fase futura). */
  frecuencia:   "diaria" | "semanal" | "mensual";
  filtros?:     FiltroDB[];
  /** Columnas seleccionadas, en el orden definido por el usuario. Omitido = todas. */
  columnas?:    string[];
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

// MODULOS y TIPOS_REPORTE se derivan de CATALOGO_REPORTES (ver
// ./catalogos/datasetsReportes.ts) — esa es la fuente única de verdad para
// la relación Módulo → Reporte → Campos. Este archivo NO declara la
// relación por su cuenta; solo la proyecta al formato que usan los
// selectores de Información básica.
//
// Claves de máquina estables. Si el label visible cambia, solo cambia en el
// catálogo central; los registros almacenados en DB usan modulo_id /
// tipo_reporte y no se rompen.
//
// Para agregar un módulo o un reporte: editar CATALOGO_REPORTES.
// Este archivo y el wizard no requieren cambios.

export const MODULOS = CATALOGO_REPORTES.map(m => ({
  value: m.id,
  label: m.label,
}));

export type Modulo = string;

export const TIPOS_REPORTE = CATALOGO_REPORTES.flatMap(modulo =>
  modulo.reportes.map(reporte => ({
    value:    reporte.id,
    moduloId: modulo.id,
    label:    reporte.label,
  }))
);

export type TipoReporte = string;

export const FORMATOS = [
  { value: "excel",         label: "Excel"           },
  { value: "html_filas",    label: "HTML — Filas"    },
  { value: "html_columnas", label: "HTML — Columnas" },
] as const;

export type Formato = (typeof FORMATOS)[number]["value"];

export const FRECUENCIAS = [
  { value: "diaria",  label: "Diaria"  },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
] as const;

export type Frecuencia = (typeof FRECUENCIAS)[number]["value"];

// ─── Configurador de reportes (wizard multi-etapa) ───────────────────────────

export type EtapaId =
  | "info-basica"
  | "filtros"
  | "columnas"
  | "ordenamiento"
  | "frecuencia"
  | "destinatarios"
  | "revision";

export interface EtapaConfig {
  id:     EtapaId;
  numero: number;
  label:  string;
}

export const ETAPAS: EtapaConfig[] = [
  { id: "info-basica",   numero: 1, label: "Información básica"    },
  { id: "filtros",       numero: 2, label: "Filtros"               },
  { id: "columnas",      numero: 3, label: "Columnas"              },
  { id: "ordenamiento",  numero: 4, label: "Ordenamiento"          },
  { id: "frecuencia",    numero: 5, label: "Frecuencia"            },
  { id: "destinatarios", numero: 6, label: "Destinatarios"         },
  { id: "revision",      numero: 7, label: "Revisión y activación" },
];

/** Estado de los campos de la etapa 01 — Información básica */
export interface DatosInfoBasica {
  nombre:       string;
  modulo_id:    Modulo;
  tipo_reporte: string;
  asunto:       string;
  cuerpo:       string;
  formato:      Formato;
  activo:       boolean;
}

export const DATOS_INFO_BASICA_INICIAL: DatosInfoBasica = {
  nombre:       "",
  modulo_id:    MODULOS[0].value,
  tipo_reporte: TIPOS_REPORTE[0].value,
  asunto:       "",
  cuerpo:       "",
  formato:      "excel",
  activo:       true,
};

/** Estado agregado del configurador (todas las etapas). */
export interface DatosConfigurador {
  infoBasica: DatosInfoBasica;
  /** Etapa 02 — condiciones de filtrado; array vacío = sin filtros. */
  filtros: FiltroItem[];
  /**
   * Etapa 03 — columnas seleccionadas, en el orden definido por el usuario.
   * Array de campo.key estables del catálogo. [] = todas las columnas del
   * reporte en el orden del catálogo (comportamiento por omisión del generador).
   */
  columnas: string[];
  // Etapas 04-06 se agregarán aquí al desarrollarse cada una.
}

/** Devuelve true si la etapa de Información básica cumple los requisitos mínimos. */
export function etapaInfoBasicaCompleta(d: DatosInfoBasica): boolean {
  return Boolean(d.nombre.trim() && d.asunto.trim());
}

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
