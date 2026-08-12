/**
 * routes/gpsSeguimiento.js — API pública del Seguimiento GPS externo (Fase 10B)
 *
 * Rutas SIN requireInternalApiKey (deliberado — decisión cerrada de Fase
 * 10B: "No reutilizar INTERNAL_API_KEY para acceso público", ver Fase 10A
 * §7 sobre por qué ese secreto compartido no sirve como autorización real).
 * Cada ruta se autoriza con su propio mecanismo: el token del enlace, o el
 * token de sesión emitido tras el OTP — nunca la clave interna del ERP.
 *
 * Factory (mismo patrón de montaje que serviciosRouter en index.js, pero
 * como archivo separado — igual que routes/controltDiag.js): recibe `deps`
 * UNA vez al montar, y cada handler las usa en el momento de la request.
 * `deps.cache` debe ser el objeto `cache` completo de index.js (no
 * `cache.viajes.data` desestructurado de antemano) — su propiedad `.data`
 * se reasigna en cada sync, así que solo leerla en el momento del request
 * garantiza el snapshot más reciente (mismo criterio que ya usa
 * GET /api/gps).
 *
 * Solo lectura: ninguna ruta de este router modifica reportes_automaticos,
 * ni el motor de generación/envío, ni Centro GPS.
 */
import { Router } from 'express';
import { validarEnlace } from '../services/gps/enlaces.js';
import { solicitarOtp, validarOtp } from '../services/gps/otp.js';
import { resolverAccesoInterno } from '../services/gps/accesoInterno.js';
import { obtenerVehiculosAutorizados } from '../services/gps/gpsSeguimiento.js';
import { verificarLimite } from '../services/gps/rateLimiter.js';
import { registrarAcceso } from '../services/gps/accesos.js';

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MENSAJE_LIMITE = 'Demasiados intentos. Vuelve a intentarlo más tarde.';
const MENSAJE_ENLACE_INVALIDO = 'Enlace no válido o expirado';
const MENSAJE_SESION_INVALIDA = 'Sesión inválida o expirada';

function ipDe(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress ?? null;
}

export default function crearRouterGpsSeguimiento(deps) {
  const router = Router();

  // Headers de seguridad — respuestas nunca cacheables (contienen datos de
  // sesión/OTP/GPS), sin sniffing de content-type, sin fuga del token vía
  // Referer en un salto posterior.
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  // GET /enlaces/:token — validar enlace (paso 1: ¿el link en sí sigue vivo?)
  router.get('/enlaces/:token', async (req, res) => {
    const ip = ipDe(req);
    const limite = verificarLimite(`ip-validar-enlace:${ip}`, { maxIntentos: 30, ventanaMs: 600_000 });
    if (!limite.permitido) return res.status(429).json({ error: MENSAJE_LIMITE });

    const resultado = await validarEnlace(req.params.token, deps);
    if (!resultado.ok) {
      await registrarAcceso({ evento: 'enlace_validado', exitoso: false, detalle: { codigo: resultado.codigo }, ip }, deps);
      return res.status(404).json({ error: MENSAJE_ENLACE_INVALIDO });
    }
    await registrarAcceso({ enlaceId: resultado.enlace.id, evento: 'enlace_validado', exitoso: true, ip }, deps);
    // Solo un conteo — nunca placas, correos ni ningún ID interno antes del OTP.
    res.json({ ok: true, vehiculos: (resultado.enlace.placas ?? []).length });
  });

  // POST /enlaces/:token/acceso — Fase 11B: primer paso compartido de
  // internos y externos ("pedir correo"). Intenta acceso interno (sin OTP)
  // primero; si el correo no califica (no es de `personal`, no está
  // activo, o no está autorizado para ESTE enlace), cae exactamente al
  // flujo externo de siempre (solicitarOtp, sin tocar) — misma respuesta
  // anti-enumeración que ya tenía ese flujo. otp.js no se modifica.
  router.post('/enlaces/:token/acceso', async (req, res) => {
    const ip = ipDe(req);
    const limite = verificarLimite(`ip-acceso:${ip}`, { maxIntentos: 30, ventanaMs: 3_600_000 });
    if (!limite.permitido) return res.status(429).json({ error: MENSAJE_LIMITE });

    const correo = req.body?.correo;
    if (typeof correo !== 'string' || !RE_CORREO.test(correo.trim())) {
      return res.status(400).json({ error: 'Correo inválido' });
    }

    const interno = await resolverAccesoInterno({ token: req.params.token, correo }, deps);
    if (interno.ok) {
      return res.json({ ok: true, modo: 'interno', sesion: interno.sesionToken, expiraEn: interno.expiraEn });
    }
    if (interno.codigo === 'rate_limited') {
      return res.status(429).json({ error: MENSAJE_LIMITE });
    }

    // No calificó para acceso interno — trata el intento como externo,
    // exactamente igual que POST /enlaces/:token/otp de siempre.
    const externo = await solicitarOtp({ token: req.params.token, correo }, deps);
    if (!externo.ok && externo.codigo === 'rate_limited') {
      return res.status(429).json({ error: MENSAJE_LIMITE });
    }
    if (!externo.ok) {
      return res.status(404).json({ error: MENSAJE_ENLACE_INVALIDO });
    }
    res.json({ ok: true, modo: 'externo', mensaje: 'Si el correo está autorizado, recibirás un código de verificación.' });
  });

  // POST /enlaces/:token/otp — solicitar OTP { correo }. Se mantiene tal
  // cual (usado hoy por /acceso arriba, y por "reenviar código" desde la
  // pantalla de OTP — reenviarCodigo() en el frontend llama este endpoint
  // directamente, ya no pasa por /acceso).
  router.post('/enlaces/:token/otp', async (req, res) => {
    const ip = ipDe(req);
    const limite = verificarLimite(`ip-otp-solicitar:${ip}`, { maxIntentos: 30, ventanaMs: 3_600_000 });
    if (!limite.permitido) return res.status(429).json({ error: MENSAJE_LIMITE });

    const correo = req.body?.correo;
    if (typeof correo !== 'string' || !RE_CORREO.test(correo.trim())) {
      return res.status(400).json({ error: 'Correo inválido' });
    }

    const resultado = await solicitarOtp({ token: req.params.token, correo }, deps);
    if (!resultado.ok && resultado.codigo === 'rate_limited') {
      return res.status(429).json({ error: MENSAJE_LIMITE });
    }
    if (!resultado.ok) {
      // enlace_invalido / correo_invalido / deps_incompletas — nunca
      // "correo no autorizado": ese caso vuelve por la rama `ok:true` de
      // abajo con `enviado:false`, indistinguible desde afuera.
      return res.status(404).json({ error: MENSAJE_ENLACE_INVALIDO });
    }
    res.json({ ok: true, mensaje: 'Si el correo está autorizado, recibirás un código de verificación.' });
  });

  // POST /enlaces/:token/otp/validar — validar OTP { correo, codigo }
  router.post('/enlaces/:token/otp/validar', async (req, res) => {
    const ip = ipDe(req);
    const limite = verificarLimite(`ip-otp-validar:${ip}`, { maxIntentos: 30, ventanaMs: 600_000 });
    if (!limite.permitido) return res.status(429).json({ error: MENSAJE_LIMITE });

    const correo = req.body?.correo;
    const codigo = req.body?.codigo;
    if (typeof correo !== 'string' || !correo.trim()) return res.status(400).json({ error: 'Correo inválido' });
    if (typeof codigo !== 'string' || !codigo.trim())  return res.status(400).json({ error: 'Código inválido' });

    const resultado = await validarOtp({ token: req.params.token, correo, codigo }, deps);
    if (resultado.ok) {
      return res.json({ ok: true, sesion: resultado.sesionToken, expiraEn: resultado.expiraEn });
    }
    if (resultado.codigo === 'rate_limited') {
      return res.status(429).json({ error: MENSAJE_LIMITE });
    }
    // enlace_invalido | otp_invalido | otp_expirado | otp_incorrecto |
    // otp_limite_excedido | correo_invalido — un único mensaje genérico,
    // nunca se distingue cuál (anti-enumeración, decisión cerrada 10B).
    return res.status(400).json({ error: 'Código incorrecto o expirado' });
  });

  // GET /vehiculos — Authorization: Bearer <sesionToken>
  router.get('/vehiculos', async (req, res) => {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ') || auth.length <= 7) {
      return res.status(401).json({ error: MENSAJE_SESION_INVALIDA });
    }
    const sesionToken = auth.slice(7);

    const ip = ipDe(req);
    const limite = verificarLimite(`ip-vehiculos:${ip}`, { maxIntentos: 120, ventanaMs: 600_000 });
    if (!limite.permitido) return res.status(429).json({ error: MENSAJE_LIMITE });

    const resultado = await obtenerVehiculosAutorizados(sesionToken, deps, {
      ip, userAgent: req.headers['user-agent'] ?? null,
    });
    if (!resultado.ok) return res.status(401).json({ error: MENSAJE_SESION_INVALIDA });
    res.json({ ok: true, vehiculos: resultado.vehiculos });
  });

  return router;
}
