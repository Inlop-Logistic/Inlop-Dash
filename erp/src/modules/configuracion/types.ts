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
  /**
   * Fase 11A — valores elegidos para operadores de selección múltiple (hoy
   * solo "en", usado por el filtro "Cliente"). Vacío o ausente = "Todos",
   * sin restricción — mismo criterio que un reporte creado antes de esta
   * fase, que nunca tuvo esta propiedad.
   */
  valores?:     string[] | null;
}

/**
 * Un filtro con `id` local para las keys de React.
 * Se serializa a FiltroDB (sin `id`) al persistir.
 */
export interface FiltroItem extends FiltroDB {
  /** UUID local — solo para React keys, nunca se envía a la DB. */
  id: string;
}

/**
 * Una columna del reporte tal como se persiste en la columna JSONB `columnas`
 * de la DB. `campo` es la clave técnica estable del catálogo (nunca cambia
 * por acción del usuario); `titulo` es el nombre visible que el usuario
 * puede personalizar; `orden` es la posición (0-based) en el reporte.
 */
export interface ColumnaReporte {
  campo:  string;
  titulo: string;
  orden:  number;
}

/**
 * Los destinatarios del reporte, tal como se persisten en la columna JSONB
 * `destinatarios` de la DB. Nunca una cadena de correos concatenada:
 *   - personal_ids     → referencias a personal.id (tabla `personal`, el
 *     maestro real de personal de INLOP — ver SQL_04_personal.sql).
 *   - correos_externos → correos externos agregados manualmente, validados.
 */
export interface DestinatariosReporte {
  personal_ids:      string[];
  correos_externos:  string[];
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
  /** Columnas del reporte, en el orden definido por el usuario. [] = todas. */
  columnas:           ColumnaReporte[];
  /** Configuración estructurada de recurrencia (horas, días, rango). */
  recurrencia:        RecurrenciaReporte;
  /** Destinatarios del reporte (Personal INLOP + correos externos). */
  destinatarios:      DestinatariosReporte;
  /**
   * Fase 10D — solo tiene efecto en reportes de modulo_id="gestion_logistica".
   * Si es true, cada ejecución (manual o por scheduler) genera un enlace
   * temporal de Seguimiento GPS externo para los destinatarios externos de
   * ESA ejecución, con las placas realmente incluidas en ella.
   */
  seguimiento_gps:    boolean;
  proxima_ejecucion:  string | null;
  created_at:         string;
  updated_at:         string;
  created_by:         string | null;
  updated_by:         string | null;
}

/**
 * Aviso no bloqueante (Fase 11D.1): true cuando, al guardar/activar, la
 * recurrencia sí tenía un slot programado para HOY pero su hora ya pasó —
 * `proxima_ejecucion` en la respuesta ya salta al día siguiente. NUNCA
 * indica que algo se ejecutó ni se usa para decidir ejecución — solo para
 * mostrar el mensaje informativo en la UI. Ausente/false en cualquier
 * guardado que no haya recalculado la recurrencia (ej. editar solo
 * destinatarios sin pasar por la etapa Frecuencia).
 */
export interface AvisoProgramacion {
  slotDeHoyVencido?: boolean;
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
  /** Espejo de recurrencia.tipo — columna simple usada por el listado. */
  frecuencia:   "diaria" | "semanal" | "mensual";
  filtros?:     FiltroDB[];
  /** Columnas del reporte, en el orden definido por el usuario. Omitido = todas. */
  columnas?:    ColumnaReporte[];
  /** Configuración estructurada de recurrencia. Omitido = sin configurar. */
  recurrencia?: RecurrenciaReporte;
  /** Destinatarios del reporte. Omitido = sin configurar. */
  destinatarios?: DestinatariosReporte;
  /** Fase 10D — solo aplica cuando modulo_id="gestion_logistica". Omitido = false. */
  seguimiento_gps?: boolean;
}

/**
 * Una persona del Personal INLOP, proyectada desde `personal` — el maestro
 * real de personal de INLOP (independiente de Auth, base futura de Talento
 * Humano — ver SQL_04_personal.sql) por el endpoint GET /api/personal.
 * Nunca hardcodeada ni inventada. `email` viene de personal.correo_compartido
 * — puede repetirse entre varias personas de una misma área (dato real).
 */
export interface PersonalInlop {
  id:     string;
  nombre: string;
  cargo:  string;
  email:  string;
}

/**
 * Resultado de una ejecución manual de reporte (Fase 9E,
 * POST /api/reportes-automaticos/:id/enviar). El backend siempre responde
 * con `ok: true` en HTTP 200 — cualquier rechazo (reporte inexistente,
 * borrador, inactivo, sin destinatarios, falla de generación o de envío)
 * llega como HTTP no-2xx y `req()` lo convierte en una excepción, así que
 * este tipo describe únicamente la forma del caso exitoso.
 */
export interface ResultadoEnvioManual {
  ok:       true;
  reporteId: string;
  nombre:    string;
  formato:   string;
  filename:  string;
  destinatarios: {
    totalPersonal: number;
    totalExternos: number;
    totalEnviados: number;
  };
  /** Fase 10D — true si esta ejecución generó un enlace de Seguimiento GPS. */
  seguimientoGps?: boolean;
}

/**
 * Una opción del selector "Cliente" del filtro (Fase 11A,
 * GET /api/reportes-automaticos/clientes). `value` es la clave normalizada
 * (lo que realmente se persiste en filtros[].valores y se compara en el
 * Filter Engine); `label` es el nombre real más corto encontrado para esa
 * clave, para mostrar al usuario — nunca la clave normalizada en mayúsculas.
 */
export interface ClienteFiltroOpcion {
  value: string;
  label: string;
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
  { id: "frecuencia",    numero: 4, label: "Frecuencia"            },
  { id: "destinatarios", numero: 5, label: "Destinatarios"         },
  { id: "revision",      numero: 6, label: "Revisión y activación" },
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
  /** Fase 10D — solo se muestra/aplica cuando modulo_id="gestion_logistica". */
  seguimiento_gps: boolean;
}

export const DATOS_INFO_BASICA_INICIAL: DatosInfoBasica = {
  nombre:       "",
  modulo_id:    MODULOS[0].value,
  tipo_reporte: TIPOS_REPORTE[0].value,
  asunto:       "",
  cuerpo:       "",
  formato:      "excel",
  activo:       true,
  seguimiento_gps: false,
};

// ─── Etapa 04 · Frecuencia — recurrencia estructurada ────────────────────────
//
// Diseñada para que un scheduler futuro pueda calcular la próxima ejecución
// sin reinterpretar texto libre: tipo de frecuencia, una o varias horas de
// disparo, los días/día que aplican según el tipo, y un rango de repetición
// con una única modalidad de finalización activa a la vez (discriminada por
// `fin.modo`).

export type TipoFrecuencia = "diaria" | "semanal" | "mensual";

/** Días de la semana — value = JS Date#getDay() (0 = domingo … 6 = sábado). */
export const DIAS_SEMANA = [
  { value: 1, label: "Lunes"     },
  { value: 2, label: "Martes"    },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves"    },
  { value: 5, label: "Viernes"   },
  { value: 6, label: "Sábado"    },
  { value: 0, label: "Domingo"   },
] as const;

/**
 * Modalidad de finalización del rango de repetición — mutuamente excluyentes
 * por construcción (discriminated union, no flags booleanos independientes).
 */
export type FinRecurrencia =
  | { modo: "nunca" }
  | { modo: "fecha"; fecha: string }            // YYYY-MM-DD
  | { modo: "repeticiones"; cantidad: number };  // >= 1

export interface RecurrenciaReporte {
  tipo: TipoFrecuencia;
  /** Horas de ejecución del día, "HH:mm" (24h). Al menos una. */
  horas: string[];
  /** Solo aplica cuando tipo === "semanal". */
  dias_semana?: number[];
  /** Solo aplica cuando tipo === "mensual". 1-31. */
  dia_mes?: number;
  /** Fecha de inicio del rango de repetición, YYYY-MM-DD. Obligatoria. */
  fecha_inicio: string;
  fin: FinRecurrencia;
}

/** Fecha de hoy en formato YYYY-MM-DD (zona horaria local del navegador). */
function hoyISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Recurrencia por defecto al abrir la etapa por primera vez. */
export function crearRecurrenciaInicial(): RecurrenciaReporte {
  return {
    tipo:         "diaria",
    horas:        ["08:00"],
    fecha_inicio: hoyISO(),
    fin:          { modo: "nunca" },
  };
}

/**
 * Al cambiar `tipo`, conserva horas/fecha_inicio/fin (compatibles con
 * cualquier frecuencia) y descarta dias_semana/dia_mes si ya no corresponden
 * al nuevo tipo — nunca deja campos huérfanos de una frecuencia anterior.
 */
export function cambiarTipoFrecuencia(
  r: RecurrenciaReporte,
  nuevoTipo: TipoFrecuencia
): RecurrenciaReporte {
  const { dias_semana: _ds, dia_mes: _dm, ...resto } = r;
  const base: RecurrenciaReporte = { ...resto, tipo: nuevoTipo };
  if (nuevoTipo === "semanal") return { ...base, dias_semana: r.dias_semana ?? [] };
  if (nuevoTipo === "mensual") return { ...base, dia_mes: r.dia_mes };
  return base;
}

/** Devuelve true si la etapa de Frecuencia cumple los requisitos mínimos. */
export function etapaFrecuenciaCompleta(r: RecurrenciaReporte): boolean {
  if (!r.fecha_inicio.trim())        return false;
  if (r.horas.length === 0)          return false;
  if (r.horas.some(h => !h.trim()))  return false;
  if (r.tipo === "semanal" && (r.dias_semana?.length ?? 0) === 0) return false;
  if (r.tipo === "mensual" && !r.dia_mes)                          return false;
  if (r.fin.modo === "fecha"        && !r.fin.fecha.trim())        return false;
  if (r.fin.modo === "repeticiones" && !(r.fin.cantidad >= 1))      return false;
  return true;
}

// ─── Etapa 05 · Destinatarios ─────────────────────────────────────────────────

/** Destinatarios vacíos al abrir la etapa por primera vez. */
export function crearDestinatariosInicial(): DestinatariosReporte {
  return { personal_ids: [], correos_externos: [] };
}

/** Devuelve true si hay al menos un destinatario (personal o externo). */
export function etapaDestinatariosCompleta(d: DestinatariosReporte): boolean {
  return d.personal_ids.length > 0 || d.correos_externos.length > 0;
}

/** Estado agregado del configurador (todas las etapas). */
export interface DatosConfigurador {
  infoBasica: DatosInfoBasica;
  /** Etapa 02 — condiciones de filtrado; array vacío = sin filtros. */
  filtros: FiltroItem[];
  /**
   * Etapa 03 — columnas del reporte: campo + título visible + orden.
   * [] = todas las columnas del reporte en el orden del catálogo
   * (comportamiento por omisión del generador).
   */
  columnas: ColumnaReporte[];
  /** Etapa 04 — periodicidad de ejecución del reporte. */
  frecuencia: RecurrenciaReporte;
  /** Etapa 05 — destinatarios del reporte. Requiere al menos uno para activar. */
  destinatarios: DestinatariosReporte;
}

/** Devuelve true si la etapa de Información básica cumple los requisitos mínimos. */
export function etapaInfoBasicaCompleta(d: DatosInfoBasica): boolean {
  return Boolean(d.nombre.trim() && d.asunto.trim());
}

// ─── Edición completa (Fase 9I) ───────────────────────────────────────────────

/** UUID local para las keys de React de un FiltroItem — nunca se persiste. */
function idLocal(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Proyecta un ReporteAutomatico ya persistido al estado del configurador
 * (DatosConfigurador) para precargar el mismo wizard de 6 etapas usado al
 * crear — "Editar configuración completa" nunca abre un formulario nuevo,
 * solo reutiliza ConfiguradorReporte con este estado inicial en vez del que
 * arma datosInicial() al crear.
 *
 * `recurrencia`/`destinatarios` pueden llegar vacíos ({}) en un reporte que
 * quedó como borrador antes de completar esas etapas — en ese caso se cae a
 * los mismos valores por defecto que usa el flujo de creación
 * (crearRecurrenciaInicial/crearDestinatariosInicial), nunca a un objeto
 * inválido para las etapas 04/05.
 */
export function datosConfiguradorDesdeReporte(r: ReporteAutomatico): DatosConfigurador {
  return {
    infoBasica: {
      nombre:       r.nombre,
      modulo_id:    r.modulo_id,
      tipo_reporte: r.tipo_reporte,
      asunto:       r.asunto ?? "",
      cuerpo:       r.cuerpo ?? "",
      formato:      r.formato,
      activo:       r.activo,
      seguimiento_gps: r.seguimiento_gps ?? false,
    },
    filtros:       (r.filtros ?? []).map(f => ({ ...f, id: idLocal() })),
    columnas:      r.columnas ?? [],
    frecuencia:    r.recurrencia?.tipo ? r.recurrencia : crearRecurrenciaInicial(),
    destinatarios: r.destinatarios ?? crearDestinatariosInicial(),
  };
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

// ─── Tipos de Configuración → Parámetros → Usuarios / Roles y Permisos ───────
// Sprint 3D-4 — UI de solo lectura sobre las APIs RBAC de Sprint 3D-3
// (GET /api/usuarios, /api/roles, /api/permisos, /api/me/permisos).
// Los campos aquí son un espejo literal de la respuesta de esos endpoints —
// ver index.js para la fuente de verdad exacta de cada uno.

/** Referencia mínima a un rol, tal como se embebe en usuarios y permisos. */
export interface RolRbacRef {
  id:     string;
  nombre: string;
}

/**
 * Fila de GET /api/usuarios. `rol` es el campo legacy de `profiles.rol`
 * (texto libre, aún no migrado) — se expone solo como contexto para la
 * futura migración; NUNCA se usa para derivar permisos en la UI. La fuente
 * de verdad de qué puede hacer un usuario es exclusivamente `roles_rbac`
 * (y, en el backend, el motor de services/rbac/).
 */
export interface UsuarioRbac {
  id:         string;
  nombre:     string;
  email:      string;
  rol:        string;
  activo:     boolean;
  created_at: string;
  roles_rbac: RolRbacRef[];
}

/** Fila de GET /api/roles. */
export interface RolRbac {
  id:                 string;
  nombre:             string;
  descripcion:        string;
  es_sistema:         boolean;
  activo:             boolean;
  usuarios_asignados: number;
}

/** Fila de GET /api/permisos. */
export interface PermisoRbac {
  id:          string;
  nombre:      string;
  modulo:      string;
  descripcion: string;
  roles:       RolRbacRef[];
}

/** Respuesta de GET /api/me/permisos. */
export interface MisPermisos {
  esMaster: boolean;
  permisos: string[];
}

// ─── Edición de roles RBAC de un usuario (Sprint 3D-7.4) ─────────────────────
// PUT /api/usuarios/:id/roles (backend, Sprint 3D-7.2). `rol_ids` es el
// conjunto COMPLETO deseado, no un delta — reenviar el mismo conjunto no
// escribe nada (idempotente, ver index.js).

/** Respuesta de PUT /api/usuarios/:id/roles — roles_rbac ya actualizado. */
export interface ActualizarRolesUsuarioResponse {
  id:         string;
  roles_rbac: RolRbacRef[];
}

// ─── Edición de permisos de un rol RBAC (Sprint 3D-7.5) ──────────────────────
// PUT /api/roles/:id/permisos (backend, Sprint 3D-7.3). `permiso_ids` es el
// conjunto COMPLETO deseado, no un delta — reenviar el mismo conjunto no
// escribe nada (idempotente, ver index.js).

/** Un permiso tal como lo embebe la respuesta de PUT /api/roles/:id/permisos
 *  — mismos 4 campos que PermisoRbac, sin `roles` (ese endpoint responde por
 *  rol, no por permiso). */
export interface PermisoRolRef {
  id:          string;
  nombre:      string;
  modulo:      string;
  descripcion: string;
}

/** Respuesta de PUT /api/roles/:id/permisos — permisos ya actualizados del rol. */
export interface ActualizarPermisosRolResponse {
  id:       string;
  permisos: PermisoRolRef[];
}
