/**
 * Unit tests for services/reportes/index.js — obtenerDatosReporte()
 * Run: node --test services/reportes/index.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerDatosReporte } from './index.js';

test('obtenerDatosReporte arma columnas/registros/metadata para viajes_activos', async () => {
  const viajesCache = [
    { trip_number: 'A1', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali',   type_operation: 'Granel Liquido' },
    { trip_number: 'A2', state_travel: 'completado',   origin_city_name: 'Bogotá', destiny_city_name: 'Bogotá', type_operation: 'Carga General'  },
  ];
  const deps = {
    viajesCache,
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: (s) => s ?? null,
    fechaEjecucion: '2026-08-11',
  };

  const reporte = {
    tipo_reporte: 'viajes_activos',
    filtros:  [{ campo: 'state_travel', operador: 'es', valor: 'en transíto' }],
    columnas: [
      { campo: 'trip_number',  titulo: 'Manifiesto', orden: 0 },
      { campo: 'linea_negocio', titulo: 'Operación',  orden: 1 },
    ],
  };

  const out = await obtenerDatosReporte(reporte, deps);

  assert.deepEqual(out.columnas, [
    { campo: 'trip_number',  titulo: 'Manifiesto' },
    { campo: 'linea_negocio', titulo: 'Operación' },
  ]);
  assert.equal(out.registros.length, 1);
  assert.equal(out.registros[0].trip_number, 'A1');
  assert.equal(out.registros[0].linea_negocio, 'Carga Líquida'); // enriquecido antes de filtrar/columnas

  assert.equal(out.metadata.tipoReporte, 'viajes_activos');
  assert.equal(out.metadata.totalRegistros, 1);
  assert.equal(out.metadata.totalDisponibles, 2); // dataset completo, antes de filtrar
  assert.equal(out.metadata.fechaEjecucion, '2026-08-11');
  assert.ok(out.metadata.generadoEn);
});

test('obtenerDatosReporte con columnas=[] usa todas las columnas del catálogo (misma semántica de Preview)', async () => {
  const deps = {
    viajesCache: [],
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
  };
  const reporte = { tipo_reporte: 'centro_gps', filtros: [], columnas: [] };
  const out = await obtenerDatosReporte(reporte, deps);
  assert.ok(out.columnas.length > 1);
  assert.equal(out.registros.length, 0);
});

test('obtenerDatosReporte exige tipo_reporte', async () => {
  await assert.rejects(() => obtenerDatosReporte({}, {}), /tipo_reporte/);
});

// ── Orden por fecha (Fase 9H) ────────────────────────────────────────────────

test('obtenerDatosReporte ordena por la columna de fecha seleccionada, DESC', async () => {
  const viajesCache = [
    { trip_number: 'A', activated_on: '01/05/2026 08:00:00', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
    { trip_number: 'C', activated_on: '03/20/2026 08:00:00', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
  ];
  const deps = {
    viajesCache,
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
  };
  const reporte = {
    tipo_reporte: 'viajes_activos',
    filtros: [],
    columnas: [
      { campo: 'trip_number',  titulo: 'Manifiesto', orden: 0 },
      { campo: 'activated_on', titulo: 'Fecha',       orden: 1 },
    ],
  };
  const out = await obtenerDatosReporte(reporte, deps);
  assert.deepEqual(out.registros.map(r => r.trip_number), ['B', 'C', 'A']);
});

test('obtenerDatosReporte sin columna de fecha seleccionada conserva el orden del dataset', async () => {
  const viajesCache = [
    { trip_number: 'A', activated_on: '01/05/2026 08:00:00', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
  ];
  const deps = {
    viajesCache,
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
  };
  const reporte = {
    tipo_reporte: 'viajes_activos',
    filtros: [],
    columnas: [{ campo: 'trip_number', titulo: 'Manifiesto', orden: 0 }],
  };
  const out = await obtenerDatosReporte(reporte, deps);
  assert.deepEqual(out.registros.map(r => r.trip_number), ['A', 'B']);
});
