/**
 * services/reportes/scheduler.js — Scheduler de reportes automáticos (Fase 9F)
 *
 * Flujo por tick:
 *   1. Inicializar: reportes activos/no-borrador con proxima_ejecucion aún
 *      sin calcular (NULL) reciben su primer slot — no se ejecutan en este
 *      paso, solo se programan. Regla de producto (Fase 11D): "guardar
 *      configuración ≠ ejecutar reporte" — ese primer slot NUNCA puede
 *      quedar ya vencido en el momento de calcularlo (ver
 *      inicializarPendientes() más abajo), o el paso 2 de este MISMO tick
 *      lo tomaría por vencido y lo ejecutaría de inmediato — exactamente el
 *      bug reportado: crear/editar/activar un reporte disparaba un correo
 *      al toque, sin esperar al scheduler.
 *   2. Ejecutar: reportes activos/no-borrador con proxima_ejecucion <= ahora
 *      se ejecutan uno por uno, vía ejecutarReporteManual() (Fase 9E) — el
 *      MISMO motor que la ejecución manual, sin ninguna lógica de
 *      generación/envío propia aquí.
 *   3. Reprogramar: tras cada ejecución (éxito o error), se calcula la
 *      siguiente proxima_ejecucion desde "ahora" (no desde el slot vencido
 *      — evita ráfagas de recuperación tras una caída del proceso) y se
 *      persiste. Nunca se toca proxima_ejecucion ANTES de que la ejecución
 *      actual termine.
 *
 * Concurrencia: mutex de proceso (mismo patrón que syncPlaneadosRunning en
 * index.js) evita que dos ticks se solapen si uno tarda más que el
 * intervalo. Dentro de un mismo tick, los reportes se procesan
 * secuencialmente — un Set de ids ya procesados es una segunda barrera
 * defensiva contra un id duplicado en la respuesta de la consulta.
 *
 * Un error en un reporte (generación o envío) nunca detiene el tick: se
 * captura, se registra en el resultado de ese reporte, y se continúa con
 * el siguiente — igual que Promise.allSettled en el resto del backend
 * (services/notificationOrchestrator.js).
 *
 * Sin Redis, sin colas, sin infraestructura externa — un solo proceso Node,
 * mismo modelo que syncViajes/syncSolicitudes/syncPlaneados. Asunción
 * explícita (documentada, no resuelta aquí): un único proceso backend activo
 * a la vez. Múltiples instancias del backend correriendo en paralelo podrían
 * competir por los mismos reportes vencidos — mismo supuesto de
 * arquitectura de un solo proceso que ya tiene el resto del backend (ej.
 * cache.viajes.data en memoria, sin coordinación entre instancias).
 */
import { ejecutarReporteManual } from './envioManual.js';
import { calcularProximaEjecucion } from './recurrencia.js';

let tickEnCurso = false;

/** Solo para tests — nunca usar en producción. */
export function _resetMutexParaTests() {
  tickEnCurso = false;
}

// ─── Inicialización de reportes sin proxima_ejecucion ──────────────────────

/**
 * Calcula el primer slot de un reporte recién activado/reconfigurado —
 * SIEMPRE hacia adelante desde `ahora`, nunca un slot ya vencido.
 *
 * calcularProximaEjecucion(recurrencia, null) (recurrencia.js) busca el
 * primer slot válido desde `fecha_inicio`, IGNORANDO la hora actual por
 * diseño — necesario para que `fin.modo:"repeticiones"` cuente el ordinal
 * correcto desde el origen real de la recurrencia (ver recurrencia.test.js).
 * Pero como el wizard por defecto fija `fecha_inicio` en HOY, ese primer
 * slot cae fácilmente en el pasado (ej. "diaria 08:00" configurada a las
 * 3pm) — usado tal cual aquí, ese slot ya vencido sería tomado por
 * `procesarVencidos()` en este MISMO tick y el reporte se enviaría de
 * inmediato al guardar (Fase 11D, bug reportado). Por eso, si el primer
 * slot bootstrapped ya pasó, se recalcula con `ahora` como referencia — el
 * mismo camino que ya usa un reporte tras ejecutarse (ver
 * procesarUnReporte() más abajo) — para obtener el verdadero próximo slot
 * futuro, sin tocar la semántica de calcularProximaEjecucion() en sí (sigue
 * intacta para `fin.modo:"repeticiones"` y cualquier otro llamador).
 */
function primerSlotFuturo(recurrencia, ahora) {
  const bootstrap = calcularProximaEjecucion(recurrencia, null);
  if (bootstrap && bootstrap <= ahora) {
    return calcularProximaEjecucion(recurrencia, ahora);
  }
  return bootstrap;
}

async function inicializarPendientes(deps, ahora) {
  const { sbFetch } = deps;
  const sinProgramar = await sbFetch(
    '/reportes_automaticos?activo=eq.true&borrador=eq.false&proxima_ejecucion=is.null&select=id,recurrencia'
  ) || [];

  const inicializados = [];
  for (const r of sinProgramar) {
    const siguiente = primerSlotFuturo(r.recurrencia, ahora);
    await sbFetch(`/reportes_automaticos?id=eq.${encodeURIComponent(r.id)}`, 'PATCH', {
      proxima_ejecucion: siguiente ? siguiente.toISOString() : null,
    });
    inicializados.push({ reporteId: r.id, proximaEjecucion: siguiente ? siguiente.toISOString() : null });
  }
  return inicializados;
}

// ─── Ejecución de reportes vencidos ─────────────────────────────────────────

async function procesarUnReporte(reporte, ahora, deps) {
  const { sbFetch } = deps;

  let envio;
  try {
    envio = await ejecutarReporteManual(reporte.id, deps);
  } catch (err) {
    // ejecutarReporteManual() no lanza en sus propios casos de rechazo —
    // esto solo cubre un fallo verdaderamente inesperado, para que nunca
    // tumbe el tick completo.
    envio = { ok: false, codigo: 'error_inesperado', error: err instanceof Error ? err.message : String(err) };
  }

  // Reprogramar SOLO después de que la ejecución terminó — nunca antes.
  // Desde "ahora" (no desde el proxima_ejecucion vencido): un reporte
  // atrasado se ejecuta una única vez esta pasada, sin ráfaga de
  // recuperación de slots perdidos.
  const siguiente = calcularProximaEjecucion(reporte.recurrencia, ahora);
  await sbFetch(`/reportes_automaticos?id=eq.${encodeURIComponent(reporte.id)}`, 'PATCH', {
    proxima_ejecucion: siguiente ? siguiente.toISOString() : null,
  });

  return {
    reporteId: reporte.id,
    ok: envio.ok,
    codigo: envio.codigo ?? null,
    error: envio.error ?? null,
    proximaEjecucion: siguiente ? siguiente.toISOString() : null,
  };
}

async function procesarVencidos(ahora, deps) {
  const { sbFetch } = deps;
  const nowIso = ahora.toISOString();
  // `lte.` excluye NULL de forma natural (NULL <= x nunca es verdadero en
  // PostgREST/SQL) — no hace falta un filtro adicional de "not null".
  const vencidos = await sbFetch(
    `/reportes_automaticos?activo=eq.true&borrador=eq.false&proxima_ejecucion=lte.${encodeURIComponent(nowIso)}&select=*`
  ) || [];

  const procesados = new Set(); // barrera defensiva contra ids duplicados
  const resultados = [];
  for (const reporte of vencidos) {
    if (procesados.has(reporte.id)) continue;
    procesados.add(reporte.id);
    resultados.push(await procesarUnReporte(reporte, ahora, deps));
  }
  return resultados;
}

// ─── Punto de entrada del tick ──────────────────────────────────────────────

/**
 * Ejecuta un tick completo del scheduler: inicializa reportes recién
 * activados sin proxima_ejecucion, y ejecuta los que están vencidos.
 *
 * @param {{sbFetch: Function, viajesCache?: Array, tripCustomerCache?: Map,
 *   extraerTelefono?: Function, primerNombreCliente?: Function,
 *   sendWithAttachment?: Function}} deps — mismas deps de
 *   ejecutarReporteManual() (Fase 9E), inyectadas por el llamador
 *   (index.js). No hay valores por defecto para sbFetch: sin él, el tick no
 *   puede operar.
 * @returns {Promise<
 *   {ok: true, inicializados: Array, ejecutados: Array}
 *   | {ok: false, motivo: 'deps_incompletas' | 'tick_en_curso'}
 * >}
 */
export async function ejecutarTickScheduler(deps = {}) {
  if (!deps.sbFetch) {
    return { ok: false, motivo: 'deps_incompletas' };
  }
  if (tickEnCurso) {
    return { ok: false, motivo: 'tick_en_curso' };
  }

  tickEnCurso = true;
  try {
    const ahora = new Date();
    const inicializados = await inicializarPendientes(deps, ahora);
    const ejecutados = await procesarVencidos(ahora, deps);
    return { ok: true, inicializados, ejecutados };
  } finally {
    tickEnCurso = false;
  }
}
