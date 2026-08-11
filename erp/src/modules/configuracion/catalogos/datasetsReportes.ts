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
 *
 * Auditoría de datasets — Gestión Logística (2026-08-11):
 *   viajes_activos    → TmsViaje          (GET /api/viajes)
 *   solicitudes       → Solicitud         (GET /api/solicitudes)
 *   programacion      → ViajeResumen      (GET /api/programacion)
 *   viajes_finalizados→ CumplidoRecord    (GET /api/cumplidos)
 *   centro_gps        → GpsRecord         (GET /api/gps)
 *
 * Corrección Fase 5 (2026-08-11): filtros ≠ columnas.
 *   viajes_activos expandido a 13 campos: 4 filtrables + columna,
 *   9 solo columna. Fuente: VIAJES_COLUMNS_DEF + ViajesTableColumns.tsx.
 */
import { ESTADO_CFG as ESTADO_VIAJE_CFG }        from "@/modules/viajes/constants";
import { ESTADO_CFG as ESTADO_SOLICITUD_CFG }     from "@/modules/solicitudes/constants";
import { ESTADO_CFG as ESTADO_PROGRAMACION_CFG }  from "@/modules/programacion/constants";
import { ESTADO_DOC_CFG }                         from "@/modules/cumplidos/constants";
import { ESTADO_GPS_CFG }                         from "@/modules/gps/constants";

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

// ─── Opciones compartidas entre reportes ─────────────────────────────────────

/** Línea de negocio derivada de type_operation — usada en varios reportes. */
const OPCIONES_LINEA_NEGOCIO: OpcionValor[] = [
  { value: "Carga Seca",    label: "Carga Seca"    },
  { value: "Carga Líquida", label: "Carga Líquida" },
];

// ─── Catálogo central ──────────────────────────────────────────────────────────

export const CATALOGO_REPORTES: ModuloDataset[] = [
  {
    id:    "gestion_logistica",
    label: "Gestión Logística",
    reportes: [

      // ── Viajes Activos ──────────────────────────────────────────────────────
      // Dataset fuente: TmsViaje (GET /api/viajes).
      //
      // Auditoría Fase 5 corrección (2026-08-11):
      //   Columnas reales confirmadas en viajes.definition.ts (VIAJES_COLUMNS_DEF)
      //   y ViajesTableColumns.tsx (RENDERERS). La tabla real muestra 11 columnas;
      //   el catálogo anterior solo declaraba los 4 campos filtrables — error
      //   conceptual: filtros ≠ columnas. Cada campo ahora tiene metadata
      //   independiente para filtrado y para selección de columna.
      //
      // Leyenda de metadata:
      //   filtrable=true  → disponible en etapa Filtros
      //   seleccionableColumna=true → disponible en etapa Columnas
      //   Un campo puede ser ninguno, uno, o ambos, según su utilidad real.
      {
        id:    "viajes_activos",
        label: "Viajes Activos",
        campos: [
          // ── Solo columna (no filtrable) ──────────────────────────────────

          {
            key:    "trip_number",
            label:  "Manifiesto",
            tipo:   "texto",
            origen: "TmsViaje.trip_number — número de manifiesto TMS (clave del viaje)",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "number_order",
            label:  "Remisión",
            tipo:   "texto",
            origen: "TmsViaje.number_order — número de remisión / documento de transporte",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "company_customer_name",
            label:  "Cliente",
            tipo:   "texto",
            origen: "TmsViaje.razon_social ?? TmsViaje.company_customer_name — razón social del Maestro de Clientes, o nombre TMS como fallback",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "tipo_servicio",
            label:  "Tipo de servicio",
            tipo:   "texto",
            origen: "Derivado: 'Urbano' si origin_city_name === destiny_city_name, 'Nacional' en otro caso",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "origin_city_name",
            label:  "Ciudad de origen",
            tipo:   "texto",
            origen: "TmsViaje.origin_city_name — ciudad de recogida reportada por el TMS",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "destiny_city_name",
            label:  "Ciudad de destino",
            tipo:   "texto",
            origen: "TmsViaje.destiny_city_name — ciudad de entrega reportada por el TMS",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "license_plate",
            label:  "Placa",
            tipo:   "texto",
            origen: "TmsViaje.license_plate — placa del vehículo asignado",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "driver_name",
            label:  "Conductor",
            tipo:   "texto",
            origen: "TmsViaje.driver_name — nombre del conductor asignado",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "driver_phone",
            label:  "Celular del conductor",
            tipo:   "texto",
            origen: "TmsViaje.driver_phone — teléfono del conductor",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            false,
          },

          // ── Filtrable + columna ──────────────────────────────────────────

          {
            key:    "activated_on",
            label:  "Fecha de activación",
            tipo:   "fecha",
            origen: "TmsViaje.activated_on — fecha de activación reportada por el TMS (formato MDY del TMS)",
            filtrable:  true,
            operadores: [OP_ES, OP_ANTES_DE, OP_DESPUES_DE, OP_ENTRE],
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "linea_negocio",
            label:  "Línea de negocio",
            tipo:   "enum",
            origen: "Derivado de TmsViaje.type_operation — 'granel liquido' (case-insensitive) → Carga Líquida, cualquier otro → Carga Seca",
            filtrable:  true,
            operadores: [OP_ES],
            opciones:   OPCIONES_LINEA_NEGOCIO,
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "state_travel",
            label:  "Estado del viaje",
            tipo:   "enum",
            origen: "TmsViaje.state_travel — estado reportado por el TMS",
            filtrable:  true,
            operadores: [OP_ES, OP_NO_ES],
            opciones:   Object.entries(ESTADO_VIAJE_CFG).map(([value, cfg]) => ({
              value,
              label: cfg.label,
            })),
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "last_alarm_name",
            label:  "Con novedad",
            tipo:   "booleano",
            origen: "TmsViaje.last_alarm_name — presencia de alarma activa en el viaje",
            filtrable:  true,
            operadores: [OP_TIENE_VALOR, OP_SIN_VALOR],
            seleccionableColumna: true,
            ordenable:            false,
          },
        ],
      },

      // ── Solicitudes ─────────────────────────────────────────────────────────
      // Dataset fuente: Solicitud (GET /api/solicitudes).
      // Estado persiste como EstadoSolicitud: pendiente | aprobado | en_ruta |
      // completado | cancelado. Labels tomados de solicitudes/constants ESTADO_CFG.
      {
        id:    "solicitudes",
        label: "Solicitudes",
        campos: [
          {
            key:    "estado",
            label:  "Estado",
            tipo:   "enum",
            origen: "Solicitud.estado — estado de la solicitud de servicio",
            filtrable:  true,
            operadores: [OP_ES, OP_NO_ES],
            opciones:   Object.entries(ESTADO_SOLICITUD_CFG).map(([value, cfg]) => ({
              value,
              label: cfg.label,
            })),
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "tipo_operacion",
            label:  "Tipo de operación",
            tipo:   "enum",
            origen: "Solicitud.tipo_operacion — urbana | nacional",
            filtrable:  true,
            operadores: [OP_ES],
            opciones: [
              { value: "urbana",   label: "Urbana"   },
              { value: "nacional", label: "Nacional" },
            ],
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "fecha_requerida",
            label:  "Fecha requerida",
            tipo:   "fecha",
            origen: "Solicitud.fecha_requerida — fecha de entrega solicitada por el cliente",
            filtrable:  true,
            operadores: [OP_ES, OP_ANTES_DE, OP_DESPUES_DE, OP_ENTRE],
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "cliente",
            label:  "Cliente",
            tipo:   "texto",
            origen: "Solicitud.cliente — nombre del cliente que genera la solicitud",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "origen",
            label:  "Ciudad de origen",
            tipo:   "texto",
            origen: "Solicitud.origen — ciudad/dirección de recogida",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "destino",
            label:  "Ciudad de destino",
            tipo:   "texto",
            origen: "Solicitud.destino — ciudad/dirección de entrega",
            filtrable:            false,
            seleccionableColumna: true,
            ordenable:            false,
          },
        ],
      },

      // ── Programación ────────────────────────────────────────────────────────
      // Dataset fuente: ViajeResumen (GET /api/programacion).
      // estado_programacion persiste como EstadoProgramacion: programado |
      // asignado | en_ruta | completado | cancelado | sin_asignar.
      // Labels tomados de programacion/constants ESTADO_CFG.
      {
        id:    "programacion",
        label: "Programación",
        campos: [
          {
            key:    "estado_programacion",
            label:  "Estado de programación",
            tipo:   "enum",
            origen: "ViajeResumen.estado_programacion — estado operativo del viaje en programación",
            filtrable:  true,
            operadores: [OP_ES, OP_NO_ES],
            opciones:   Object.entries(ESTADO_PROGRAMACION_CFG).map(([value, cfg]) => ({
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
            origen: "Derivado de ViajeResumen.type_operation — 'granel liquido' → Carga Líquida, resto → Carga Seca",
            filtrable:  true,
            operadores: [OP_ES],
            opciones:   OPCIONES_LINEA_NEGOCIO,
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "schedulate_origin",
            label:  "Fecha de despacho",
            tipo:   "fecha",
            origen: "ViajeResumen.schedulate_origin — fecha/hora programada de despacho en origen",
            filtrable:  true,
            operadores: [OP_ES, OP_ANTES_DE, OP_DESPUES_DE, OP_ENTRE],
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "activo_en_resume",
            label:  "Activo en programación",
            tipo:   "booleano",
            origen: "ViajeResumen.activo_en_resume — indica si el viaje aparece activo en el resumen operativo",
            filtrable:  true,
            operadores: [OP_TIENE_VALOR, OP_SIN_VALOR],
            seleccionableColumna: true,
            ordenable:            false,
          },
        ],
      },

      // ── Viajes Finalizados ───────────────────────────────────────────────────
      // Dataset fuente: CumplidoRecord (GET /api/cumplidos).
      // estado_documental persiste como EstadoDocumental: pendiente |
      // en_revision | con_observaciones | aprobado | rechazado | listo_facturacion.
      // Labels tomados de cumplidos/constants ESTADO_DOC_CFG.
      {
        id:    "viajes_finalizados",
        label: "Viajes Finalizados",
        campos: [
          {
            key:    "estado_documental",
            label:  "Estado documental",
            tipo:   "enum",
            origen: "CumplidoRecord.estado_documental — estado de revisión del paquete documental del cumplido",
            filtrable:  true,
            operadores: [OP_ES, OP_NO_ES],
            opciones:   Object.entries(ESTADO_DOC_CFG).map(([value, cfg]) => ({
              value,
              label: cfg.label,
            })),
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "state_travel",
            label:  "Estado del viaje (TMS)",
            tipo:   "enum",
            origen: "CumplidoRecord.state_travel — estado del viaje reportado por el TMS al momento del cumplido",
            filtrable:  true,
            operadores: [OP_ES, OP_NO_ES],
            opciones:   Object.entries(ESTADO_VIAJE_CFG).map(([value, cfg]) => ({
              value,
              label: cfg.label,
            })),
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "linea_negocio",
            label:  "Línea de negocio",
            tipo:   "enum",
            origen: "Derivado de CumplidoRecord.type_operation — 'granel liquido' → Carga Líquida, resto → Carga Seca",
            filtrable:  true,
            operadores: [OP_ES],
            opciones:   OPCIONES_LINEA_NEGOCIO,
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "activated_on",
            label:  "Fecha de activación",
            tipo:   "fecha",
            origen: "CumplidoRecord.activated_on — fecha de inicio del viaje reportada por el TMS",
            filtrable:  true,
            operadores: [OP_ES, OP_ANTES_DE, OP_DESPUES_DE, OP_ENTRE],
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "tiene_soporte",
            label:  "Tiene soporte cargado",
            tipo:   "booleano",
            origen: "CumplidoRecord.tiene_soporte — indica si el cumplido tiene al menos un archivo adjunto",
            filtrable:  true,
            operadores: [OP_TIENE_VALOR, OP_SIN_VALOR],
            seleccionableColumna: true,
            ordenable:            false,
          },
        ],
      },

      // ── Centro GPS ───────────────────────────────────────────────────────────
      // Dataset fuente: GpsRecord (GET /api/gps).
      // estadoGps es un campo calculado en el backend a partir de la posición,
      // velocidad y alertas GPS activas: activo | detenido | con_alarma |
      // panico | desconectado. Labels tomados de gps/constants ESTADO_GPS_CFG.
      {
        id:    "centro_gps",
        label: "Centro GPS",
        campos: [
          {
            key:    "estadoGps",
            label:  "Estado GPS",
            tipo:   "enum",
            origen: "GpsRecord.estadoGps — estado calculado del vehículo en el sistema de monitoreo",
            filtrable:  true,
            operadores: [OP_ES, OP_NO_ES],
            opciones:   Object.entries(ESTADO_GPS_CFG).map(([value, cfg]) => ({
              value,
              label: cfg.label,
            })),
            seleccionableColumna: true,
            ordenable:            true,
          },
          {
            key:    "state_travel",
            label:  "Estado del viaje (TMS)",
            tipo:   "enum",
            origen: "GpsRecord.state_travel — estado del viaje reportado por el TMS",
            filtrable:  true,
            operadores: [OP_ES, OP_NO_ES],
            opciones:   Object.entries(ESTADO_VIAJE_CFG).map(([value, cfg]) => ({
              value,
              label: cfg.label,
            })),
            seleccionableColumna: true,
            ordenable:            false,
          },
          {
            key:    "last_alarm_name",
            label:  "Con alarma activa",
            tipo:   "booleano",
            origen: "GpsRecord.last_alarm_name — presencia de alarma GPS activa en el vehículo",
            filtrable:  true,
            operadores: [OP_TIENE_VALOR, OP_SIN_VALOR],
            seleccionableColumna: true,
            ordenable:            false,
          },
        ],
      },

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
