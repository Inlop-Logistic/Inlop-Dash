/**
 * services/reportes/enlaceGps.js — Puente Reportes Automáticos → Seguimiento
 * GPS externo (Fase 10D)
 *
 * Único punto donde ejecutarReporteManual() (Fase 9E, motor único de envío
 * — manual y scheduler) decide si una ejecución concreta debe llevar un CTA
 * de seguimiento GPS. No reimplementa nada de 10B/10C: crea el enlace vía
 * services/gps/enlaces.js#crearEnlace() (mismo servicio, mismas reglas de
 * seguridad — token hasheado, placas/destinatarios congelados) y arma la
 * URL pública que ya sirve seguimiento-gps/ (Fase 10C, ruta `/t/<token>`).
 *
 * Nunca lanza — cualquier fallo (módulo no soportado, sin placas, sin URL
 * configurada, error de 10B) se resuelve como "sin enlace" (`null`) y se
 * registra con console.error/console.warn: un reporte NUNCA deja de
 * enviarse por culpa del seguimiento GPS.
 */
import { crearEnlace, MODULO_PERMITIDO, extraerPlacas } from '../gps/index.js';

/**
 * @param {object} reporte — fila de reportes_automaticos ya validada
 *   (existe, activo, no borrador) por ejecutarReporteManual(). Debe incluir
 *   `seguimiento_gps` y `modulo_id`.
 * @param {{columnas: Array, registros: Array, metadata: object}} datos —
 *   salida YA calculada de obtenerDatosReporte(reporte, deps) para esta
 *   misma ejecución — nunca se vuelve a calcular aquí ni dentro de
 *   crearEnlace() (se le pasa tal cual, ver services/gps/enlaces.js).
 * @param {object} deps — sbFetch (para crearEnlace) + `seguimientoGpsUrl`
 *   (base pública de seguimiento-gps/, inyectada por index.js desde
 *   process.env.SEGUIMIENTO_GPS_URL — services/reportes/* nunca lee
 *   process.env directamente, mismo criterio que todo este módulo) +
 *   `origenEjecucion` ('manual' | 'scheduler', puramente informativo).
 * @returns {Promise<{url: string} | null>}
 */
export async function resolverEnlaceGps(reporte, datos, deps = {}) {
  if (reporte?.modulo_id !== MODULO_PERMITIDO) return null;
  if (reporte?.seguimiento_gps !== true) return null;

  if (!deps.seguimientoGpsUrl) {
    console.warn(
      `[enlaceGps] Reporte ${reporte.id} tiene seguimiento_gps activo pero no hay ` +
      'seguimientoGpsUrl configurada (SEGUIMIENTO_GPS_URL) — se omite el enlace de esta ejecución.'
    );
    return null;
  }

  const placas = extraerPlacas(datos?.registros, reporte.tipo_reporte);
  if (placas.length === 0) return null; // decisión cerrada 10D: sin placas, no se crea enlace

  try {
    const resultado = await crearEnlace(
      { reporteId: reporte.id, reporte, datos, origen: deps.origenEjecucion ?? null },
      deps,
    );
    if (!resultado.ok) {
      console.error(
        `[enlaceGps] No se pudo crear el enlace GPS del reporte ${reporte.id}: ` +
        `${resultado.codigo} — ${resultado.error}`
      );
      return null;
    }
    const base = deps.seguimientoGpsUrl.replace(/\/+$/, '');
    return { url: `${base}/t/${resultado.token}` };
  } catch (err) {
    console.error(`[enlaceGps] Error inesperado creando el enlace GPS del reporte ${reporte.id}:`, err.message);
    return null;
  }
}
