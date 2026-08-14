/**
 * services/gps/sesiones.js — Sesiones temporales de solo lectura (Fase 10B)
 *
 * Se emite una sesión tras validar correctamente el OTP (services/gps/otp.js)
 * — es el único "acceso" real a los datos GPS del enlace. La sesión nunca
 * puede vivir más que el enlace que la originó: si el enlace expira o se
 * revoca, la sesión deja de ser válida de inmediato, aunque su propia
 * `expira_en` todavía no se haya cumplido — validarSesion() revalida el
 * enlace padre en cada llamada, no solo al crear la sesión.
 */
import { validarEnlace } from './enlaces.js';
import { generarToken, hashSecreto } from './crypto.js';

/** TTL de sesión por defecto — nunca supera la expiración del enlace padre. */
export const TTL_HORAS_SESION_DEFECTO = 24;

/**
 * @param {object} enlace — fila de reportes_gps_enlaces (de validarEnlace()).
 * @param {string} correo — ya normalizado (trim+lowercase) por el llamador (otp.js).
 * @param {{sbFetch: Function}} deps
 */
export async function crearSesion(enlace, correo, deps = {}, ttlHoras = TTL_HORAS_SESION_DEFECTO) {
  const { sbFetch } = deps;
  if (!sbFetch) return { ok: false, codigo: 'deps_incompletas' };

  const expiraDeseada = Date.now() + ttlHoras * 3_600_000;
  const expiraEnlace  = new Date(enlace.expira_en).getTime();
  const expiraEn      = new Date(Math.min(expiraDeseada, expiraEnlace)).toISOString();

  const token     = generarToken();
  const tokenHash = hashSecreto(token);

  const filas = await sbFetch('/reportes_gps_enlaces_sesiones', 'POST', {
    enlace_id:          enlace.id,
    correo,
    sesion_token_hash:  tokenHash,
    expira_en:          expiraEn,
    revocada:           false,
  });
  if (!filas?.[0]) return { ok: false, codigo: 'error_persistencia' };

  return { ok: true, sesionToken: token, expiraEn };
}

/**
 * @param {string} sesionToken
 * @param {{sbFetch: Function}} deps
 * @returns {Promise<
 *   {ok:true, sesion:object, enlace:object}
 *   | {ok:false, codigo:string}
 * >}
 */
export async function validarSesion(sesionToken, deps = {}) {
  const { sbFetch } = deps;
  if (!sesionToken) return { ok: false, codigo: 'token_requerido' };
  if (!sbFetch)      return { ok: false, codigo: 'deps_incompletas' };

  const hash = hashSecreto(sesionToken);
  const filas = await sbFetch(`/reportes_gps_enlaces_sesiones?sesion_token_hash=eq.${encodeURIComponent(hash)}&limit=1`);
  const sesion = filas?.[0];
  if (!sesion) return { ok: false, codigo: 'no_encontrada' };
  if (sesion.revocada) return { ok: false, codigo: 'revocada' };
  if (new Date(sesion.expira_en).getTime() <= Date.now()) return { ok: false, codigo: 'expirada' };

  // El enlace padre puede haberse revocado o expirado DESPUÉS de emitida la
  // sesión — revalidar en cada acceso, no solo al crearla, para que una
  // revocación tenga efecto inmediato sobre sesiones ya abiertas.
  const filasEnlace = await sbFetch(`/reportes_gps_enlaces?id=eq.${encodeURIComponent(sesion.enlace_id)}&limit=1`);
  const enlace = filasEnlace?.[0];
  if (!enlace)          return { ok: false, codigo: 'enlace_no_encontrado' };
  if (enlace.revocado)  return { ok: false, codigo: 'enlace_revocado' };
  if (new Date(enlace.expira_en).getTime() <= Date.now()) return { ok: false, codigo: 'enlace_expirado' };

  return { ok: true, sesion, enlace };
}

// Se re-exporta por conveniencia — otp.js valida el enlace por su cuenta
// antes de crear la sesión, así que crearSesion() en sí no lo revalida (evita
// una consulta redundante); queda documentado aquí para que quede claro que
// SÍ se revalida en cada acceso posterior, vía validarSesion().
export { validarEnlace };
