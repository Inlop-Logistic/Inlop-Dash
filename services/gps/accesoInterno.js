/**
 * services/gps/accesoInterno.js — Acceso interno sin OTP al Seguimiento GPS
 * (Fase 11B)
 *
 * Camino de autenticación alternativo al OTP (services/gps/otp.js, sin
 * cambios) para el MISMO enlace y la MISMA aplicación (seguimiento-gps/):
 * un destinatario interno de un reporte entra con solo su correo, sin
 * código, siempre que se cumplan las 3 condiciones server-side:
 *   1. el correo pertenece a `personal` (personal.correo_compartido);
 *   2. `personal.activo = true` — revalidado EN CADA intento, no congelado
 *      (a diferencia de placas/correos, que sí se congelan al crear el
 *      enlace — un empleado desactivado después de emitido el enlace debe
 *      perder el acceso inmediato);
 *   3. el correo está en `enlace.destinatarios_internos_autorizados` — lista
 *      congelada al crear el enlace (services/gps/enlaces.js#crearEnlace),
 *      mismo criterio que `destinatarios_autorizados` para externos.
 *
 * Igual que solicitarOtp()/validarOtp(): la sesión emitida (crearSesion,
 * services/gps/sesiones.js, SIN cambios) es la MISMA de siempre — la
 * autorización de placas (obtenerVehiculosAutorizados) no distingue cómo se
 * llegó a la sesión, así que el aislamiento por reporte ya existente aplica
 * igual para interno y externo, sin ningún cambio ahí.
 *
 * Si el correo no califica como interno, este módulo NO decide "acceso
 * denegado" por su cuenta — el llamador (routes/gpsSeguimiento.js) cae al
 * flujo OTP externo de siempre (solicitarOtp), exactamente igual que si
 * este módulo no existiera. Por eso el único código de fallo que expone es
 * genérico ('no_autorizado') — nunca distingue cuál de las 3 condiciones
 * falló (anti-enumeración, mismo criterio que otp.js).
 */
import { validarEnlace } from './enlaces.js';
import { crearSesion } from './sesiones.js';
import { registrarAcceso } from './accesos.js';
import { verificarLimite } from './rateLimiter.js';

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarCorreo(correo) {
  return String(correo ?? '').trim().toLowerCase();
}

/**
 * @param {{token: string, correo: string}} input
 * @param {object} deps — sbFetch (para validarEnlace/crearSesion/consultar `personal`).
 * @returns {Promise<
 *   {ok: true, sesionToken: string, expiraEn: string}
 *   | {ok: false, codigo: 'token_requerido'|'correo_invalido'|'deps_incompletas'|
 *                         'enlace_invalido'|'no_autorizado'|'rate_limited'|string}
 * >} — `no_autorizado` cubre las 3 condiciones a la vez (no pertenece a
 *   personal, está inactivo, o no está en la whitelist del enlace) — el
 *   llamador HTTP nunca debe distinguir cuál.
 */
export async function resolverAccesoInterno(input = {}, deps = {}) {
  const { sbFetch } = deps;
  const token  = input.token;
  const correo = normalizarCorreo(input.correo);

  if (!token)  return { ok: false, codigo: 'token_requerido' };
  if (!correo || !RE_CORREO.test(correo)) return { ok: false, codigo: 'correo_invalido' };
  if (!sbFetch) return { ok: false, codigo: 'deps_incompletas' };

  // Namespaces de rate limit propios (no comparte cupo con OTP) — así un
  // intento de acceso interno nunca consume el presupuesto de un externo
  // legítimo que use el mismo enlace, ni viceversa.
  const limiteToken  = verificarLimite(`acceso-interno-token:${token}`, { maxIntentos: 20, ventanaMs: 3_600_000 });
  const limiteCorreo = verificarLimite(`acceso-interno:${token}:${correo}`, { maxIntentos: 10, ventanaMs: 3_600_000 });
  if (!limiteToken.permitido || !limiteCorreo.permitido) {
    await registrarAcceso({ correo, evento: 'rate_limit_excedido', exitoso: false, detalle: { paso: 'acceso_interno' } }, deps);
    return { ok: false, codigo: 'rate_limited' };
  }

  const validacion = await validarEnlace(token, deps);
  if (!validacion.ok) return { ok: false, codigo: 'enlace_invalido' };
  const { enlace } = validacion;

  const autorizado = (enlace.destinatarios_internos_autorizados ?? []).includes(correo);
  if (!autorizado) {
    await registrarAcceso({
      enlaceId: enlace.id, correo, evento: 'acceso_interno_intentado', exitoso: false,
      detalle: { motivo: 'no_autorizado' },
    }, deps);
    return { ok: false, codigo: 'no_autorizado' };
  }

  // Condición 1+2: pertenece a `personal` Y está activo — revalidado en
  // vivo, nunca desde la whitelist congelada de arriba. Tabla pequeña
  // (roster de personal INLOP) — traer las activas y comparar en memoria
  // evita depender de `ilike` (no todo backend PostgREST-like lo soporta
  // igual para mayúsculas/minúsculas) y sigue siendo una sola consulta.
  const filasPersonal = await sbFetch('/personal?activo=eq.true&select=id,correo_compartido');
  const esPersonalActivo = (filasPersonal ?? []).some(p => normalizarCorreo(p.correo_compartido) === correo);
  if (!esPersonalActivo) {
    await registrarAcceso({
      enlaceId: enlace.id, correo, evento: 'acceso_interno_intentado', exitoso: false,
      detalle: { motivo: 'no_autorizado' }, // mismo motivo genérico — no distingue de "no autorizado en el enlace"
    }, deps);
    return { ok: false, codigo: 'no_autorizado' };
  }

  const sesion = await crearSesion(enlace, correo, deps);
  if (!sesion.ok) return { ok: false, codigo: sesion.codigo };

  await registrarAcceso({ enlaceId: enlace.id, correo, evento: 'acceso_interno_concedido', exitoso: true }, deps);

  return { ok: true, sesionToken: sesion.sesionToken, expiraEn: sesion.expiraEn };
}
