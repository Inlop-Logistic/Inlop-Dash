// Email Channel — Sprint 5.1 (Notification Orchestrator)
//
// Mismo contrato que pushChannel.js: send(delivery, event, { sbFetch, … }).
// Mismas tablas de estado (notification_deliveries, delivery_attempts) —
// 'email' y proveedor 'resend' ya estaban contemplados en su CHECK/comentario
// desde la migración 0002.
//
// Patrón Lazy Client (CLAUDE.md §5.4): el cliente de Resend NUNCA se
// construye al importar este módulo. Solo se valida la config al cargar
// (isConfigured) y el cliente real se instancia perezosamente en el primer
// envío. Sin RESEND_API_KEY, el canal se salta (estado 'skipped') sin
// afectar al resto del backend — igual que Push sin claves VAPID.
//
// Destinatarios: este canal NO decide a quién escribir. Consume
// resolveRecipients() (services/email/recipientResolver.js) — la estrategia
// de resolución puede evolucionar sin tocar este archivo.

import { Resend } from 'resend';
import { resolveRecipients } from '../email/recipientResolver.js';
import { renderTemplate } from '../email/templates.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OPS_FROM        = process.env.INLOP_OPS_FROM || 'INLOP <notificaciones@inlop.com.co>';
const EMAIL_CONFIGURADO = Boolean(RESEND_API_KEY);

if (!EMAIL_CONFIGURADO) {
  console.warn('[emailChannel] ⚠️  RESEND_API_KEY no configurada — canal Email deshabilitado.');
}

let _client = null;
function _getClient() {
  if (!_client) _client = new Resend(RESEND_API_KEY);
  return _client;
}

async function send(delivery, event, { sbFetch, sbAuthAdmin }) {
  if (!EMAIL_CONFIGURADO) return;
  const inicio = Date.now();
  try {
    const recipients = await resolveRecipients(event, { sbAuthAdmin });

    if (!recipients.length) {
      await _registrarIntento(delivery.id, {
        numIntento: 1, resultado: 'skip', error: 'Sin destinatarios resueltos', latenciaMs: Date.now() - inicio,
      }, { sbFetch }).catch(() => {});
      await _updateDelivery(delivery.id, 'skipped', 0, null, { sbFetch });
      return;
    }

    const resultados = await Promise.allSettled(
      recipients.map(r => _sendToRecipient(r, event))
    );
    const hayExito   = resultados.some(r => r.status === 'fulfilled');
    const latenciaMs = Date.now() - inicio;

    await _registrarIntento(delivery.id, {
      numIntento:  1,
      resultado:   hayExito ? 'ok' : 'error',
      error:       hayExito ? null : 'Todos los envíos fallaron',
      latenciaMs,
    }, { sbFetch });
    await _updateDelivery(
      delivery.id,
      hayExito ? 'delivered' : 'failed',
      1,
      hayExito ? null : 'Todos los envíos fallaron',
      { sbFetch }
    );
  } catch (err) {
    const latenciaMs = Date.now() - inicio;
    await _registrarIntento(delivery.id, { numIntento: 1, resultado: 'error', error: err.message, latenciaMs }, { sbFetch }).catch(() => {});
    await _updateDelivery(delivery.id, 'failed', 1, err.message, { sbFetch }).catch(() => {});
  }
}

async function _sendToRecipient(recipient, event) {
  const { subject, html } = renderTemplate(event.tipo, recipient.audiencia, event);
  try {
    const { error } = await _getClient().emails.send({
      from:    OPS_FROM,
      to:      recipient.email,
      subject,
      html,
    });
    if (error) throw new Error(error.message || 'Resend rechazó el envío');
  } catch (err) {
    console.error(`[emailChannel] ❌ ${recipient.email}:`, err.message);
    throw err;
  }
}

async function _updateDelivery(deliveryId, estado, intentos, errorMsg, { sbFetch }) {
  await sbFetch(`/notification_deliveries?id=eq.${encodeURIComponent(deliveryId)}`, 'PATCH', {
    estado,
    intentos,
    ultimo_intento: new Date().toISOString(),
    ...(errorMsg ? { error_ultimo: errorMsg } : {}),
  });
}

async function _registrarIntento(deliveryId, { numIntento, resultado, error, latenciaMs }, { sbFetch }) {
  await sbFetch('/delivery_attempts', 'POST', [{
    delivery_id:  deliveryId,
    num_intento:  numIntento,
    resultado,
    error:        error || null,
    latencia_ms:  latenciaMs,
    codigo_http:  null,
    proveedor_id: 'resend',
  }]);
}

export default { send };
