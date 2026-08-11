/**
 * services/reportes/columnResolver.js — Resolución de columnas del generador (Fase 9B)
 *
 * Puerto backend, sin cambios de semántica, de resolverColumnas() (Fase 8D —
 * erp/src/modules/configuracion/components/etapas/EtapaRevision.tsx):
 *   - `columnas` (Etapa 03) es la fuente de verdad — filtra a las columnas
 *     válidas para el reporte actual, ordena por `orden` y usa el `titulo`
 *     personalizado.
 *   - `columnas=[]` (o ninguna válida para el reporte) → todas las
 *     seleccionableColumna del catálogo, en el orden del catálogo, con su
 *     label como título. Misma regla exacta que la Preview del wizard.
 *
 * No depende del frontend: la metadata de campo viene de
 * catalogoDatasets.js (proyección backend de datasetsReportes.ts).
 */
import { camposDe } from './catalogoDatasets.js';

/**
 * @param {string} tipoReporte
 * @param {Array<{campo:string, titulo:string, orden:number}>} columnas
 * @returns {Array<{campo:string, titulo:string}>}
 */
export function resolverColumnas(tipoReporte, columnas) {
  const disponibles = camposDe(tipoReporte);
  const entradas = Object.entries(disponibles).filter(([, c]) => c.seleccionableColumna);

  const validas = (columnas ?? []).filter(c => disponibles[c.campo]?.seleccionableColumna);
  if (validas.length === 0) {
    return entradas.map(([campo, c]) => ({ campo, titulo: c.label }));
  }

  return [...validas]
    .sort((a, b) => a.orden - b.orden)
    .map(c => ({ campo: c.campo, titulo: c.titulo }));
}
