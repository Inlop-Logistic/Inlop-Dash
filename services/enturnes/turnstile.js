/**
 * services/enturnes/turnstile.js — Verificación de Cloudflare Turnstile para
 * el formulario público de Enturne de Vehículos (control pendiente de la
 * auditoría de seguridad).
 *
 * No guarda estado ni credenciales propias: recibe el token del formulario,
 * la TURNSTILE_SECRET_KEY real (inyectada por index.js — nunca hardcodeada
 * ni expuesta al navegador) y un `fetchConTimeout` inyectado (mismo patrón
 * que el resto de services/enturnes/*.js y routes/enturnes.js — así se
 * puede probar sin red real, ver turnstile.test.js).
 *
 * "Reutilizado": Cloudflare mismo invalida un token tras su primer uso
 * exitoso — un segundo intento con el mismo token vuelve con
 * success:false y error-codes incluyendo "timeout-or-duplicate". No hace
 * falta ningún almacenamiento propio de tokens ya usados (eso sería
 * duplicar lo que el servicio oficial ya garantiza, y el brief pide
 * explícitamente no agregar infraestructura como Redis para esto).
 */

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Exigidos por el brief — el token debe haber sido emitido para este
// hostname y con esta acción específica, no cualquier token válido de
// cualquier sitio que use la misma cuenta de Cloudflare.
export const TURNSTILE_HOSTNAME_ESPERADO = 'enturne.inloplogistica.com';
export const TURNSTILE_ACCION_ESPERADA = 'enturne';

/**
 * Verifica un token de Turnstile contra el servicio oficial de Cloudflare.
 *
 * @param {object} args
 * @param {string} args.token - el campo `cf-turnstile-response` enviado por el formulario.
 * @param {string} args.secretKey - TURNSTILE_SECRET_KEY real (nunca vacía al llamar — el caller ya validó fail-closed antes).
 * @param {string} [args.ip] - IP del cliente (recomendado por Cloudflare, no obligatorio).
 * @param {Function} args.fetchConTimeout - fetch inyectado (mismo usado para Supabase).
 * @returns {Promise<{ok:boolean, motivo?:string}>}
 */
export async function verificarTurnstile({ token, secretKey, ip, fetchConTimeout }) {
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, motivo: 'token_ausente' };
  }

  const params = new URLSearchParams();
  params.set('secret', secretKey);
  params.set('response', token);
  if (ip) params.set('remoteip', ip);

  let r;
  try {
    r = await fetchConTimeout(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (e) {
    // Cloudflare caído/inalcanzable/timeout — fail-closed: se bloquea el
    // registro, nunca se deja pasar "por si acaso".
    return { ok: false, motivo: 'servicio_no_disponible' };
  }

  let data;
  try {
    data = await r.json();
  } catch (e) {
    return { ok: false, motivo: 'respuesta_invalida' };
  }

  if (!data || data.success !== true) {
    return { ok: false, motivo: 'token_invalido' };
  }
  if (data.hostname !== TURNSTILE_HOSTNAME_ESPERADO) {
    return { ok: false, motivo: 'hostname_inesperado' };
  }
  if (TURNSTILE_ACCION_ESPERADA && data.action !== TURNSTILE_ACCION_ESPERADA) {
    return { ok: false, motivo: 'accion_inesperada' };
  }

  return { ok: true };
}
