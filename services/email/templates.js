// Email Templates — Sprint 5.1 (Email Channel)
//
// Sin motor de plantillas: el proyecto no tiene ninguno instalado (ver
// package.json) y el estilo del backend es JS puro con dependencias mínimas
// (mismo criterio que pushChannel.js construyendo su payload con
// JSON.stringify inline).
//
// Contenido disponible HOY (validado en la auditoría, Punto 4 — sin cambios
// al contrato del payload de publishBusinessEvent): únicamente
// event.titulo y event.mensaje. `mensaje` ya viene redactado en texto plano
// desde _notifs()/index.js incluyendo código de solicitud, vehículo y
// conductor cuando aplica (ver index.js _notifs()) — no se inventan campos
// estructurados (codigo_solicitud, placa, conductor…) que el evento no trae.
// Cuando el dominio empiece a viajar datos estructurados en el evento, esta
// plantilla puede volverse específica por tipo sin romper su firma pública
// (tipo, audiencia, event) → { subject, html }.
//
// "Audiencia" = a quién va dirigido el correo para un mismo evento de
// negocio: 'cliente' (usuario del Portal Cliente) u 'ops' (INLOP interno).
// Hoy solo se diferencian en un pequeño rótulo — no hay datos distintos que
// mostrarle a cada una todavía.

const NAVY = '#012A6B';
const GRAY = '#6B7280';

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _htmlBase(titulo, contenidoHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F9FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${NAVY};padding:20px 28px;">
          <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.02em;">INLOP</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;color:${NAVY};font-size:18px;font-weight:600;">${_escapeHtml(titulo)}</h1>
          ${contenidoHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #F0F1F5;">
          <span style="color:${GRAY};font-size:12px;">INLOP · Ecosistema Logístico</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * @param {string} _tipo — event.tipo; reservado para especializar por tipo
 *   cuando el evento traiga datos estructurados (ver comentario de cabecera).
 * @param {'cliente'|'ops'} audiencia
 * @param {object} event
 * @returns {{ subject: string, html: string }}
 */
function renderTemplate(_tipo, audiencia, event) {
  const titulo = event.titulo || 'Notificación INLOP';
  const esOps  = audiencia === 'ops';

  const nota = esOps
    ? `<p style="margin:0 0 12px;color:${GRAY};font-size:12px;">Copia interna — evento del Portal Cliente.</p>`
    : '';

  return {
    subject: esOps ? `[INLOP] ${titulo}` : titulo,
    html: _htmlBase(titulo, `
      ${nota}
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.5;">${_escapeHtml(event.mensaje || '')}</p>
    `),
  };
}

export { renderTemplate };
