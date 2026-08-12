/**
 * Unit tests for columnResolver.js
 * Run: node --test services/reportes/columnResolver.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverColumnas } from './columnResolver.js';
import { camposDe } from './catalogoDatasets.js';

test('columnas=[] devuelve todas las seleccionableColumna en el orden del catálogo', () => {
  const out = resolverColumnas('centro_gps', []);
  // Fase 11A: cliente_normalizado es filtrable pero NO seleccionableColumna
  // (campo derivado solo para el filtro "Cliente", nunca una columna del
  // reporte) — "esperadas" debe filtrar igual que resolverColumnas().
  const esperadas = Object.entries(camposDe('centro_gps'))
    .filter(([, c]) => c.seleccionableColumna)
    .map(([campo]) => campo);
  assert.deepEqual(out.map(c => c.campo), esperadas);
  assert.deepEqual(out.map(c => c.titulo), esperadas.map(k => camposDe('centro_gps')[k].label));
});

test('columnas configuradas respetan campo, título y orden', () => {
  const columnas = [
    { campo: 'driver_name',   titulo: 'Nombre del conductor', orden: 1 },
    { campo: 'license_plate', titulo: 'Placa del vehículo',   orden: 0 },
  ];
  const out = resolverColumnas('centro_gps', columnas);
  assert.deepEqual(out, [
    { campo: 'license_plate', titulo: 'Placa del vehículo' },
    { campo: 'driver_name',   titulo: 'Nombre del conductor' },
  ]);
});

test('columna con campo inválido para el reporte actual se descarta', () => {
  const columnas = [
    { campo: 'license_plate',        titulo: 'Placa',    orden: 0 },
    { campo: 'estado_documental',    titulo: 'Restante',  orden: 1 }, // no existe en centro_gps
  ];
  const out = resolverColumnas('centro_gps', columnas);
  assert.deepEqual(out, [{ campo: 'license_plate', titulo: 'Placa' }]);
});

test('si ninguna columna configurada es válida, cae a todas las disponibles', () => {
  const columnas = [{ campo: 'estado_documental', titulo: 'Restante', orden: 0 }]; // ajeno a centro_gps
  const out = resolverColumnas('centro_gps', columnas);
  const esperadas = Object.entries(camposDe('centro_gps'))
    .filter(([, c]) => c.seleccionableColumna)
    .map(([campo]) => campo);
  assert.deepEqual(out.map(c => c.campo), esperadas);
});

test('tipo_reporte desconocido no lanza — devuelve arreglo vacío', () => {
  const out = resolverColumnas('inexistente', []);
  assert.deepEqual(out, []);
});

test('cliente_normalizado (Fase 11A) nunca aparece como columna — es solo-filtro', () => {
  for (const tipoReporte of ['viajes_activos', 'solicitudes', 'programacion', 'viajes_finalizados', 'centro_gps']) {
    const out = resolverColumnas(tipoReporte, []);
    assert.ok(!out.some(c => c.campo === 'cliente_normalizado'), `cliente_normalizado no debería ser columna de ${tipoReporte}`);
  }
});
