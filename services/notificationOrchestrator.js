// Notification Orchestrator — Sprint 5.0 (Notification Center Base)
// Arquitectura aprobada: BusinessEvent → Orchestrator → Preference Resolver (stub)
//   → Template Engine (stub) → Delivery Queue → Channel Workers
//
// Canal activo en este sprint: Push (web-push).
// Email / WhatsApp / SMS pendientes de aprobación de sprint futuro.
// Preferencias y plantillas: stubs listos para extensión sin reescritura.
//
// DI pattern idéntico a authScope.js: deps = { sbFetch } inyectado por el llamador.

import pushChannel from './channels/pushChannel.js';

const CHANNEL_REGISTRY = {
  push: pushChannel,
};

// Sprint 5.0 stub: todos los eventos activan push si el usuario tiene suscripción.
// Sprint siguiente: consultar notification_preferences por (usuario_id, tipo_evento, canal).
async function _resolveChannels(_event, _deps) {
  return ['push'];
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
  const rows = await sbFetch('/notification_deliveries', 'POST', [{
    business_event_id: businessEventId,
    canal,
    estado:   'pending',
    intentos: 0,
  }]);
  return rows?.[0] || null;
}

/**
 * Publica un BusinessEvent y dispara la cadena de entrega.
 * Nunca lanza — un fallo de notificación nunca bloquea syncSolicitudes.
 *
 * @param {object} event
 * @param {{ sbFetch: Function }} deps
 */
export async function publishBusinessEvent(event, { sbFetch }) {
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
      const delivery = await _enqueueDelivery(businessEvent.id, canal, { sbFetch });
      if (!delivery) return;

      await worker.send(delivery, { ...event, ...rendered }, { sbFetch });
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
