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
 * el límite de tasa de esta ruta.
 */
import { Router } from 'express';
import { fechaHoyColombia } from '../utils/fechas.js';
import { validarSolicitudEnturne } from '../services/enturnes/normalizar.js';
import { excedeLimiteTasa, pareceSpam } from '../services/enturnes/antiSpam.js';

export function ipClienteEnturne(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'desconocida';
}

export default function crearRouterEnturnes({ fetchConTimeout, SB_URL, SB_HEADERS }) {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
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
