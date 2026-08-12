/**
 * Unit tests for services/gps/crypto.js
 * Run: node --test services/gps/crypto.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarToken, generarOtp, hashSecreto, compararHash } from './crypto.js';

test('generarToken produce un string base64url largo (256 bits) y distinto en cada llamada', () => {
  const a = generarToken();
  const b = generarToken();
  assert.equal(typeof a, 'string');
  assert.ok(a.length >= 40); // 32 bytes en base64url ronda los 43 caracteres
  assert.notEqual(a, b);
  assert.doesNotMatch(a, /[+/=]/); // base64url — sin caracteres inseguros en URL
});

test('generarOtp produce siempre 6 dígitos numéricos', () => {
  for (let i = 0; i < 200; i++) {
    const otp = generarOtp();
    assert.match(otp, /^\d{6}$/);
  }
});

test('generarOtp produce valores distintos en llamadas sucesivas (no es constante)', () => {
  const valores = new Set(Array.from({ length: 30 }, () => generarOtp()));
  assert.ok(valores.size > 1);
});

test('hashSecreto es determinista: mismo valor de entrada → mismo hash', () => {
  assert.equal(hashSecreto('abc123'), hashSecreto('abc123'));
});

test('hashSecreto produce hashes distintos para valores distintos', () => {
  assert.notEqual(hashSecreto('abc123'), hashSecreto('abc124'));
});

test('hashSecreto produce un hex de 64 caracteres (sha256)', () => {
  assert.match(hashSecreto('cualquier-cosa'), /^[0-9a-f]{64}$/);
});

test('compararHash: true solo cuando ambos hashes son iguales', () => {
  const h = hashSecreto('mi-token');
  assert.equal(compararHash(h, hashSecreto('mi-token')), true);
  assert.equal(compararHash(h, hashSecreto('otro-token')), false);
});

test('compararHash: false ante longitudes distintas o valores no-string, sin lanzar', () => {
  assert.equal(compararHash('abcd', 'abcdef'), false);
  assert.equal(compararHash(null, hashSecreto('x')), false);
  assert.equal(compararHash(hashSecreto('x'), undefined), false);
  assert.equal(compararHash('', ''), false);
});
