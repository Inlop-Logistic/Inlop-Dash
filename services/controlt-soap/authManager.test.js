import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getToken, invalidate, _resetAuth, _getTokenSnapshot } from './authManager.js';

// Helpers
const successLogin = (token = 'uuid-test-1234') => () => Promise.resolve(token);
const failLogin = (msg = 'Login falló') => () => Promise.reject(new Error(msg));

beforeEach(() => _resetAuth());

// ── Happy path ────────────────────────────────────────────────────────────────

test('retorna token cuando loginFn resuelve con éxito', async () => {
  const token = await getToken(successLogin('tok-abc'));
  assert.equal(token, 'tok-abc');
});

test('almacena el token en el singleton tras el primer login', async () => {
  await getToken(successLogin('tok-xyz'));
  assert.equal(_getTokenSnapshot(), 'tok-xyz');
});

test('retorna el mismo token en llamadas sucesivas sin invocar loginFn de nuevo', async () => {
  let callCount = 0;
  const loginFn = () => { callCount++; return Promise.resolve('tok-1'); };

  await getToken(loginFn);
  await getToken(loginFn);
  await getToken(loginFn);

  assert.equal(callCount, 1);
  assert.equal(_getTokenSnapshot(), 'tok-1');
});

// ── Invalidación ──────────────────────────────────────────────────────────────

test('invalidate() borra el token del singleton', async () => {
  await getToken(successLogin());
  invalidate();
  assert.equal(_getTokenSnapshot(), null);
});

test('tras invalidate(), getToken() vuelve a invocar loginFn', async () => {
  let callCount = 0;
  const loginFn = () => { callCount++; return Promise.resolve(`tok-${callCount}`); };

  await getToken(loginFn);   // primer login
  invalidate();
  const token2 = await getToken(loginFn); // segundo login

  assert.equal(callCount, 2);
  assert.equal(token2, 'tok-2');
});

test('invalidate() sin token activo no lanza excepción', () => {
  assert.doesNotThrow(() => invalidate());
});

// ── Deduplicación de Login concurrente ────────────────────────────────────────

test('llamadas concurrentes a getToken comparten el mismo in-flight Login', async () => {
  let callCount = 0;
  const loginFn = () => {
    callCount++;
    return new Promise((resolve) => setTimeout(() => resolve('tok-concurrent'), 10));
  };

  const [t1, t2, t3] = await Promise.all([
    getToken(loginFn),
    getToken(loginFn),
    getToken(loginFn),
  ]);

  assert.equal(callCount, 1);
  assert.equal(t1, 'tok-concurrent');
  assert.equal(t2, 'tok-concurrent');
  assert.equal(t3, 'tok-concurrent');
});

// ── Manejo de errores ─────────────────────────────────────────────────────────

test('lanza AuthError cuando loginFn rechaza', async () => {
  const { AuthError } = await import('./errors.js');
  await assert.rejects(
    () => getToken(failLogin('credenciales inválidas')),
    AuthError
  );
});

test('no almacena token cuando loginFn falla', async () => {
  try {
    await getToken(failLogin());
  } catch { /* esperado */ }
  assert.equal(_getTokenSnapshot(), null);
});

test('limpia _loginInProgress tras un fallo', async () => {
  try { await getToken(failLogin()); } catch { /* esperado */ }

  // La siguiente llamada debe intentar un nuevo login (no quedar colgada)
  let callCount = 0;
  const loginFn = () => { callCount++; return Promise.resolve('tok-recovery'); };
  const tok = await getToken(loginFn);

  assert.equal(callCount, 1);
  assert.equal(tok, 'tok-recovery');
});

test('todos los concurrent waiters reciben el mismo error cuando loginFn falla', async () => {
  const loginFn = () => new Promise((_, rej) =>
    setTimeout(() => rej(new Error('fallo de red')), 10)
  );

  const results = await Promise.allSettled([
    getToken(loginFn),
    getToken(loginFn),
    getToken(loginFn),
  ]);

  for (const r of results) {
    assert.equal(r.status, 'rejected');
  }
});

// ── Token vacío / inválido ────────────────────────────────────────────────────

test('lanza AuthError si loginFn retorna string vacío', async () => {
  const { AuthError } = await import('./errors.js');
  await assert.rejects(
    () => getToken(() => Promise.resolve('')),
    AuthError
  );
});

test('lanza AuthError si loginFn retorna null', async () => {
  const { AuthError } = await import('./errors.js');
  await assert.rejects(
    () => getToken(() => Promise.resolve(null)),
    AuthError
  );
});
