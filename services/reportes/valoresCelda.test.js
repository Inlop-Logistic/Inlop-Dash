/**
 * Unit tests for services/reportes/valoresCelda.js
 * Run: node --test services/reportes/valoresCelda.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valorFecha, normalizarTextoDuplicado } from './valoresCelda.js';

// ── normalizarTextoDuplicado ────────────────────────────────────────────────

test('normalizarTextoDuplicado colapsa un cliente repetido (caso real reportado)', () => {
  const valor = 'FRONTERA ENERGY COLOMBIA CORP, FRONTERA ENERGY COLOMBIA CORP';
  assert.equal(normalizarTextoDuplicado(valor), 'FRONTERA ENERGY COLOMBIA CORP');
});

test('normalizarTextoDuplicado es insensible a mayúsculas/espacios al comparar, pero conserva la forma del primer token visto', () => {
  const valor = 'Acme S.A.S.,  acme s.a.s. ,ACME S.A.S.';
  assert.equal(normalizarTextoDuplicado(valor), 'Acme S.A.S.');
});

test('normalizarTextoDuplicado conserva una lista de clientes realmente distintos, sin tocar el orden', () => {
  const valor = 'ACME S.A.S., FRONTERA ENERGY COLOMBIA CORP';
  assert.equal(normalizarTextoDuplicado(valor), 'ACME S.A.S., FRONTERA ENERGY COLOMBIA CORP');
});

test('normalizarTextoDuplicado no toca un valor sin comas', () => {
  assert.equal(normalizarTextoDuplicado('ACME S.A.S.'), 'ACME S.A.S.');
});

test('normalizarTextoDuplicado ignora tokens vacíos producidos por comas colgantes', () => {
  assert.equal(normalizarTextoDuplicado('ACME S.A.S., ,ACME S.A.S.,'), 'ACME S.A.S.');
});

test('normalizarTextoDuplicado deja pasar valores no-string sin lanzar (null/number/etc.)', () => {
  assert.equal(normalizarTextoDuplicado(null), null);
  assert.equal(normalizarTextoDuplicado(undefined), undefined);
  assert.equal(normalizarTextoDuplicado(42), 42);
});

// ── valorFecha (regresión — ya usado por filterEngine/excelBuilder/htmlBuilder) ──

test('valorFecha respeta el formato mdy declarado en el catálogo', () => {
  const d = valorFecha('08/11/2026 09:00:00', { tipo: 'fecha', formatoFecha: 'mdy' });
  assert.equal(d.getUTCFullYear?.() ?? d.getFullYear(), 2026);
});

test('valorFecha devuelve null para un valor vacío', () => {
  assert.equal(valorFecha('', { tipo: 'fecha' }), null);
  assert.equal(valorFecha(null, { tipo: 'fecha' }), null);
});
