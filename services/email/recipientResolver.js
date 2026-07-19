// Recipient Resolver — Sprint 5.1 (Email Channel)
//
// Única fuente de verdad de "quién recibe el correo para este evento".
// emailChannel.js NUNCA decide destinatarios por sí mismo — solo consume el
// resultado de resolveRecipients(). Esto es intencional (aprobación de
// diseño Sprint 5.1): la estrategia de resolución va a evolucionar (roles,
// sede, empresa, múltiples destinatarios, configuración en base de datos)
// y ese cambio debe quedar aislado aquí, sin tocar el canal.
//
// Hoy (Sprint 5.1) la resolución es simple:
//   - audiencia 'ops'     → INLOP_OPS_EMAIL (env var; no hay tabla de
//                           configuración operativa en el dominio — ver
//                           auditoría: empresas_cliente no tiene email).
//   - audiencia 'cliente' → email del usuario dueño del evento, resuelto vía
//                           Supabase Auth Admin API (mismo mecanismo que ya
//                           usa GET /usuarios en index.js).

const OPS_EMAIL = process.env.INLOP_OPS_EMAIL || '';

if (!OPS_EMAIL) {
  console.warn('[recipientResolver] ⚠️  INLOP_OPS_EMAIL no configurada — destinatarios "ops" se omiten.');
}

// Qué audiencias recibe cada tipo de evento de negocio. Único punto donde
// se decide esto — no repetir el criterio en emailChannel ni en templates.
const EMAIL_AUDIENCES = {
  SOLICITUD_CREADA:    ['ops'],
  SERVICIO_CONFIRMADO: ['cliente', 'ops'],
  SERVICIO_COMPLETADO: ['cliente', 'ops'],
};

/**
 * @param {object} event — evento de negocio (event.tipo, event.usuario_id, …)
 * @param {{ sbAuthAdmin: Function }} deps
 * @returns {Promise<Array<{ email: string, audiencia: 'cliente'|'ops' }>>}
 */
async function resolveRecipients(event, { sbAuthAdmin }) {
  const audiencias = EMAIL_AUDIENCES[event.tipo] || [];
  const recipients = [];

  if (audiencias.includes('ops') && OPS_EMAIL) {
    recipients.push({ email: OPS_EMAIL, audiencia: 'ops' });
  }

  if (audiencias.includes('cliente') && event.usuario_id) {
    const email = await _resolveUserEmail(event.usuario_id, { sbAuthAdmin });
    if (email) recipients.push({ email, audiencia: 'cliente' });
  }

  return recipients;
}

// Mismo patrón que GET /usuarios en index.js: GoTrue no expone en este
// proyecto una lectura fiable por id individual desde este flujo, así que se
// trae la lista paginada y se filtra en memoria.
async function _resolveUserEmail(usuarioId, { sbAuthAdmin }) {
  const authData = await sbAuthAdmin('/admin/users?per_page=1000').catch(() => null);
  const user = (authData?.users || []).find(u => u.id === usuarioId);
  return user?.email || null;
}

export { resolveRecipients };
