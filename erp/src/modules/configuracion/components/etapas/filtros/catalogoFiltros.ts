/**
 * CAMPOS_FILTRO — Adaptador de la etapa Filtros sobre el catálogo central.
 *
 * No declara campos propios: se deriva de CATALOGO_REPORTES
 * (../../../catalogos/datasetsReportes.ts) filtrando por `filtrable = true`
 * y proyectando cada CampoDataset al formato que consumen FiltroRow y
 * EtapaFiltros. Agregar o modificar un campo filtrable en el catálogo
 * central lo refleja aquí automáticamente — este archivo no necesita
 * tocarse al agregar módulos, reportes o campos nuevos.
 */
import {
  CATALOGO_REPORTES,
  type CampoDataset,
  type OperadorConfig,
  type OpcionValor,
  type OperadorId,
  type TipoValorControl,
  type TipoDatoCampo,
} from "@/modules/configuracion/catalogos/datasetsReportes";

// Re-exportados para no romper los imports existentes de FiltroRow/EtapaFiltros.
export type { OperadorId, OperadorConfig, OpcionValor, TipoValorControl };
export type TipoCampo = TipoDatoCampo;

export interface CampoFiltroConfig {
  campo:      string;
  label:      string;
  tipo:       TipoDatoCampo;
  operadores: OperadorConfig[];
  /** Solo presente cuando tipo = "enum". */
  opciones?:  OpcionValor[];
}

function aCampoFiltro(campo: CampoDataset): CampoFiltroConfig {
  return {
    campo:      campo.key,
    label:      campo.label,
    tipo:       campo.tipo,
    operadores: campo.operadores ?? [],
    opciones:   campo.opciones,
  };
}

export const CAMPOS_FILTRO: Record<string, CampoFiltroConfig[]> = Object.fromEntries(
  CATALOGO_REPORTES.flatMap(modulo =>
    modulo.reportes.map(reporte => [
      reporte.id,
      reporte.campos.filter(c => c.filtrable).map(aCampoFiltro),
    ] as const)
  )
);
