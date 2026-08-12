/**
 * Unit tests for services/gps/rateLimiter.js
 * Run: node --test services/gps/rateLimiter.test.js
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { verificarLimite, _resetParaTests } from './rateLimiter.js';

beforeEach(() => { _resetParaTests(); });

test('permite hasta maxIntentos solicitudes dentro de la ventana', () => {
  const cfg = { maxIntentos: 3, ventanaMs: 60_000 };
  assert.equal(verificarLimite('clave-1', cfg).permitido, true);
  assert.equal(verificarLimite('clave-1', cfg).permitido, true);
  assert.equal(verificarLimite('clave-1', cfg).permitido, true);
});

test('bloquea la solicitud número maxIntentos+1 dentro de la misma ventana', () => {
  const cfg = { maxIntentos: 3, ventanaMs: 60_000 };
  verificarLimite('clave-2', cfg);
  verificarLimite('clave-2', cfg);
  verificarLimite('clave-2', cfg);
  const cuarta = verificarLimite('clave-2', cfg);
  assert.equal(cuarta.permitido, false);
  assert.equal(cuarta.restante, 0);
  assert.ok(cuarta.reintentarEnMs > 0);
});

test('claves distintas tienen contadores independientes', () => {
  const cfg = { maxIntentos: 1, ventanaMs: 60_000 };
  assert.equal(verificarLimite('a', cfg).permitido, true);
  assert.equal(verificarLimite('a', cfg).permitido, false); // agotada
  assert.equal(verificarLimite('b', cfg).permitido, true);  // independiente de "a"
});

test('la ventana expira y libera el contador', async () => {
  const cfg = { maxIntentos: 1, ventanaMs: 20 };
  assert.equal(verificarLimite('clave-ventana', cfg).permitido, true);
  assert.equal(verificarLimite('clave-ventana', cfg).permitido, false);
  await new Promise(r => setTimeout(r, 30));
  assert.equal(verificarLimite('clave-ventana', cfg).permitido, true);
});

test('restante decrece con cada solicitud permitida', () => {
  const cfg = { maxIntentos: 3, ventanaMs: 60_000 };
  assert.equal(verificarLimite('clave-restante', cfg).restante, 2);
  assert.equal(verificarLimite('clave-restante', cfg).restante, 1);
  assert.equal(verificarLimite('clave-restante', cfg).restante, 0);
});
