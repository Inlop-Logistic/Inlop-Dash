/**
 * routes/enturnes.js — API pública de Enturne de Vehículos.
 *
 * POST /api/enturnes es el ÚNICO camino de escritura a vehiculos_enturnes: la
 * tabla no tiene policy RLS de INSERT para anon/authenticated (ver migración
 * supabase/migrations/20261110000000_vehiculos_enturnes.sql) — este router,
 * usando SUPABASE_SERVICE_KEY (SB_HEADERS, inyectado por index.js — el mismo
 * que ya usa sbFetch en todo ese archivo), es el único que puede insertar. El
 * formulario público (enturne.html) nunca toca Supabase directamente ni
 * conoce la service key.
 *
 * Factory con inyección de `deps` (mismo patrón que routes/gpsSeguimiento.js):
 * recibe fetchConTimeout/SB_URL/SB_HEADERS de index.js al montar, de forma
 * que este archivo se pueda probar sin red real ni levantar el servidor
 * completo — ver routes/enturnes.test.js.
 *
 * No se usa `trust proxy` global (cambiaría req.ip para TODO index.js, fuera
 * del alcance de este cambio) — se lee x-forwarded-for localmente, solo para
 * el límite de tasa de esta ruta. Ver ipClienteEnturne() sobre qué valor del
 * encabezado se toma como confiable y por qué.
 *
 * Cloudflare Turnstile (control de seguridad pendiente de la auditoría): la
 * verificación real vive en services/enturnes/turnstile.js. TURNSTILE_SECRET_KEY
 * se usa EXCLUSIVAMENTE aquí, en Inlop Dash — nunca se envía al navegador ni
 * a enturne-publico/ (ese servicio solo conoce la Site Key, que no es secreta).
 */
import { Router } from 'express';
import { fechaHoyColombia } from '../utils/fechas.js';
import { validarSolicitudEnturne } from '../services/enturnes/normalizar.js';
import { excedeLimiteTasa, pareceSpam } from '../services/enturnes/antiSpam.js';
import { verificarTurnstile } from '../services/enturnes/turnstile.js';

// `x-forwarded-for` es un encabezado que el propio cliente puede enviar
// libremente — Railway (el único proxy inverso delante de este servicio)
// AGREGA la IP real del cliente como último valor de la lista; cualquier
// valor anterior en la lista es autodeclarado por quien hizo la petición
// (el cliente, o quien esté antes de Railway) y NO es confiable. Tomar el
// PRIMER valor (como hacía la versión anterior de esta función, y como
// hace hoy mismo ipDe() en routes/gpsSeguimiento.js) deja que cualquiera
// evada el límite de tasa simplemente enviando un valor distinto en cada
// solicitud — el límite por IP se volvería inútil contra un atacante que
// sepa esto. Se toma el ÚLTIMO valor, asumiendo exactamente un proxy
// confiable delante de este servicio (la topología actual en Railway); si
// en el futuro se agrega un CDN u otro proxy adicional delante, este
// supuesto hay que revisarlo.
//
// Esto es una mitigación de abuso de mejor esfuerzo, NO el límite de
// seguridad real — ese lo da la restricción UNIQUE de Postgres y la
// validación del servidor, que no dependen de ninguna IP.
export function ipClienteEnturne(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const partes = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }
  return req.socket?.remoteAddress || 'desconocida';
}

export default function crearRouterEnturnes({ fetchConTimeout, SB_URL, SB_HEADERS, serviceKeyConfigurado, turnstileSecretKey }) {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      // Fail-closed: sin SUPABASE_SERVICE_KEY real, index.js cae globalmente
      // a la anon key (SB_KEY, patrón preexistente del resto del backend —
      // fuera de alcance tocarlo aquí). vehiculos_enturnes no tiene policy de
      // INSERT para anon/authenticated, así que ese intento fallaría de
      // todos modos — pero este endpoint corta ANTES de construir ese
      // intento contra Supabase, en vez de dejarlo salir con una credencial
      // que nunca debió usarse para escribir.
      if (!serviceKeyConfigurado) {
        console.error('[enturnes] SUPABASE_SERVICE_KEY no configurada — rechazando sin intentar con la anon key.');
        return res.status(503).json({ ok: false, error: 'Servicio de enturne no disponible temporalmente. Intenta más tarde.' });
      }

      // Fail-closed (control de seguridad pendiente de la auditoría): sin
      // TURNSTILE_SECRET_KEY real, no hay forma de verificar ningún token
      // contra Cloudflare — se corta aquí, antes de aceptar ninguna
      // solicitud, en vez de dejar pasar registros sin CAPTCHA "porque la
      // config falta". La Secret Key vive únicamente en este backend
      // (Inlop Dash), nunca en enturne-publico/ ni en el navegador.
      if (!turnstileSecretKey) {
        console.error('[enturnes] TURNSTILE_SECRET_KEY no configurada — rechazando sin verificar.');
        return res.status(503).json({ ok: false, error: 'Servicio de enturne no disponible temporalmente. Intenta más tarde.' });
      }

      const ip = ipClienteEnturne(req);

      // Honeypot: un bot que llena _hp recibe la MISMA respuesta de éxito que
      // un enturne real, sin que se inserte nada — no le da pista de qué lo detectó.
      if (pareceSpam(req.body)) {
        console.warn(`[enturnes] honeypot activado — ip=${ip}`);
        return res.json({ ok: true, enturnado: true });
      }

      if (excedeLimiteTasa(ip)) {
        console.warn(`[enturnes] límite de tasa excedido — ip=${ip}`);
        return res.status(429).json({ ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });
      }

      // Cloudflare Turnstile — ningún registro llega a Supabase sin un token
      // válido, verificado contra el servicio oficial (success, hostname y
      // action esperados; token ausente/inválido/expirado/reutilizado se
      // tratan todos como rechazo, ver services/enturnes/turnstile.js).
      const turnstileToken = req.body && typeof req.body.turnstileToken === 'string' ? req.body.turnstileToken : '';
      const resultadoTurnstile = await verificarTurnstile({ token: turnstileToken, secretKey: turnstileSecretKey, ip, fetchConTimeout });
      if (!resultadoTurnstile.ok) {
        console.warn(`[enturnes] Turnstile rechazado — motivo=${resultadoTurnstile.motivo} ip=${ip}`);
        return res.status(400).json({ ok: false, error: 'No se pudo verificar que eres una persona real. Recarga la página e intenta de nuevo.' });
      }

      const { ok, errores, datos } = validarSolicitudEnturne(req.body);
      if (!ok) {
        return res.status(400).json({ ok: false, error: errores.join(', ') });
      }

      // Fecha operativa calculada en el SERVIDOR con el estándar corporativo de
      // fechas (America/Bogota) — nunca se confía en la fecha del navegador del
      // conductor (ver docs/ERP_DATE_TIME_STANDARD.md, P-02).
      const fecha_operativa = fechaHoyColombia();

      const r = await fetchConTimeout(`${SB_URL}/vehiculos_enturnes`, {
        method: 'POST',
        headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ ...datos, fecha_operativa }),
      });

      if (r.status === 201 || r.status === 204) {
        return res.json({ ok: true, enturnado: true });
      }

      const texto = await r.text().catch(() => '');
      // 409 = conflicto de la restricción UNIQUE(placa_normalizada, fecha_operativa)
      // — Postgres (vía PostgREST) es quien decide esto, no una verificación previa
      // en la aplicación, que sería vulnerable a condición de carrera entre el
      // SELECT y el INSERT. Ver prueba de concurrencia real en el informe final.
      if (r.status === 409 || texto.includes('23505')) {
        return res.json({ ok: true, enturnado: false, yaEnturnado: true });
      }

      console.error(`[enturnes] Supabase POST → ${r.status}: ${texto}`);
      return res.status(500).json({ ok: false, error: 'No se pudo registrar el enturne. Intenta de nuevo.' });
    } catch (e) {
      console.error('[enturnes] POST /api/enturnes:', e.message);
      res.status(500).json({ ok: false, error: 'Error interno al procesar el enturne.' });
    }
  });

  return router;
}
