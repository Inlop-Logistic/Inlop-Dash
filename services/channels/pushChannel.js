import webpush from 'web-push';

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     || 'mailto:soporte@inlop.com.co';
const PUSH_CONFIGURADO  = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (PUSH_CONFIGURADO) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('[pushChannel] ⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas — canal Push deshabilitado.');
}

async function send(delivery, event, { sbFetch }) {
  if (!PUSH_CONFIGURADO) return;
  const inicio = Date.now();
  try {
    const subs = await sbFetch(
      `/push_subscriptions?usuario_id=eq.${encodeURIComponent(event.usuario_id)}&activo=eq.true`
    ) || [];

    if (!subs.length) {
      await _updateDelivery(delivery.id, 'delivered', 0, null, { sbFetch });
      return;
    }

    const payload = JSON.stringify({
      title: event.titulo,
      body:  event.mensaje,
      action: event.pushPayload,
      tag:    event.pushPayload?.tag,
    });

    const resultados = await Promise.allSettled(
      subs.map(s => _sendToSub(s, payload, { sbFetch }))
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

async function _sendToSub(sub, payload, { sbFetch }) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await sbFetch(`/push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`, 'PATCH', { activo: false });
    } else {
      console.error(`[pushChannel] ❌ ${sub.endpoint.slice(0, 40)}…:`, err.message);
    }
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
    proveedor_id: 'web-push',
  }]);
}

export default { send };
