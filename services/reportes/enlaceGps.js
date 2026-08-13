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

// ─── DIAGNÓSTICO TEMPORAL (retirar tras confirmar la causa raíz en Railway) ──
// Un único log estructurado por invocación, con SOLO campos no sensibles:
// nunca correo, placa, token, OTP, URL completa ni clave alguna. Buscar por
// "[enlaceGps][DIAG-TEMP]" para ubicar/retirar estas líneas cuando ya no
// hagan falta.
function logDiagTemp(reporte, datos, deps, motivo) {
  try {
    console.log('[enlaceGps][DIAG-TEMP]', JSON.stringify({
      reporteId:            reporte?.id ?? null,
      moduloId:             reporte?.modulo_id ?? null,
      seguimientoGps:       reporte?.seguimiento_gps === true,
      cantidadRegistros:    Array.isArray(datos?.registros) ? datos.registros.length : 0,
      cantidadPlacas:       extraerPlacas(datos?.registros, reporte?.tipo_reporte).length,
      cantidadDestExternos: Array.isArray(reporte?.destinatarios?.correos_externos)
        ? reporte.destinatarios.correos_externos.length : 0,
      seguimientoGpsUrlConfigurada: Boolean(deps?.seguimientoGpsUrl),
      // Fase 11E — el pipeline es un único motor compartido (ver JSDoc de
      // ejecutarReporteManual): auditoría + una comparación empírica directa
      // (manual vs. scheduler, mismos datos) no encontraron ninguna
      // divergencia de código. Sin `origenEjecucion` en este log, los
      // registros de Railway no permiten distinguir en producción si una
      // entrada concreta vino de un envío manual o de un tick del scheduler
      // — hacía imposible confirmar/descartar el síntoma reportado
      // comparando ejecuciones reales del MISMO reporte. Se agrega aquí,
      // no para cambiar comportamiento (no se usa en ninguna decisión),
      // solo para que el equipo pueda correlacionar.
      origenEjecucion:      deps?.origenEjecucion ?? null,
      motivo,
    }));
  } catch { /* el diagnóstico nunca debe romper el flujo de envío */ }
}

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
 * @param {{correosInternos?: string[]} | null} destinatariosResueltos — Fase
 *   11B: salida de resolverDestinatarios() (envioManual.js), YA calculada
 *   para el envío del correo de esta misma ejecución — se reutiliza
 *   `correosInternos` para congelar la whitelist interna del enlace, sin
 *   una segunda consulta a `personal` (esa resolución ya se hizo una vez).
 *   `null`/omitido = sin destinatarios internos para este enlace (mismo
 *   comportamiento que antes de 11B).
 * @returns {Promise<{url: string} | null>}
 */
export async function resolverEnlaceGps(reporte, datos, deps = {}, destinatariosResueltos = null) {
  if (reporte?.modulo_id !== MODULO_PERMITIDO) {
    logDiagTemp(reporte, datos, deps, 'modulo_no_permitido');
    return null;
  }
  if (reporte?.seguimiento_gps !== true) {
    logDiagTemp(reporte, datos, deps, 'seguimiento_gps_no_es_true');
    return null;
  }

  if (!deps.seguimientoGpsUrl) {
    logDiagTemp(reporte, datos, deps, 'seguimiento_gps_url_ausente');
    console.warn(
      `[enlaceGps] Reporte ${reporte.id} tiene seguimiento_gps activo pero no hay ` +
      'seguimientoGpsUrl configurada (SEGUIMIENTO_GPS_URL) — se omite el enlace de esta ejecución.'
    );
    return null;
  }

  const placas = extraerPlacas(datos?.registros, reporte.tipo_reporte);
  if (placas.length === 0) {
    logDiagTemp(reporte, datos, deps, 'cero_placas'); // decisión cerrada 10D: sin placas, no se crea enlace
    return null;
  }

  logDiagTemp(reporte, datos, deps, 'continua_a_crearEnlace');

  try {
    const resultado = await crearEnlace(
      {
        reporteId: reporte.id,
        reporte,
        datos,
        origen: deps.origenEjecucion ?? null,
        // Fase 11B — ver JSDoc de arriba: un reporte con SOLO destinatarios
        // internos ya no se queda sin enlace (antes: 'sin_destinatarios_externos').
        destinatariosInternosAutorizados: destinatariosResueltos?.correosInternos ?? [],
      },
      deps,
    );
    if (!resultado.ok) {
      logDiagTemp(reporte, datos, deps, `crearEnlace_fallo:${resultado.codigo}`);
      console.error(
        `[enlaceGps] No se pudo crear el enlace GPS del reporte ${reporte.id}: ` +
        `${resultado.codigo} — ${resultado.error}`
      );
      return null;
    }
    logDiagTemp(reporte, datos, deps, 'enlace_creado_ok');
    const base = deps.seguimientoGpsUrl.replace(/\/+$/, '');
    return { url: `${base}/t/${resultado.token}` };
  } catch (err) {
    logDiagTemp(reporte, datos, deps, 'excepcion_inesperada');
    console.error(`[enlaceGps] Error inesperado creando el enlace GPS del reporte ${reporte.id}:`, err.message);
    return null;
  }
}
