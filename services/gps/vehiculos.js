/**
 * services/gps/vehiculos.js — Placa(s) incluidas en un reporte (Fase 10B)
 *
 * Módulo puro: no hace I/O, no conoce Supabase ni ControlT. Recibe los
 * `registros` YA resueltos por obtenerDatosReporte() (Fase 9B — dataset +
 * filtros + columnas ya aplicados) y extrae la placa de cada fila según el
 * `tipo_reporte`, deduplicada.
 *
 * El campo placa por dataset viene de la auditoría de Fase 10A (ver
 * docs/REPORTES_SEGUIMIENTO_GPS_ARQUITECTURA.md §2) — NO se repite el
 * catálogo de columnas de services/reportes/catalogoDatasets.js porque el
 * campo placa no siempre es una columna seleccionable ahí (ej.
 * `solicitudes.placa_asignada` existe en el objeto de fila pero no está en
 * CATALOGO_DATASETS.solicitudes.campos — ver datasetProvider.js:199). Este
 * mapa lee el campo directamente del registro, independientemente de qué
 * columnas haya elegido el usuario para el Excel/HTML — `registros` siempre
 * trae todos los campos del dataset, la selección de columnas solo afecta a
 * los builders (Fase 9C/9D), nunca a `registros`.
 */

/** tipo_reporte → nombre del campo placa en el objeto de fila. */
export const CAMPO_PLACA_POR_REPORTE = {
  viajes_activos:      'license_plate',
  centro_gps:          'license_plate',
  programacion:        'license_plate',
  viajes_finalizados:  'license_plate',
  solicitudes:         'placa_asignada',
};

/**
 * @param {Array<Record<string, unknown>>} registros
 * @param {string} tipoReporte
 * @returns {string[]} placas únicas, sin nulos/vacíos, en el orden de
 *   primera aparición. [] si el tipo de reporte no tiene campo placa
 *   conocido, o si ningún registro tiene placa (ej. solicitudes sin
 *   vehículo asignado todavía).
 */
export function extraerPlacas(registros, tipoReporte) {
  const campo = CAMPO_PLACA_POR_REPORTE[tipoReporte];
  if (!campo || !Array.isArray(registros)) return [];

  const vistas = new Set();
  const placas = [];
  for (const fila of registros) {
    const valor = fila?.[campo];
    if (typeof valor !== 'string') continue;
    const placa = valor.trim().toUpperCase();
    if (!placa || vistas.has(placa)) continue;
    vistas.add(placa);
    placas.push(placa);
  }
  return placas;
}
