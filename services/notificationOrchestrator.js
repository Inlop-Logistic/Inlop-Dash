// Notification Orchestrator — Sprint 5.0+ (Notification Center)
// Arquitectura: BusinessEvent → Orchestrator → Preference Resolver → Channel Workers
//
// Canales activos: Push (web-push) — Sprint 5.0 — y Email (Resend) — Sprint 5.1.
// Preferencias de canal por usuario: Sprint 6.0 (preferenceResolver.js).
// WhatsApp / SMS pendientes de aprobación de sprint futuro.
//
// DI pattern idéntico a authScope.js: deps = { sbFetch, sbAuthAdmin } inyectado
// por el llamador. sbAuthAdmin es requerido por emailChannel (resolución de
// email de usuario vía Supabase Auth Admin API) — pushChannel lo ignora.

import pushChannel from './channels/pushChannel.js';
import emailChannel from './channels/emailChannel.js';
import { resolveUserChannels } from './preferenceResolver.js';

const CHANNEL_REGISTRY = {
  push:  pushChannel,
  email: emailChannel,
};

// Canales por tipo de evento de negocio — define qué canales PUEDE usar cada evento.
// _resolveChannels() intersecta esto con las preferencias del usuario (Sprint 6.0)
// para producir la lista final de canales a los que se envía.
const EVENT_CHANNELS = {
  SOLICITUD_CREADA:    ['email'],
  SERVICIO_CONFIRMADO: ['push', 'email'],
  SERVICIO_EN_RUTA:    ['push'],
  SERVICIO_COMPLETADO: ['push', 'email'],
  SERVICIO_CANCELADO:  ['push'],
};

async function _resolveChannels(event, { sbFetch }) {
  const canalesSistema = EVENT_CHANNELS[event.tipo] || ['push'];
  const canalesUsuario = await resolveUserChannels(event.usuario_id, { sbFetch });
  return canalesSistema.filter(c => canalesUsuario.includes(c));
}

// Sprint 5.0 stub: el contenido viene directo del evento.
// Sprint siguiente: lookup en notification_templates por (canal, tipo_evento, locale).
function _renderTemplate(event, _canal) {
  return {
    titulo:      event.titulo,
    mensaje:     event.mensaje,
    pushPayload: event.pushPayload,
  };
}

async function _enqueueDelivery(businessEventId, canal, { sbFetch }) {
  const payload = [{ business_event_id: businessEventId, canal, estado: 'pending', intentos: 0 }];
  const rows = await sbFetch('/notification_deliveries', 'POST', payload);
  return rows?.[0] || null;
}

/**
 * Publica un BusinessEvent y dispara la cadena de entrega.
 * Nunca lanza — un fallo de notificación nunca bloquea syncSolicitudes.
 *
 * @param {object} event
 * @param {{ sbFetch: Function, sbAuthAdmin?: Function }} deps
 */
export async function publishBusinessEvent(event, { sbFetch, sbAuthAdmin }) {
  try {
    // ── 1. IDEMPOTENCIA: consulta primero, nunca duplicar ──────────────────
    const key = event.idempotency_key;
    const existing = await sbFetch(
      `/business_events?idempotency_key=eq.${encodeURIComponent(key)}&limit=1`
    );
    if (existing?.length && existing[0].procesado) {
      console.log(`[orchestrator] ♻️  duplicado ignorado: ${key}`);
      return;
    }

    let businessEvent = existing?.length ? existing[0] : null;
    if (!businessEvent) {
      const rows = await sbFetch('/business_events', 'POST', [{
        tipo:             event.tipo,
        usuario_id:       event.usuario_id,
        empresa_id:       event.empresa_id   || null,
        solicitud_id:     event.solicitud_id || null,
        payload:          { titulo: event.titulo, mensaje: event.mensaje, push_payload: event.pushPayload },
        prioridad:        event.prioridad    || 'HIGH',
        idempotency_key:  key,
        procesado:        false,
      }]);
      businessEvent = rows?.[0];
    }
    if (!businessEvent) {
      console.error('[orchestrator] ❌ No se pudo persistir el BusinessEvent:', key);
      return;
    }

    // ── 2. PREFERENCE RESOLVER ──────────────────────────────────────────────
    const canales = await _resolveChannels(event, { sbFetch });

    // ── 3. DELIVERY POR CANAL ─────────────────────────────────────────────
    await Promise.allSettled(canales.map(async (canal) => {
      const worker = CHANNEL_REGISTRY[canal];
      if (!worker) return;

      const rendered = _renderTemplate(event, canal);

      const delivery = await _enqueueDelivery(businessEvent.id, canal, { sbFetch });
      if (!delivery) return;

      await worker.send(delivery, { ...event, ...rendered }, { sbFetch, sbAuthAdmin });
    }));

    // ── 4. MARCAR PROCESADO ───────────────────────────────────────────────
    await sbFetch(`/business_events?id=eq.${encodeURIComponent(businessEvent.id)}`, 'PATCH', {
      procesado: true,
    });
  } catch (err) {
    console.error('[orchestrator] ❌ Error inesperado:', err.message);
    // Nunca relanza — fuego y olvido garantizado
  }
}
