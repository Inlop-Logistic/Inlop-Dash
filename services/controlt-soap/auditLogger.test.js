import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitive } from './auditLogger.js';

// ── redactSensitive ───────────────────────────────────────────────────────────

test('redacta campo "pass" en objeto plano', () => {
  const result = redactSensitive({ user: 'admin', pass: 'secreto' });
  assert.equal(result.pass, '[REDACTED]');
  assert.equal(result.user, 'admin');
});

test('redacta campo "token"', () => {
  const result = redactSensitive({ token: 'uuid-123', ok: true });
  assert.equal(result.token, '[REDACTED]');
  assert.equal(result.ok, true);
});

test('redacta campo "authToken"', () => {
  const result = redactSensitive({ authToken: 'abc', other: 'x' });
  assert.equal(result.authToken, '[REDACTED]');
});

test('redacta campo "authenticationToken"', () => {
  const result = redactSensitive({ authenticationToken: 'abc' });
  assert.equal(result.authenticationToken, '[REDACTED]');
});

test('redacta campo "password"', () => {
  const result = redactSensitive({ password: '1234' });
  assert.equal(result.password, '[REDACTED]');
});

test('redacta campo "Authorization"', () => {
  const result = redactSensitive({ Authorization: 'Bearer x' });
  assert.equal(result.Authorization, '[REDACTED]');
});

test('no redacta campos no-sensibles', () => {
  const input = { operacion: 'Login', duracionMs: 120, ok: true };
  const result = redactSensitive(input);
  assert.deepEqual(result, input);
});

test('redacta recursivamente en objetos anidados', () => {
  const input = { context: { pass: 'secret', safe: 'value' }, top: 'ok' };
  const result = redactSensitive(input);
  assert.equal(result.context.pass, '[REDACTED]');
  assert.equal(result.context.safe, 'value');
  assert.equal(result.top, 'ok');
});

test('maneja arrays correctamente (redacta dentro de cada elemento)', () => {
  const input = [{ token: 'abc' }, { safe: 'x' }];
  const result = redactSensitive(input);
  assert.equal(result[0].token, '[REDACTED]');
  assert.equal(result[1].safe, 'x');
});

test('retorna primitivos sin modificar', () => {
  assert.equal(redactSensitive('cadena'), 'cadena');
  assert.equal(redactSensitive(42), 42);
  assert.equal(redactSensitive(null), null);
  assert.equal(redactSensitive(true), true);
});

test('no muta el objeto original', () => {
  const original = { pass: 'secreto', user: 'admin' };
  redactSensitive(original);
  assert.equal(original.pass, 'secreto');
});

test('maneja objeto vacío', () => {
  assert.deepEqual(redactSensitive({}), {});
});

test('maneja array vacío', () => {
  assert.deepEqual(redactSensitive([]), []);
});
