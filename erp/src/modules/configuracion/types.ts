// ─── Tipos de Configuración → Parámetros → Reportes Automáticos ──────────────

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
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

// Claves de máquina estables. Si el label visible cambia, solo cambia aquí;
// los registros almacenados en DB usan modulo_id / tipo_reporte y no se rompen.
//
// Relación en el wizard de Información básica:
//   Módulo  → selector 1: agrupa los reportes por área funcional del ERP.
//   Reporte → selector 2: lista solo los tipo_reporte del módulo seleccionado.
//
// Clave estable  :  value del módulo  = "gestion_logistica"
// Label visible  :  "Gestión Logística"        (puede cambiar sin tocar la DB)
//
// Para agregar un nuevo módulo: añadir una entrada a MODULOS con una clave
// nueva y agregar los tipo_reporte correspondientes a TIPOS_REPORTE con
// moduloId apuntando a esa clave. Sin cambios estructurales.

export const MODULOS = [
  { value: "gestion_logistica", label: "Gestión Logística" },
  // Para agregar nuevas áreas funcionales:
  // { value: "administracion", label: "Administración" },
  // { value: "comercial",      label: "Comercial"      },
] as const;

export type Modulo = (typeof MODULOS)[number]["value"];

export const TIPOS_REPORTE = [
  { value: "viajes_activos", moduloId: "gestion_logistica", label: "Viajes Activos" },
  // Para agregar un nuevo reporte a Gestión Logística:
  // { value: "solicitudes_activas", moduloId: "gestion_logistica", label: "Solicitudes Activas" },
  // Para agregar un reporte de otro módulo:
  // { value: "facturacion_mensual", moduloId: "administracion",    label: "Facturación Mensual" },
] as const;

export type TipoReporte = (typeof TIPOS_REPORTE)[number]["value"];

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
  // Etapas 03-06 se agregarán aquí al desarrollarse cada una.
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
