/**
 * services/reportes/index.js — API interna del pipeline de datos (Fase 9B)
 *
 * Punto de entrada único: Dataset Provider → Filter Engine → Column Resolver.
 * No genera Excel, no genera HTML, no envía correo, no programa nada — eso
 * son fases posteriores (9C+, ver docs/REPORTES_AUTOMATICOS_MOTOR_GENERACION.md).
 */
import { obtenerDatasetCompleto } from './datasetProvider.js';
import { aplicarFiltros }         from './filterEngine.js';
import { resolverColumnas }       from './columnResolver.js';
import { fechaHoyColombia }       from '../../utils/fechas.js';

export { obtenerDatasetCompleto } from './datasetProvider.js';
export { aplicarFiltros, evaluaCondicion, fechaCampoYMD } from './filterEngine.js';
export { resolverColumnas } from './columnResolver.js';
export { CATALOGO_DATASETS, camposDe } from './catalogoDatasets.js';

/**
 * obtenerDatosReporte — dataset final listo para el builder (Excel/HTML,
 * fase posterior): dataset completo → filtros aplicados → columnas
 * resueltas (campo/título/orden), sin generar ningún archivo todavía.
 *
 * @param {{tipo_reporte: string, filtros?: Array, columnas?: Array}} reporte
 *   Fila de `reportes_automaticos` (o un objeto con la misma forma).
 * @param {{sbFetch?: Function, viajesCache?: Array, tripCustomerCache?: Map,
 *          extraerTelefono?: Function, primerNombreCliente?: Function,
 *          fechaEjecucion?: string}} deps
 *   Dependencias inyectadas por el llamador (index.js hoy; el scheduler en
 *   una fase futura) — este módulo nunca importa nada de index.js.
 *
 * @returns {Promise<{
 *   columnas: Array<{campo: string, titulo: string}>,
 *   registros: Array<Record<string, unknown>>,
 *   metadata: {
 *     tipoReporte: string,
 *     totalRegistros: number,
 *     totalDisponibles: number,
 *     fechaEjecucion: string,
 *     generadoEn: string,
 *   },
 * }>}
 */
export async function obtenerDatosReporte(reporte, deps = {}) {
  const tipoReporte = reporte?.tipo_reporte;
  if (!tipoReporte) {
    throw new Error('obtenerDatosReporte: el reporte no tiene tipo_reporte');
  }
  const filtros     = reporte.filtros  ?? [];
  const columnasCfg = reporte.columnas ?? [];

  const contexto = {
    filtros,
    fechaEjecucion: deps.fechaEjecucion || fechaHoyColombia(),
  };

  const datasetCompleto = await obtenerDatasetCompleto(tipoReporte, contexto, deps);
  const registros        = aplicarFiltros(datasetCompleto, filtros, tipoReporte);
  const columnas          = resolverColumnas(tipoReporte, columnasCfg);

  return {
    columnas,
    registros,
    metadata: {
      tipoReporte,
      totalRegistros:    registros.length,
      totalDisponibles:  datasetCompleto.length,
      fechaEjecucion:    contexto.fechaEjecucion,
      generadoEn:        new Date().toISOString(),
    },
  };
}
