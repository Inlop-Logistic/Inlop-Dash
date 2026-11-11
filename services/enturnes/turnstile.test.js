/**
 * Unit tests for turnstile.js (Enturne de Vehículos)
 * Run: node --test services/enturnes/turnstile.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarTurnstile, TURNSTILE_VERIFY_URL, TURNSTILE_HOSTNAME_ESPERADO, TURNSTILE_ACCION_ESPERADA } from './turnstile.js';

function respuestaCloudflare(body, status = 200) {
  return async () => ({ status, json: async () => body });
}

test('token ausente: rechaza sin llamar a fetch', async () => {
  let llamado = false;
  const r = await verificarTurnstile({
    token: '',
    secretKey: 'secret',
    fetchConTimeout: async () => { llamado = true; },
  });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'token_ausente');
  assert.equal(llamado, false);
});

test('token solo espacios: se trata como ausente', async () => {
  const r = await verificarTurnstile({ token: '   ', secretKey: 'secret', fetchConTimeout: async () => { throw new Error('no debería llamarse'); } });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'token_ausente');
});

test('token válido, hostname y action correctos: acepta', async () => {
  const r = await verificarTurnstile({
    token: 'tok-valido',
    secretKey: 'secret',
    ip: '203.0.113.5',
    fetchConTimeout: respuestaCloudflare({ success: true, hostname: TURNSTILE_HOSTNAME_ESPERADO, action: TURNSTILE_ACCION_ESPERADA }),
  });
  assert.equal(r.ok, true);
});

test('envía secret, response e remoteip al endpoint oficial de Cloudflare', async () => {
  let urlLlamada, bodyEnviado;
  const r = await verificarTurnstile({
    token: 'tok-abc',
    secretKey: 'mi-secret',
    ip: '203.0.113.9',
    fetchConTimeout: async (url, opts) => {
      urlLlamada = url;
      bodyEnviado = opts.body;
      return { status: 200, json: async () => ({ success: true, hostname: TURNSTILE_HOSTNAME_ESPERADO, action: TURNSTILE_ACCION_ESPERADA }) };
    },
  });
  assert.equal(r.ok, true);
  assert.equal(urlLlamada, TURNSTILE_VERIFY_URL);
  const params = new URLSearchParams(bodyEnviado);
  assert.equal(params.get('secret'), 'mi-secret');
  assert.equal(params.get('response'), 'tok-abc');
  assert.equal(params.get('remoteip'), '203.0.113.9');
});

test('Cloudflare responde success:false (inválido/expirado/reutilizado): rechaza', async () => {
  const r = await verificarTurnstile({
    token: 'tok-usado',
    secretKey: 'secret',
    fetchConTimeout: respuestaCloudflare({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'token_invalido');
});

test('hostname distinto al esperado: rechaza aunque success sea true', async () => {
  const r = await verificarTurnstile({
    token: 'tok',
    secretKey: 'secret',
    fetchConTimeout: respuestaCloudflare({ success: true, hostname: 'otro-dominio.example', action: TURNSTILE_ACCION_ESPERADA }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'hostname_inesperado');
});

test('action distinto al esperado: rechaza aunque success y hostname sean correctos', async () => {
  const r = await verificarTurnstile({
    token: 'tok',
    secretKey: 'secret',
    fetchConTimeout: respuestaCloudflare({ success: true, hostname: TURNSTILE_HOSTNAME_ESPERADO, action: 'otra-accion' }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'accion_inesperada');
});

test('Cloudflare inalcanzable (timeout/red caída): rechaza, fail-closed', async () => {
  const r = await verificarTurnstile({
    token: 'tok',
    secretKey: 'secret',
    fetchConTimeout: async () => { throw new Error('fetch failed: timeout'); },
  });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'servicio_no_disponible');
});

test('Cloudflare responde un body no-JSON: rechaza, no revienta', async () => {
  const r = await verificarTurnstile({
    token: 'tok',
    secretKey: 'secret',
    fetchConTimeout: async () => ({ status: 200, json: async () => { throw new Error('body no es JSON'); } }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'respuesta_invalida');
});
