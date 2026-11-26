/**
 * services/enturnes/antiSpam.js — Protección básica anti-spam para el
 * formulario público de Enturne de Vehículos.
 *
 * Sin dependencias nuevas (el proyecto evita frameworks adicionales si no
 * son necesarios — ver brief): dos técnicas simples, suficientes para un
 * formulario público de bajo volumen esperado (conductores en sitio,
 * no tráfico masivo):
 *
 *   1. Honeypot: un campo oculto que un humano nunca ve ni llena, pero que
 *      la mayoría de bots de relleno automático sí completan. Si llega
 *      con contenido, se descarta la solicitud silenciosamente (200 OK
 *      falso-positivo para el bot, sin pista de qué lo detectó).
 *   2. Límite de tasa por IP, en memoria: ventana deslizante simple. No
 *      sobrevive un reinicio del proceso ni se comparte entre réplicas —
 *      aceptable para esta primera versión (un solo servicio Railway, sin
 *      múltiples instancias); si el tráfico creciera, migrar a un límite
 *      respaldado por Supabase o Redis sería el siguiente paso natural,
 *      no antes de que haga falta.
 */

const VENTANA_MS = 60_000; // 1 minuto
const MAX_POR_VENTANA = 5; // 5 solicitudes/minuto por IP — generoso para un conductor real, estrecho para un bot

// IP → timestamps (ms) de sus solicitudes dentro de la ventana vigente
const golpesPorIp = new Map();

/**
 * @param {string} ip
 * @returns {boolean} true si la IP debe ser bloqueada por exceso de solicitudes.
 */
export function excedeLimiteTasa(ip) {
  const ahora = Date.now();
  const previos = golpesPorIp.get(ip) || [];
  const vigentes = previos.filter((t) => ahora - t < VENTANA_MS);
  vigentes.push(ahora);
  golpesPorIp.set(ip, vigentes);
  return vigentes.length > MAX_POR_VENTANA;
}

/**
 * Limpieza periódica para no acumular IPs indefinidamente en memoria.
 * Se invoca con setInterval desde index.js (no desde aquí — este módulo
 * no debe programar timers por sí mismo, para mantenerlo puro y testeable).
 */
export function limpiarGolpesExpirados() {
  const ahora = Date.now();
  for (const [ip, marcas] of golpesPorIp) {
    const vigentes = marcas.filter((t) => ahora - t < VENTANA_MS);
    if (vigentes.length) golpesPorIp.set(ip, vigentes);
    else golpesPorIp.delete(ip);
  }
}

/** Expuesto solo para tests — reinicia el estado en memoria entre casos. */
export function _resetParaTests() {
  golpesPorIp.clear();
}

/**
 * Honeypot: el formulario público incluye un campo oculto `_hp` que debe
 * llegar vacío. Un bot de relleno automático de formularios normalmente
 * completa todos los campos visibles-en-el-DOM, incluido este (oculto por
 * CSS, no por `type=hidden`, precisamente para que un bot simple no lo
 * distinga de un campo real).
 *
 * @param {object} body
 * @returns {boolean} true si parece un envío automatizado.
 */
export function pareceSpam(body) {
  const hp = body && typeof body._hp === 'string' ? body._hp.trim() : '';
  return hp.length > 0;
}
