// Recipient Resolver — Sprint 5.1 (Email Channel) · actualizado Sprint 5.2
//
// Única fuente de verdad de "quién recibe el correo para este evento".
// emailChannel.js NUNCA decide destinatarios por sí mismo — solo consume el
// resultado de resolveRecipients(). Esto es intencional (aprobación de
// diseño Sprint 5.1): la estrategia de resolución va a evolucionar (roles,
// sede, empresa, múltiples destinatarios, configuración en base de datos)
// y ese cambio debe quedar aislado aquí, sin tocar el canal.
//
// Hoy (Sprint 5.2) la resolución es:
//   - audiencia 'ops'     → INLOP_OPS_EMAIL (env var; soporta una o varias
//                           direcciones separadas por coma). Normalizado via
//                           _parseOpsEmails() — sin duplicados, sin vacíos,
//                           sin espacios, con validación básica de formato.
//   - audiencia 'cliente' → email del usuario dueño del evento, resuelto vía
//                           Supabase Auth Admin API (mismo mecanismo que ya
//                           usa GET /usuarios en index.js).

const OPS_EMAIL_RAW = process.env.INLOP_OPS_EMAIL || '';

// _parseOpsEmails: normaliza la variable de entorno en una lista limpia.
//   - Separa por coma (soporta 1..N direcciones).
//   - Aplica trim() a cada token.
//   - Descarta tokens vacíos.
//   - Descarta direcciones con formato inválido (sin '@' y sin '.') para que
//     un valor mal configurado no bloquee el envío al resto.
//   - Elimina duplicados (case-insensitive: "A@X.com" y "a@x.com" → 1 entrada).
//   - Compatible con una sola dirección: comportamiento idéntico al anterior.
function _parseOpsEmails(raw) {
  const seen = new Set();
  return raw
    .split(',')
    .map(e => e.trim())
    .filter(e => {
      if (!e) return false;
      // Validación mínima: debe contener '@' y al menos un '.' posterior.
      if (!e.includes('@') || !e.slice(e.indexOf('@')).includes('.')) {
        console.warn(`[recipientResolver] ⚠️  Dirección ignorada (formato inválido): "${e}"`);
        return false;
      }
      // Deduplicación case-insensitive.
      const key = e.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const OPS_EMAILS = _parseOpsEmails(OPS_EMAIL_RAW);

if (!OPS_EMAILS.length) {
  console.warn('[recipientResolver] ⚠️  INLOP_OPS_EMAIL no configurada o sin direcciones válidas — destinatarios "ops" se omiten.');
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

  if (audiencias.includes('ops')) {
    for (const email of OPS_EMAILS) {
      recipients.push({ email, audiencia: 'ops' });
    }
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
