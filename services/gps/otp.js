/**
 * services/gps/otp.js — Verificación de correo por OTP (Fase 10B)
 *
 * Antes de abrir una sesión de Seguimiento GPS, el destinatario externo
 * debe demostrar que controla uno de los correos congelados en
 * `enlace.destinatarios_autorizados` — un código de 6 dígitos, de un solo
 * uso, expiración corta (10 min) y con límite de intentos.
 *
 * Anti-enumeración (decisión cerrada de Fase 10B): solicitarOtp() SIEMPRE
 * devuelve `{ok:true}` cuando el enlace es válido, sin importar si el
 * correo está o no autorizado — solo se distingue internamente (`enviado`,
 * usado por tests/auditoría), nunca en lo que ve el llamador HTTP (la
 * proyección a respuesta pública vive en routes/gpsSeguimiento.js).
 */
import { validarEnlace } from './enlaces.js';
import { crearSesion } from './sesiones.js';
import { generarOtp, hashSecreto, compararHash } from './crypto.js';
import { registrarAcceso } from './accesos.js';
import { verificarLimite } from './rateLimiter.js';
import { sendWithAttachment as sendWithAttachmentReal } from '../channels/emailChannel.js';

export const OTP_TTL_MINUTOS   = 10;
export const OTP_MAX_INTENTOS  = 5;

const NAVY = '#012A6B';
const GRAY = '#6B7280';

function normalizarCorreo(correo) {
  return String(correo ?? '').trim().toLowerCase();
}

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function construirCorreoOtp(codigo) {
  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background:#F8F9FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${NAVY};padding:20px 28px;">
          <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.02em;">INLOP</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;color:${NAVY};font-size:17px;font-weight:600;">Código de verificación</h1>
          <p style="margin:0 0 20px;color:${GRAY};font-size:13px;line-height:1.5;">
            Usa este código para ver el seguimiento GPS de tu envío. Vence en ${OTP_TTL_MINUTOS} minutos.
          </p>
          <div style="text-align:center;padding:16px 0;background:#F8F9FB;border-radius:10px;">
            <span style="font-size:28px;font-weight:700;letter-spacing:0.3em;color:${NAVY};">${codigo}</span>
          </div>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #F0F1F5;">
          <span style="color:${GRAY};font-size:12px;">INLOP · Ecosistema Logístico — Seguimiento GPS</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Solicitar OTP ────────────────────────────────────────────────────────────

/**
 * @param {{token: string, correo: string}} input
 * @param {object} deps — sbFetch + (opcional) sendWithAttachment (inyectable
 *   para tests; por defecto usa el emailChannel real — mismo canal que
 *   Reportes Automáticos, Fase 9E, no se crea un segundo proveedor).
 * @returns {Promise<{ok:true, enviado:boolean} | {ok:false, codigo:string}>}
 */
export async function solicitarOtp(input = {}, deps = {}) {
  const { sbFetch } = deps;
  const sendWithAttachment = deps.sendWithAttachment ?? sendWithAttachmentReal;
  const token  = input.token;
  const correo = normalizarCorreo(input.correo);

  if (!token)  return { ok: false, codigo: 'token_requerido' };
  if (!correo || !RE_CORREO.test(correo)) return { ok: false, codigo: 'correo_invalido' };
  if (!sbFetch) return { ok: false, codigo: 'deps_incompletas' };

  const limiteToken = verificarLimite(`otp-solicitar-token:${token}`, { maxIntentos: 20, ventanaMs: 3_600_000 });
  const limiteCorreo = verificarLimite(`otp-solicitar:${token}:${correo}`, { maxIntentos: 5, ventanaMs: 3_600_000 });
  if (!limiteToken.permitido || !limiteCorreo.permitido) {
    await registrarAcceso({ correo, evento: 'rate_limit_excedido', exitoso: false, detalle: { paso: 'otp_solicitar' } }, deps);
    return { ok: false, codigo: 'rate_limited' };
  }

  const validacion = await validarEnlace(token, deps);
  if (!validacion.ok) return { ok: false, codigo: 'enlace_invalido' };
  const { enlace } = validacion;

  const autorizado = (enlace.destinatarios_autorizados ?? []).includes(correo);
  if (!autorizado) {
    await registrarAcceso({
      enlaceId: enlace.id, correo, evento: 'otp_solicitado', exitoso: false,
      detalle: { motivo: 'correo_no_autorizado' },
    }, deps);
    return { ok: true, enviado: false }; // misma forma de éxito — no revela si el correo existe
  }

  // Invalida cualquier OTP pendiente previo del mismo (enlace, correo) — un
  // código anterior no consumido deja de servir en cuanto se pide uno nuevo.
  await sbFetch(
    `/reportes_gps_enlaces_otp?enlace_id=eq.${encodeURIComponent(enlace.id)}&correo=eq.${encodeURIComponent(correo)}&usado=eq.false`,
    'PATCH',
    { usado: true },
  );

  const codigo  = generarOtp();
  const otpHash = hashSecreto(codigo);
  const expiraEn = new Date(Date.now() + OTP_TTL_MINUTOS * 60_000).toISOString();

  const filas = await sbFetch('/reportes_gps_enlaces_otp', 'POST', {
    enlace_id: enlace.id,
    correo,
    otp_hash:  otpHash,
    expira_en: expiraEn,
    intentos:  0,
    usado:     false,
  });
  if (!filas?.[0]) return { ok: false, codigo: 'error_persistencia' };

  const envio = await sendWithAttachment({
    to: [correo],
    subject: 'Tu código de verificación — Seguimiento GPS INLOP',
    html: construirCorreoOtp(codigo),
  });

  await registrarAcceso({
    enlaceId: enlace.id, correo, evento: 'otp_solicitado', exitoso: Boolean(envio?.ok),
    detalle: envio?.ok ? null : { motivo: 'error_envio_correo' },
  }, deps);

  return { ok: true, enviado: Boolean(envio?.ok) };
}

// ─── Validar OTP ──────────────────────────────────────────────────────────────

/**
 * @param {{token: string, correo: string, codigo: string}} input
 * @param {object} deps
 * @returns {Promise<
 *   {ok:true, sesionToken:string, expiraEn:string}
 *   | {ok:false, codigo: 'enlace_invalido'|'correo_invalido'|'otp_invalido'|
 *                        'otp_expirado'|'otp_incorrecto'|'otp_limite_excedido'|
 *                        'rate_limited'|'deps_incompletas'}
 * >} — los códigos son distintos por trazabilidad interna/tests; la ruta
 *   pública (routes/gpsSeguimiento.js) los colapsa a un único mensaje
 *   genérico, nunca expone cuál de estos falló.
 */
export async function validarOtp(input = {}, deps = {}) {
  const { sbFetch } = deps;
  const token  = input.token;
  const correo = normalizarCorreo(input.correo);
  const codigoRecibido = String(input.codigo ?? '').trim();

  if (!token)  return { ok: false, codigo: 'token_requerido' };
  if (!correo) return { ok: false, codigo: 'correo_invalido' };
  if (!sbFetch) return { ok: false, codigo: 'deps_incompletas' };

  const limite = verificarLimite(`otp-validar:${token}:${correo}`, { maxIntentos: 10, ventanaMs: 600_000 });
  if (!limite.permitido) {
    await registrarAcceso({ correo, evento: 'rate_limit_excedido', exitoso: false, detalle: { paso: 'otp_validar' } }, deps);
    return { ok: false, codigo: 'rate_limited' };
  }

  const validacion = await validarEnlace(token, deps);
  if (!validacion.ok) return { ok: false, codigo: 'enlace_invalido' };
  const { enlace } = validacion;

  const autorizado = (enlace.destinatarios_autorizados ?? []).includes(correo);
  if (!autorizado) return { ok: false, codigo: 'otp_invalido' }; // mismo código que "OTP incorrecto" — no distingue

  const filas = await sbFetch(
    `/reportes_gps_enlaces_otp?enlace_id=eq.${encodeURIComponent(enlace.id)}&correo=eq.${encodeURIComponent(correo)}` +
    `&usado=eq.false&order=created_at.desc&limit=1`,
  );
  const otp = filas?.[0];
  if (!otp) return { ok: false, codigo: 'otp_invalido' };

  if (new Date(otp.expira_en).getTime() <= Date.now()) {
    await sbFetch(`/reportes_gps_enlaces_otp?id=eq.${encodeURIComponent(otp.id)}`, 'PATCH', { usado: true });
    return { ok: false, codigo: 'otp_expirado' };
  }

  if (otp.intentos >= OTP_MAX_INTENTOS) {
    await sbFetch(`/reportes_gps_enlaces_otp?id=eq.${encodeURIComponent(otp.id)}`, 'PATCH', { usado: true });
    return { ok: false, codigo: 'otp_limite_excedido' };
  }

  const coincide = compararHash(hashSecreto(codigoRecibido), otp.otp_hash);
  if (!coincide) {
    const intentos = otp.intentos + 1;
    const patch = { intentos };
    if (intentos >= OTP_MAX_INTENTOS) patch.usado = true; // se agota en el mismo intento que lo alcanza
    await sbFetch(`/reportes_gps_enlaces_otp?id=eq.${encodeURIComponent(otp.id)}`, 'PATCH', patch);
    await registrarAcceso({ enlaceId: enlace.id, correo, evento: 'otp_fallido', exitoso: false, detalle: { intentos } }, deps);
    return { ok: false, codigo: intentos >= OTP_MAX_INTENTOS ? 'otp_limite_excedido' : 'otp_incorrecto' };
  }

  await sbFetch(`/reportes_gps_enlaces_otp?id=eq.${encodeURIComponent(otp.id)}`, 'PATCH', { usado: true });

  const sesion = await crearSesion(enlace, correo, deps);
  if (!sesion.ok) return { ok: false, codigo: sesion.codigo };

  await registrarAcceso({ enlaceId: enlace.id, correo, evento: 'otp_validado', exitoso: true }, deps);

  return { ok: true, sesionToken: sesion.sesionToken, expiraEn: sesion.expiraEn };
}
