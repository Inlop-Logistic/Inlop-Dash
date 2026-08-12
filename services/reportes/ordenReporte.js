/**
 * services/reportes/ordenReporte.js — Orden de registros del generador (Fase 9H)
 *
 * Si el reporte tiene seleccionada (al menos) una columna de tipo fecha,
 * los registros se ordenan por esa fecha DESC (más reciente → más antiguo)
 * antes de construir los archivos. El campo de fecha se resuelve desde
 * catalogoDatasets.js/columnResolver.js — nunca se asume un nombre de campo
 * fijo (ej. `activated_on`): cada tipo_reporte tiene su propio campo fecha
 * (`activated_on`, `creado_en`, `schedulate_origin`, `fecha_cumplido`, …).
 *
 * Se aplica una sola vez, en obtenerDatosReporte() (Fase 9B) — el único
 * punto del pipeline que consumen tanto excelBuilder como htmlBuilder — así
 * ambos formatos quedan siempre en el mismo orden sin duplicar la lógica.
 */
import { camposDe } from './catalogoDatasets.js';
import { valorFecha } from './valoresCelda.js';

/**
 * @param {Array<Record<string, unknown>>} registros — ya filtrados.
 * @param {Array<{campo: string, titulo: string}>} columnas — ya resueltas
 *   por columnResolver.js (Etapa 03 del reporte, o todo el catálogo si
 *   columnas=[]).
 * @param {string} tipoReporte
 * @returns {Array<Record<string, unknown>>} — los mismos registros, en el
 *   mismo orden, si no hay ninguna columna de tipo fecha seleccionada;
 *   copia reordenada (nunca muta `registros`) en caso contrario. Los
 *   registros cuya fecha no es parseable van al final, en vez de
 *   inventarles una posición.
 */
export function ordenarPorFechaSeleccionada(registros, columnas, tipoReporte) {
  const campos = camposDe(tipoReporte);
  const columnaFecha = (columnas ?? []).find(c => campos[c.campo]?.tipo === 'fecha');
  if (!columnaFecha) return registros;

  const campoInfo = campos[columnaFecha.campo];
  return [...registros].sort((a, b) => {
    const fa = valorFecha(a[columnaFecha.campo], campoInfo);
    const fb = valorFecha(b[columnaFecha.campo], campoInfo);
    if (!fa && !fb) return 0;
    if (!fa) return 1;  // sin fecha parseable → al final, nunca se inventa un valor
    if (!fb) return -1;
    return fb.getTime() - fa.getTime(); // DESC: más reciente primero
  });
}
