// Notification Orchestrator — Sprint 5.0 (Notification Center Base)
// Arquitectura aprobada: BusinessEvent → Orchestrator → Preference Resolver (stub)
//   → Template Engine (stub) → Delivery Queue → Channel Workers
//
// Canales activos: Push (web-push) — Sprint 5.0 — y Email (Resend) — Sprint 5.1.
// WhatsApp / SMS pendientes de aprobación de sprint futuro.
// Preferencias y plantillas: stubs listos para extensión sin reescritura.
//
// DI pattern idéntico a authScope.js: deps = { sbFetch, sbAuthAdmin } inyectado
// por el llamador. sbAuthAdmin es requerido por emailChannel (resolución de
// email de usuario vía Supabase Auth Admin API) — pushChannel lo ignora.

import pushChannel from './channels/pushChannel.js';
import emailChannel from './channels/emailChannel.js';

const CHANNEL_REGISTRY = {
  push:  pushChannel,
  email: emailChannel,
};

// Canales por tipo de evento de negocio. Único punto donde se decide esto —
// Sprint 5.1 lo saca del stub fijo (antes: todo evento → solo push).
// Sprint siguiente: consultar notification_preferences por (usuario_id, tipo_evento, canal).
const EVENT_CHANNELS = {
  SOLICITUD_CREADA:    ['email'],
  SERVICIO_CONFIRMADO: ['push', 'email'],
  SERVICIO_EN_RUTA:    ['push'],
  SERVICIO_COMPLETADO: ['push', 'email'],
  SERVICIO_CANCELADO:  ['push'],
};

async function _resolveChannels(event, _deps) {
  return EVENT_CHANNELS[event.tipo] || ['push'];
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
  // [DEBUG 2] payload completo hacia Supabase
  const payload = [{ business_event_id: businessEventId, canal, estado: 'pending', intentos: 0 }];
  console.log('[orchestrator:debug] _enqueueDelivery payload →', JSON.stringify(payload));

  const rows = await sbFetch('/notification_deliveries', 'POST', payload);

  // [DEBUG 3] respuesta completa de Supabase
  console.log('[orchestrator:debug] _enqueueDelivery rows →', JSON.stringify(rows));

  // [DEBUG 4] si sbFetch devolvió null el error HTTP ya fue logueado por sbFetch
  // ("Supabase POST /notification_deliveries → {status}: {body}")
  if (!rows) {
    console.warn(`[orchestrator:debug] _enqueueDelivery → sbFetch retornó null para canal='${canal}' — ver error Supabase arriba`);
  }

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

    // ── 2. PREFERENCE RESOLVER (stub) ─────────────────────────────────────
    const canales = await _resolveChannels(event, { sbFetch });

    // ── 3. DELIVERY POR CANAL ─────────────────────────────────────────────
    await Promise.allSettled(canales.map(async (canal) => {
      const worker = CHANNEL_REGISTRY[canal];
      if (!worker) return;

      const rendered = _renderTemplate(event, canal);

      // [DEBUG 1] antes de _enqueueDelivery
      console.log(`[orchestrator:debug] antes de _enqueueDelivery → business_event.id=${businessEvent.id} tipo=${event.tipo} canal=${canal}`);

      const delivery = await _enqueueDelivery(businessEvent.id, canal, { sbFetch });
      if (!delivery) return;

      // [DEBUG 5] delivery creado correctamente
      console.log(`[orchestrator:debug] delivery OK → id=${delivery.id} canal=${canal}`);

      // [DEBUG 6] antes de worker.send
      console.log(`[orchestrator:debug] worker.send → canal=${canal} worker=${typeof worker.send} delivery.id=${delivery.id}`);

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
