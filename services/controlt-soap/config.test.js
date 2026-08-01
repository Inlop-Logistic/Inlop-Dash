import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getConfig, _resetConfig } from './config.js';

// Restaurar env y cache antes de cada test
beforeEach(() => {
  _resetConfig();
  delete process.env.CONTROLT_SOAP_USER;
  delete process.env.CONTROLT_SOAP_PASS;
  delete process.env.CONTROLT_SOAP_TIMEOUT_MS;
});

// ── Configuración válida ───────────────────────────────────────────────────

test('retorna config cuando todas las vars requeridas están presentes', () => {
  process.env.CONTROLT_SOAP_USER = 'usuario_test';
  process.env.CONTROLT_SOAP_PASS = 'clave_test';

  const cfg = getConfig();

  assert.equal(cfg.user, 'usuario_test');
  assert.equal(cfg.pass, 'clave_test');
  assert.equal(cfg.timeoutMs, 10_000); // default
  assert.equal(cfg.endpoint, 'http://app.controlt.com.co/WS/service.asmx');
  assert.equal(cfg.namespace, 'http://controlt.com.co/');
});

test('acepta CONTROLT_SOAP_TIMEOUT_MS personalizado', () => {
  process.env.CONTROLT_SOAP_USER = 'u';
  process.env.CONTROLT_SOAP_PASS = 'p';
  process.env.CONTROLT_SOAP_TIMEOUT_MS = '15000';

  const cfg = getConfig();
  assert.equal(cfg.timeoutMs, 15_000);
});

test('la config retornada es inmutable (Object.freeze)', () => {
  process.env.CONTROLT_SOAP_USER = 'u';
  process.env.CONTROLT_SOAP_PASS = 'p';

  const cfg = getConfig();
  assert.throws(() => { cfg.user = 'otro'; }, TypeError);
});

test('getConfig() retorna el mismo objeto en llamadas sucesivas (singleton)', () => {
  process.env.CONTROLT_SOAP_USER = 'u';
  process.env.CONTROLT_SOAP_PASS = 'p';

  const a = getConfig();
  const b = getConfig();
  assert.strictEqual(a, b);
});

// ── Validación de vars requeridas ─────────────────────────────────────────

test('lanza error si CONTROLT_SOAP_USER falta', () => {
  process.env.CONTROLT_SOAP_PASS = 'p';

  assert.throws(
    () => getConfig(),
    (err) => {
      assert.ok(err.message.includes('CONTROLT_SOAP_USER'));
      return true;
    }
  );
});

test('lanza error si CONTROLT_SOAP_PASS falta', () => {
  process.env.CONTROLT_SOAP_USER = 'u';

  assert.throws(
    () => getConfig(),
    (err) => {
      assert.ok(err.message.includes('CONTROLT_SOAP_PASS'));
      return true;
    }
  );
});

test('lanza error si CONTROLT_SOAP_USER está vacía', () => {
  process.env.CONTROLT_SOAP_USER = '';
  process.env.CONTROLT_SOAP_PASS = 'p';

  assert.throws(() => getConfig(), Error);
});

// ── Validación de TIMEOUT_MS ──────────────────────────────────────────────

test('lanza error si CONTROLT_SOAP_TIMEOUT_MS es menor a 1 000', () => {
  process.env.CONTROLT_SOAP_USER = 'u';
  process.env.CONTROLT_SOAP_PASS = 'p';
  process.env.CONTROLT_SOAP_TIMEOUT_MS = '500';

  assert.throws(
    () => getConfig(),
    (err) => {
      assert.ok(err.message.includes('1 000'));
      return true;
    }
  );
});

test('lanza error si CONTROLT_SOAP_TIMEOUT_MS supera 60 000', () => {
  process.env.CONTROLT_SOAP_USER = 'u';
  process.env.CONTROLT_SOAP_PASS = 'p';
  process.env.CONTROLT_SOAP_TIMEOUT_MS = '61000';

  assert.throws(
    () => getConfig(),
    (err) => {
      assert.ok(err.message.includes('60 000'));
      return true;
    }
  );
});

test('usa 10 000 ms si CONTROLT_SOAP_TIMEOUT_MS no está definida', () => {
  process.env.CONTROLT_SOAP_USER = 'u';
  process.env.CONTROLT_SOAP_PASS = 'p';

  assert.equal(getConfig().timeoutMs, 10_000);
});
