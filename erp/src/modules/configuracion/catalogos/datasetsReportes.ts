/**
 * CATALOGO_REPORTES — Definición central de Módulo → Reporte → Campos.
 *
 * Fuente única de verdad para el configurador de Reportes Automáticos. Las
 * etapas del wizard (Filtros hoy; Columnas y Ordenamiento más adelante) NO
 * declaran catálogos propios de campos — consumen esta definición a través
 * de adaptadores livianos (ver ../components/etapas/filtros/catalogoFiltros.ts).
 *
 * Jerarquía:
 *   Módulo   → área funcional del ERP que agrupa reportes
 *              (ej. "gestion_logistica" → Gestión Logística).
 *   Reporte  → tipo_reporte concreto dentro de un módulo
 *              (ej. "viajes_activos" → Viajes Activos).
 *   Campo    → dato disponible de ese reporte, con metadatos que controlan
 *              qué puede hacer el usuario con él: filtrar, mostrar como
 *              columna, ordenar.
 *
 * Reglas de diseño:
 *   - Claves técnicas estables: modulo.id, reporte.id y campo.key se
 *     persisten en Supabase (modulo_id, tipo_reporte, filtros[].campo).
 *     Los labels son solo de presentación — cambiarlos aquí no rompe datos
 *     ya guardados.
 *   - Sin introspección automática de columnas SQL: cada campo expuesto al
 *     usuario debe declararse explícitamente en este catálogo. Un campo que
 *     no está aquí no puede filtrarse, mostrarse ni ordenarse — es la
 *     barrera que evita exponer datos internos o irrelevantes.
 *   - Para agregar un módulo nuevo (ej. Gestión Comercial, Talento Humano):
 *     agregar una entrada a CATALOGO_REPORTES. El wizard no requiere cambios.
 *   - Para agregar un reporte a un módulo existente: agregar una entrada al
 *     array `reportes` de ese módulo.
 *   - Para agregar un campo a un reporte existente: agregar una entrada al
 *     array `campos` de ese reporte, con sus metadatos completos.
 */
import { ESTADO_CFG } from "@/modules/viajes/constants";

// ─── Tipos de campo ───────────────────────────────────────────────────────────

export type TipoDatoCampo = "texto" | "numero" | "fecha" | "booleano" | "enum";

export type OperadorId =
  | "es"
  | "no_es"
  | "tiene_valor"
  | "sin_valor"
  | "antes_de"
  | "despues_de"
  | "entre";

/** Qué tipo de control necesita el campo Valor para este operador. */
export type TipoValorControl =
  | "ninguno"      // operadores booleanos (tiene_valor / sin_valor) — sin input de valor
  | "select"       // elige de un catálogo de opciones (campo.opciones)
  | "date"         // un solo date input
  | "date_range";  // dos date inputs (desde / hasta)

export interface OperadorConfig {
  id:        OperadorId;
  label:     string;
  tipoValor: TipoValorControl;
}

export interface OpcionValor {
  value: string;
  label: string;
}

/**
 * Metadatos completos de un campo de dataset. Controla qué puede hacer el
 * usuario con él en cada etapa del wizard.
 */
export interface CampoDataset {
  /** Clave técnica estable — persiste en filtros[].campo, columnas[], orden. */
  key:    string;
  label:  string;
  tipo:   TipoDatoCampo;
  /** Origen legible del dato (trazabilidad/documentación, no se muestra al usuario). */
  origen: string;

  // ── Etapa 02 · Filtros ──
  filtrable:   boolean;
  /** Requerido cuando filtrable = true. */
  operadores?: OperadorConfig[];
  /** Requerido cuando tipo = "enum". */
  opciones?:   OpcionValor[];

  // ── Etapa 03 · Columnas (aún no desarrollada — metadato preparado) ──
  seleccionableColumna: boolean;

  // ── Etapa 04 · Ordenamiento (aún no desarrollada — metadato preparado) ──
  ordenable: boolean;
}

export interface ReporteDataset {
  /** Clave técnica estable — persiste como tipo_reporte. */
  id:     string;
  label:  string;
  campos: CampoDataset[];
}

export interface ModuloDataset {
  /** Clave técnica estable — persiste como modulo_id. */
  id:       string;
  label:    string;
  reportes: ReporteDataset[];
}

// ─── Operadores reutilizables ─────────────────────────────────────────────────

const OP_ES: OperadorConfig          = { id: "es",          label: "es",          tipoValor: "select"     };
const OP_NO_ES: OperadorConfig       = { id: "no_es",        label: "no es",       tipoValor: "select"     };
const OP_TIENE_VALOR: OperadorConfig = { id: "tiene_valor",  label: "tiene valor", tipoValor: "ninguno"    };
const OP_SIN_VALOR: OperadorConfig   = { id: "sin_valor",    label: "sin valor",   tipoValor: "ninguno"    };
const OP_ANTES_DE: OperadorConfig    = { id: "antes_de",     label: "antes de",    tipoValor: "date"       };
const OP_DESPUES_DE: OperadorConfig  = { id: "despues_de",   label: "después de",  tipoValor: "date"       };
const OP_ENTRE: OperadorConfig       = { id: "entre",        label: "entre",       tipoValor: "date_range" };

// ─── Catálogo central ──────────────────────────────────────────────────────────

export const CATALOGO_REPORTES: ModuloDataset[] = [
  {
    id:    "gestion_logistica",
    label: "Gestión Logística",
    reportes: [
      {
        id:    "viajes_activos",
        label: "Viajes Activos",
        // Dataset fuente: TmsViaje (GET /api/viajes). Campos confirmados en
        // la auditoría de Fase 4 — no se listan columnas sin confirmar.
        campos: [
          {
            key:    "state_travel",
            label:  "Estado del viaje",
            tipo:   "enum",
            origen: "TmsViaje.state_travel — estado reportado por el TMS",
            filtrable:  true,
            operadores: [OP_ES, OP_NO_ES],
            opciones:   Object.entries(ESTADO_CFG).map(([value, cfg]) => ({
              value,
              label: cfg.label,
            })),
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "linea_negocio",
            label:  "Línea de negocio",
            tipo:   "enum",
            origen: "Derivado de TmsViaje.type_operation",
            filtrable:  true,
            operadores: [OP_ES],
            opciones: [
              { value: "Carga Seca",    label: "Carga Seca"    },
              { value: "Carga Líquida", label: "Carga Líquida" },
            ],
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "last_alarm_name",
            label:  "Con novedad",
            tipo:   "booleano",
            origen: "TmsViaje.last_alarm_name — presencia de alarma activa",
            filtrable:  true,
            operadores: [OP_TIENE_VALOR, OP_SIN_VALOR],
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "activated_on",
            label:  "Fecha de activación",
            tipo:   "fecha",
            origen: "TmsViaje.activated_on — fecha de activación reportada por el TMS",
            filtrable:  true,
            operadores: [OP_ES, OP_ANTES_DE, OP_DESPUES_DE, OP_ENTRE],
            seleccionableColumna: true,
            ordenable:            true,
          },
        ],
      },
      // Otros reportes de Gestión Logística (Solicitudes, Programación,
      // Viajes Finalizados, Centro GPS) se agregan aquí cuando se audite el
      // dataset correspondiente. Estructura esperada:
      // {
      //   id: "solicitudes_activas", label: "Solicitudes Activas",
      //   campos: [ /* campos confirmados de Solicitud, ver modules/solicitudes/types.ts */ ],
      // },
    ],
  },
  // Módulos futuros — se agregan como nuevas entradas de nivel superior,
  // sin modificar el wizard ni las etapas:
  // { id: "gestion_comercial", label: "Gestión Comercial", reportes: [] },
  // { id: "talento_humano",    label: "Talento Humano",    reportes: [] },
  // { id: "financiero",        label: "Financiero",        reportes: [] },
];

// ─── Helpers de consulta ────────────────────────────────────────────────────────

export function buscarReporte(tipoReporte: string): ReporteDataset | undefined {
  for (const modulo of CATALOGO_REPORTES) {
    const reporte = modulo.reportes.find(r => r.id === tipoReporte);
    if (reporte) return reporte;
  }
  return undefined;
}

export function buscarModuloDeReporte(tipoReporte: string): ModuloDataset | undefined {
  return CATALOGO_REPORTES.find(m => m.reportes.some(r => r.id === tipoReporte));
}
