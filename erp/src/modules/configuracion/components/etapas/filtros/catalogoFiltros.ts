/**
 * Catálogo de campos disponibles para filtrar por tipo_reporte.
 *
 * Clave del mapa = tipo_reporte (ej. "viajes_activos").
 * Extensible: añadir una nueva clave sin tocar la UI de FiltroRow/EtapaFiltros.
 *
 * Campos de "viajes_activos" derivan exclusivamente de los campos confirmados
 * en la auditoría de TmsViaje / useViajes:
 *   state_travel     — string enum  — estado del TMS
 *   linea_negocio    — derivado de type_operation → "Carga Seca" | "Carga Líquida"
 *   last_alarm_name  — string|null  — presencia = "Con novedad"
 *   activated_on     — string|null  — fecha de activación MM/DD/YYYY HH:MM:SS
 */
import { ESTADO_CFG } from "@/modules/viajes/constants";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type OperadorId =
  | "es"
  | "no_es"
  | "tiene_valor"
  | "sin_valor"
  | "antes_de"
  | "despues_de"
  | "entre";

export type TipoCampo = "enum" | "bool" | "fecha";

export interface OpcionValor {
  value: string;
  label: string;
}

/** Qué tipo de control necesita el campo Valor para este operador. */
export type TipoValorControl =
  | "ninguno"      // operadores booleanos (tiene_valor / sin_valor)
  | "select"       // elige de un catálogo de opciones
  | "date"         // un solo date input
  | "date_range";  // dos date inputs (desde / hasta)

export interface OperadorConfig {
  id:         OperadorId;
  label:      string;
  tipoValor:  TipoValorControl;
}

export interface CampoFiltroConfig {
  campo:      string;
  label:      string;
  tipo:       TipoCampo;
  operadores: OperadorConfig[];
  /** Solo presente cuando tipoValor = "select". */
  opciones?:  OpcionValor[];
}

// ─── Operadores reutilizables ─────────────────────────────────────────────────

const OP_ES: OperadorConfig         = { id: "es",          label: "es",          tipoValor: "select"     };
const OP_NO_ES: OperadorConfig      = { id: "no_es",        label: "no es",       tipoValor: "select"     };
const OP_TIENE_VALOR: OperadorConfig = { id: "tiene_valor",  label: "tiene valor", tipoValor: "ninguno"    };
const OP_SIN_VALOR: OperadorConfig  = { id: "sin_valor",    label: "sin valor",   tipoValor: "ninguno"    };
const OP_ANTES_DE: OperadorConfig   = { id: "antes_de",     label: "antes de",    tipoValor: "date"       };
const OP_DESPUES_DE: OperadorConfig = { id: "despues_de",   label: "después de",  tipoValor: "date"       };
const OP_ENTRE: OperadorConfig      = { id: "entre",        label: "entre",       tipoValor: "date_range" };

// ─── Catálogo por tipo_reporte ────────────────────────────────────────────────

export const CAMPOS_FILTRO: Record<string, CampoFiltroConfig[]> = {
  viajes_activos: [
    {
      campo:      "state_travel",
      label:      "Estado del viaje",
      tipo:       "enum",
      operadores: [OP_ES, OP_NO_ES],
      opciones:   Object.entries(ESTADO_CFG).map(([value, cfg]) => ({
        value,
        label: cfg.label,
      })),
    },
    {
      campo:      "linea_negocio",
      label:      "Línea de negocio",
      tipo:       "enum",
      operadores: [OP_ES],
      opciones:   [
        { value: "Carga Seca",    label: "Carga Seca"    },
        { value: "Carga Líquida", label: "Carga Líquida" },
      ],
    },
    {
      campo:      "last_alarm_name",
      label:      "Con novedad",
      tipo:       "bool",
      operadores: [OP_TIENE_VALOR, OP_SIN_VALOR],
    },
    {
      campo:      "activated_on",
      label:      "Fecha de activación",
      tipo:       "fecha",
      operadores: [OP_ES, OP_ANTES_DE, OP_DESPUES_DE, OP_ENTRE],
    },
  ],
  // Para agregar otro tipo de reporte:
  // otro_reporte: [ ... ],
};
