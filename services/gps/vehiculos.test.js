/**
 * Unit tests for services/gps/vehiculos.js
 * Run: node --test services/gps/vehiculos.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerPlacas, CAMPO_PLACA_POR_REPORTE } from './vehiculos.js';

test('viajes_activos / centro_gps / programacion / viajes_finalizados usan license_plate', () => {
  for (const tipo of ['viajes_activos', 'centro_gps', 'programacion', 'viajes_finalizados']) {
    assert.equal(CAMPO_PLACA_POR_REPORTE[tipo], 'license_plate');
  }
});

test('solicitudes usa placa_asignada (no está en el catálogo de columnas, pero sí en el registro)', () => {
  assert.equal(CAMPO_PLACA_POR_REPORTE.solicitudes, 'placa_asignada');
});

test('extraerPlacas resuelve el campo correcto por tipo_reporte', () => {
  const registros = [{ license_plate: 'ABC123' }, { license_plate: 'XYZ789' }];
  assert.deepEqual(extraerPlacas(registros, 'viajes_activos'), ['ABC123', 'XYZ789']);
});

test('extraerPlacas usa placa_asignada para solicitudes', () => {
  const registros = [{ placa_asignada: 'ABC123', license_plate: 'NO_DEBE_USARSE' }];
  assert.deepEqual(extraerPlacas(registros, 'solicitudes'), ['ABC123']);
});

test('extraerPlacas deduplica, normaliza a mayúsculas y conserva el orden de primera aparición', () => {
  const registros = [
    { license_plate: 'abc123' },
    { license_plate: 'XYZ789' },
    { license_plate: 'ABC123' }, // mismo vehículo, distinta capitalización
  ];
  assert.deepEqual(extraerPlacas(registros, 'viajes_activos'), ['ABC123', 'XYZ789']);
});

test('extraerPlacas ignora null/undefined/vacío/no-string sin lanzar', () => {
  const registros = [
    { license_plate: null },
    { license_plate: undefined },
    { license_plate: '' },
    { license_plate: '   ' },
    { license_plate: 42 },
    { license_plate: 'REAL01' },
  ];
  assert.deepEqual(extraerPlacas(registros, 'viajes_activos'), ['REAL01']);
});

test('extraerPlacas devuelve [] para un tipo_reporte desconocido', () => {
  assert.deepEqual(extraerPlacas([{ license_plate: 'ABC123' }], 'reporte_inexistente'), []);
});

test('extraerPlacas devuelve [] si no hay registros con placa (ej. solicitudes sin vehículo asignado)', () => {
  const registros = [{ codigo_solicitud: 'S1', placa_asignada: null }, { codigo_solicitud: 'S2' }];
  assert.deepEqual(extraerPlacas(registros, 'solicitudes'), []);
});

test('extraerPlacas devuelve [] ante input no-array, sin lanzar', () => {
  assert.deepEqual(extraerPlacas(null, 'viajes_activos'), []);
  assert.deepEqual(extraerPlacas(undefined, 'viajes_activos'), []);
});
