/**
 * services/reportes/envioManual.js — Ejecución manual de un reporte automático (Fase 9E)
 *
 * Flujo:
 *   reporteId → reporte (Supabase, validado activo/no-borrador)
 *             → obtenerDatosReporte()               [Fase 9B]
 *             → Excel/HTML según reporte.formato     [Fase 9C/9D]
 *             → resolver destinatarios (personal + externos, deduplicados)
 *             → sendWithAttachment() (emailChannel.js, Resend)
 *             → resultado { ok, ... } | { ok: false, codigo, error }
 *
 * Acción ad-hoc, manual — NO toca `proxima_ejecucion` ni `recurrencia`, NO
 * persiste historial de ejecución (sin escritura en notification_deliveries
 * ni tabla equivalente): es una decisión explícita de alcance (Fase 9E), no
 * un descuido. El scheduler (fase futura) es quien eventualmente tendrá su
 * propio registro de ejecuciones automáticas.
 */
import { generarExcelDeReporte } from './excelBuilder.js';
import { generarHtmlDeReporte, escapeHtml } from './htmlBuilder.js';
import { sendWithAttachment as sendWithAttachmentReal } from '../channels/emailChannel.js';

const FORMATOS_HTML = new Set(['html_filas', 'html_columnas']);

const NAVY = '#012A6B';
const GRAY = '#6B7280';

// ─── Destinatarios ────────────────────────────────────────────────────────────

/**
 * Resuelve los destinatarios finales de un envío a partir de
 * `reporte.destinatarios` ({ personal_ids, correos_externos }):
 *   - personal_ids  → tabla `personal` (activo=true), correo_compartido.
 *   - correos_externos → tal cual, ya validados por el wizard.
 *   - Deduplicación por correo (case-insensitive) SOLO para la lista final
 *     de envío — nunca oculta personas: `totalPersonal`/`totalExternos`
 *     siguen reflejando la selección real del wizard, sin deduplicar,
 *     para que la UI muestre las cantidades tal como el usuario las
 *     configuró.
 *
 * @param {{personal_ids?: string[], correos_externos?: string[]}} destinatarios
 * @param {{sbFetch: Function}} deps
 * @returns {Promise<{
 *   correosEnvio: string[],
 *   totalPersonal: number,
 *   totalExternos: number,
 *   personalSinCorreo: number,
 * }>}
 */
export async function resolverDestinatarios(destinatarios, deps) {
  const personalIds     = destinatarios?.personal_ids     ?? [];
  const correosExternos = destinatarios?.correos_externos ?? [];

  let personal = [];
  if (personalIds.length) {
    const filtro = personalIds.map(encodeURIComponent).join(',');
    personal = await deps.sbFetch(
      `/personal?id=in.(${filtro})&select=id,nombre,correo_compartido&activo=eq.true`
    ) || [];
  }

  const correosPersonal = personal.map(p => (p.correo_compartido || '').trim()).filter(Boolean);
  const personalSinCorreo = personalIds.length - correosPersonal.length;

  const vistos = new Set();
  const correosEnvio = [];
  for (const correo of [...correosPersonal, ...correosExternos]) {
    const clave = correo.trim().toLowerCase();
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    correosEnvio.push(correo.trim());
  }

  return {
    correosEnvio,
    totalPersonal: personalIds.length,
    totalExternos: correosExternos.length,
    personalSinCorreo: Math.max(personalSinCorreo, 0),
  };
}

// ─── Cuerpo del correo ──────────────────────────────────────────────────────
// Envolvente mínima, misma paleta e identidad que services/email/templates.js
// (Notification Orchestrator) — el cuerpo configurado por el usuario en el
// wizard (reporte.cuerpo) es texto plano, se escapa igual que en la Preview
// de Revisión (EtapaRevision.tsx, Fase 8B).

function construirCuerpoCorreo(reporte) {
  const cuerpoTexto = (reporte.cuerpo ?? '').trim();
  const parrafo = cuerpoTexto
    ? `<p style="margin:0;color:#374151;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(cuerpoTexto)}</p>`
    : `<p style="margin:0;color:${GRAY};font-size:13px;font-style:italic;">Adjunto encontrarás el reporte generado.</p>`;

  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background:#F8F9FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${NAVY};padding:20px 28px;">
          <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.02em;">INLOP</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;color:${NAVY};font-size:18px;font-weight:600;">${escapeHtml(reporte.nombre || 'Reporte')}</h1>
          ${parrafo}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #F0F1F5;">
          <span style="color:${GRAY};font-size:12px;">INLOP · Ecosistema Logístico — Reportes Automáticos</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Ejecución manual ───────────────────────────────────────────────────────

/**
 * Ejecuta manualmente un reporte automático: genera el archivo según su
 * `formato` y lo envía por correo a sus destinatarios configurados.
 *
 * No modifica el reporte (ni `proxima_ejecucion` ni `recurrencia` ni
 * ningún otro campo) — es una acción de solo lectura sobre
 * reportes_automaticos más un efecto externo (el envío).
 *
 * @param {string} reporteId
 * @param {{sbFetch: Function, viajesCache?: Array, tripCustomerCache?: Map,
 *   extraerTelefono?: Function, primerNombreCliente?: Function,
 *   sendWithAttachment?: Function}} deps — `sendWithAttachment` es
 *   inyectable (mismo patrón DI que el resto de 9B) y por defecto es la
 *   función real de emailChannel.js; los tests pasan una versión falsa sin
 *   necesitar RESEND_API_KEY ni tocar la red.
 * @returns {Promise<
 *   {ok: true, reporteId: string, nombre: string, formato: string, filename: string,
 *    destinatarios: {totalPersonal: number, totalExternos: number, totalEnviados: number}}
 *   | {ok: false, codigo: string, error: string}
 * >}
 */
export async function ejecutarReporteManual(reporteId, deps = {}) {
  const { sbFetch } = deps;
  const sendWithAttachment = deps.sendWithAttachment ?? sendWithAttachmentReal;
  if (!reporteId) return { ok: false, codigo: 'reporte_id_requerido', error: 'reporteId es obligatorio' };
  if (!sbFetch)    return { ok: false, codigo: 'deps_incompletas',   error: 'ejecutarReporteManual requiere sbFetch en deps' };

  // 1. El reporte existe, no es un borrador, y está activo.
  const filas = await sbFetch(`/reportes_automaticos?id=eq.${encodeURIComponent(reporteId)}&limit=1`);
  const reporte = filas?.[0];
  if (!reporte) {
    return { ok: false, codigo: 'no_encontrado', error: 'Reporte no encontrado' };
  }
  if (reporte.borrador) {
    return { ok: false, codigo: 'borrador', error: 'El reporte es un borrador — actívalo antes de enviarlo' };
  }
  if (!reporte.activo) {
    return { ok: false, codigo: 'inactivo', error: 'El reporte está inactivo' };
  }

  // 2. Destinatarios — deduplicados para el envío, sin ocultar personas en el conteo.
  const destinatarios = await resolverDestinatarios(reporte.destinatarios, deps);
  if (destinatarios.correosEnvio.length === 0) {
    return { ok: false, codigo: 'sin_destinatarios', error: 'El reporte no tiene destinatarios con correo válido' };
  }

  // 3. Generar el archivo — mismo pipeline de 9B, mismo builder de 9C/9D según formato.
  let archivo;
  try {
    archivo = FORMATOS_HTML.has(reporte.formato)
      ? await generarHtmlDeReporte(reporte, deps)
      : await generarExcelDeReporte(reporte, deps);
  } catch (err) {
    return { ok: false, codigo: 'error_generacion', error: `No se pudo generar el reporte: ${err.message}` };
  }

  // 4. Enviar por Resend (emailChannel.js) con el archivo adjunto.
  const asunto = reporte.asunto?.trim() || reporte.nombre || 'Reporte INLOP';
  const envio = await sendWithAttachment({
    to:      destinatarios.correosEnvio,
    subject: asunto,
    html:    construirCuerpoCorreo(reporte),
    attachments: [{
      filename: archivo.filename,
      content:  archivo.buffer.toString('base64'),
    }],
  });

  if (!envio.ok) {
    return { ok: false, codigo: 'error_envio', error: envio.error || 'Error al enviar el correo' };
  }

  return {
    ok: true,
    reporteId,
    nombre:   reporte.nombre,
    formato:  reporte.formato,
    filename: archivo.filename,
    destinatarios: {
      totalPersonal: destinatarios.totalPersonal,
      totalExternos: destinatarios.totalExternos,
      totalEnviados: destinatarios.correosEnvio.length,
    },
  };
}
