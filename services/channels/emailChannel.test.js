/**
 * Unit tests for services/channels/emailChannel.js
 * Run: node --test services/channels/emailChannel.test.js
 *
 * Sin RESEND_API_KEY en el entorno de test, `sendWithAttachment()` nunca
 * llega a instanciar el cliente real de Resend (Patrón Lazy Client — ver
 * cabecera del archivo) — se detiene en la validación temprana y devuelve
 * `{ok:false, skipped:true}` sin tocar la red. Esto acota lo que se puede
 * probar aquí SIN credenciales ni mockear el paquete `resend` (fuera de
 * alcance de Fase 11C — no se cambia el flag de test runner para habilitar
 * `mock.module`): el comportamiento de graceful-skip, y que la función
 * acepta y no revienta con la forma real de `attachments` (incluido el
 * `contentType` agregado en Fase 11C) sin necesitar la red.
 *
 * La verificación de que `contentType`/ausencia de `contentId` realmente
 * llegan como se espera al SDK de Resend vive en
 * services/reportes/envioManual.test.js (Fase 11C) — ese es el límite que
 * el proyecto controla e inyecta (deps.sendWithAttachment); este archivo
 * cubre el propio emailChannel.js de forma aislada.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendWithAttachment } from './emailChannel.js';

test('sendWithAttachment: sin RESEND_API_KEY configurada, se salta sin lanzar ni tocar la red', async () => {
  const out = await sendWithAttachment({
    to: ['a@x.com'],
    subject: 'Asunto',
    html: '<p>Cuerpo</p>',
    attachments: [{ filename: 'reporte.html', content: 'YQ==', contentType: 'application/octet-stream' }],
  });
  assert.equal(out.ok, false);
  assert.equal(out.skipped, true);
  assert.match(out.error, /RESEND_API_KEY/);
});

test('sendWithAttachment: se salta igual sin destinatarios, antes de intentar nada más', async () => {
  const out = await sendWithAttachment({ to: [], subject: 'Asunto', html: '<p>x</p>' });
  assert.equal(out.ok, false);
  assert.equal(out.skipped, true);
  assert.match(out.error, /RESEND_API_KEY|Sin destinatarios/);
});

test('sendWithAttachment: acepta attachments con contentType (Fase 11C) sin lanzar', async () => {
  // No hay red real que verificar aquí (sin RESEND_API_KEY) — esta prueba
  // confirma que la función no revienta al recibir la forma exacta que
  // envioManual.js construye desde Fase 11C (contentType presente,
  // contentId ausente), no que Resend la interprete correctamente (eso
  // depende del propio SDK — ver JSDoc de sendWithAttachment y la auditoría
  // en services/reportes/envioManual.js#contentTypeAdjunto).
  await assert.doesNotReject(() => sendWithAttachment({
    to: ['a@x.com'],
    subject: 'Asunto',
    html: '<p>Cuerpo</p>',
    attachments: [
      { filename: 'reporte.xlsx', content: 'YQ==', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    ],
  }));
});

test('sendWithAttachment: sin attachments sigue siendo una llamada válida (adjunto opcional)', async () => {
  const out = await sendWithAttachment({ to: ['a@x.com'], subject: 'Asunto', html: '<p>x</p>' });
  assert.equal(out.ok, false); // se salta por falta de RESEND_API_KEY, no por la ausencia de adjuntos
  assert.equal(out.skipped, true);
});
