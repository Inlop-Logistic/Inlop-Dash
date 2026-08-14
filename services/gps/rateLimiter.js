/**
 * services/gps/rateLimiter.js — Límite de tasa en memoria (Fase 10B)
 *
 * Mismo criterio que el resto del proyecto para "infraestructura ligera sin
 * dependencias externas" (ver Fase 9F: "No crear Redis, colas ni
 * infraestructura externa" para el scheduler) — ventana fija en memoria de
 * proceso, sin dependencia nueva (no se agrega `express-rate-limit`).
 *
 * Límite conocido, documentado: es por PROCESO — no se comparte entre
 * instancias si el backend llegara a correr con más de un worker/réplica, y
 * se reinicia en cada despliegue/reinicio. Suficiente como primera capa de
 * defensa (el espacio de 256 bits del token y el límite de intentos del OTP,
 * persistido en Supabase, son las protecciones reales contra fuerza bruta;
 * esto es una capa adicional para encarecer el abuso, no la única).
 */

const ventanas = new Map(); // clave -> { conteo, expiraEn }

/**
 * @param {string} clave — identifica QUÉ se limita (ej. `otp:${token}:${correo}`,
 *   `ip:${ip}:validar-enlace`). El llamador decide la granularidad.
 * @param {{maxIntentos: number, ventanaMs: number}} config
 * @returns {{permitido: boolean, restante: number, reintentarEnMs?: number}}
 */
export function verificarLimite(clave, { maxIntentos, ventanaMs }) {
  const ahora = Date.now();
  const actual = ventanas.get(clave);

  if (!actual || actual.expiraEn <= ahora) {
    ventanas.set(clave, { conteo: 1, expiraEn: ahora + ventanaMs });
    return { permitido: true, restante: maxIntentos - 1 };
  }
  if (actual.conteo >= maxIntentos) {
    return { permitido: false, restante: 0, reintentarEnMs: actual.expiraEn - ahora };
  }
  actual.conteo += 1;
  return { permitido: true, restante: maxIntentos - actual.conteo };
}

/** Solo para tests — limpia el estado en memoria entre casos. */
export function _resetParaTests() {
  ventanas.clear();
}
