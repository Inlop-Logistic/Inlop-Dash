/**
 * Unit tests for clienteFiltro.js
 * Run: node --test services/reportes/clienteFiltro.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarClienteFiltro } from './clienteFiltro.js';

// ── Las 4 variantes del ejemplo de Fase 11A convergen en la misma clave ────

test('reconoce como el mismo cliente las 4 variantes de "Productos Ramo SAS"', () => {
  const variantes = [
    'Productos Ramo SAS',
    'Productos Ramo S.A.S.',
    'PRODUCTOS RAMO SAS',
    'Productos Ramo S A S',
  ];
  const claves = variantes.map(normalizarClienteFiltro);
  assert.equal(new Set(claves).size, 1, `Todas deberían converger, obtuve: ${JSON.stringify(claves)}`);
  assert.equal(claves[0], 'PRODUCTOS RAMO SAS');
});

// ── No fusiona clientes distintos (normalización no agresiva) ──────────────

test('NO fusiona clientes con nombres distintos', () => {
  assert.notEqual(normalizarClienteFiltro('Productos Ramo SAS'), normalizarClienteFiltro('Productos Rueda SAS'));
  assert.notEqual(normalizarClienteFiltro('Conquers'), normalizarClienteFiltro('Conqers'));
});

test('NO colapsa letras sueltas que no están al final del nombre', () => {
  // "S A S" en medio del nombre (no es sufijo societario) se conserva tal cual
  // — el colapso solo aplica al final de la cadena.
  const out = normalizarClienteFiltro('S A S Distribuciones');
  assert.equal(out, 'S A S DISTRIBUCIONES');
});

// ── Casos borde ──────────────────────────────────────────────────────────────

test('valores vacíos, null o el placeholder "—" normalizan a cadena vacía', () => {
  assert.equal(normalizarClienteFiltro(''), '');
  assert.equal(normalizarClienteFiltro(null), '');
  assert.equal(normalizarClienteFiltro(undefined), '');
  assert.equal(normalizarClienteFiltro('—'), '');
});

test('otros sufijos espaciados también colapsan al final ("E U" → "EU")', () => {
  assert.equal(normalizarClienteFiltro('Transportes Rápidos E U'), normalizarClienteFiltro('Transportes Rápidos EU'));
});

test('mayúsculas/minúsculas y tildes no afectan la comparación', () => {
  assert.equal(normalizarClienteFiltro('Café Águila SAS'), normalizarClienteFiltro('CAFE AGUILA SAS'));
});
