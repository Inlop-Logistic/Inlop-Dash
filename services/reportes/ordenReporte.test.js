/**
 * Unit tests for services/reportes/ordenReporte.js
 * Run: node --test services/reportes/ordenReporte.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordenarPorFechaSeleccionada } from './ordenReporte.js';

// viajes_activos.activated_on es tipo fecha, formatoFecha: 'mdy' (MM/DD/YYYY).
const COLUMNAS_CON_FECHA = [
  { campo: 'trip_number',  titulo: 'Manifiesto' },
  { campo: 'activated_on', titulo: 'Fecha de activación' },
];
const COLUMNAS_SIN_FECHA = [
  { campo: 'trip_number', titulo: 'Manifiesto' },
];

test('ordena DESC (más reciente → más antiguo) cuando hay una columna de fecha seleccionada', () => {
  const registros = [
    { trip_number: 'A', activated_on: '01/05/2026 08:00:00' },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00' },
    { trip_number: 'C', activated_on: '03/20/2026 08:00:00' },
  ];
  const out = ordenarPorFechaSeleccionada(registros, COLUMNAS_CON_FECHA, 'viajes_activos');
  assert.deepEqual(out.map(r => r.trip_number), ['B', 'C', 'A']);
});

test('no reordena cuando no hay ninguna columna de fecha seleccionada — conserva el orden del dataset', () => {
  const registros = [
    { trip_number: 'A', activated_on: '01/05/2026 08:00:00' },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00' },
  ];
  const out = ordenarPorFechaSeleccionada(registros, COLUMNAS_SIN_FECHA, 'viajes_activos');
  assert.deepEqual(out.map(r => r.trip_number), ['A', 'B']);
});

test('registros sin fecha parseable van al final, sin inventarles una posición', () => {
  const registros = [
    { trip_number: 'A', activated_on: null },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00' },
    { trip_number: 'C', activated_on: 'no-es-una-fecha' },
  ];
  const out = ordenarPorFechaSeleccionada(registros, COLUMNAS_CON_FECHA, 'viajes_activos');
  assert.equal(out[0].trip_number, 'B');
  assert.deepEqual(new Set(out.slice(1).map(r => r.trip_number)), new Set(['A', 'C']));
});

test('resuelve el campo fecha desde el catálogo del tipo_reporte correcto — nunca asume "activated_on"', () => {
  // solicitudes usa "creado_en" (iso) como su campo fecha, no "activated_on".
  const columnas = [
    { campo: 'codigo_solicitud', titulo: 'Nro. solicitud' },
    { campo: 'creado_en',        titulo: 'Fecha de creación' },
  ];
  const registros = [
    { codigo_solicitud: 'S1', creado_en: '2026-01-05T00:00:00Z' },
    { codigo_solicitud: 'S2', creado_en: '2026-08-11T00:00:00Z' },
  ];
  const out = ordenarPorFechaSeleccionada(registros, columnas, 'solicitudes');
  assert.deepEqual(out.map(r => r.codigo_solicitud), ['S2', 'S1']);
});

test('con varias columnas de fecha seleccionadas usa la primera en el orden ya resuelto', () => {
  const columnas = [
    { campo: 'trip_number',     titulo: 'Manifiesto' },
    { campo: 'activated_on',    titulo: 'Fecha de activación' },
    { campo: 'fecha_cumplido',  titulo: 'Fecha de cumplido' },
  ];
  const registros = [
    { trip_number: 'A', activated_on: '01/05/2026 08:00:00', fecha_cumplido: '20/03/2026' },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00', fecha_cumplido: '05/01/2026' },
  ];
  const out = ordenarPorFechaSeleccionada(registros, columnas, 'viajes_finalizados');
  // Se ordena por activated_on (primera columna de fecha), no por fecha_cumplido.
  assert.deepEqual(out.map(r => r.trip_number), ['B', 'A']);
});

test('columnas=[] (todo el catálogo) también dispara el orden si el catálogo trae un campo fecha', () => {
  const catalogoCompleto = [
    { campo: 'trip_number',  titulo: 'Manifiesto' },
    { campo: 'license_plate', titulo: 'Placa' },
    { campo: 'activated_on', titulo: 'Fecha de activación' },
  ];
  const registros = [
    { trip_number: 'A', activated_on: '01/05/2026 08:00:00' },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00' },
  ];
  const out = ordenarPorFechaSeleccionada(registros, catalogoCompleto, 'viajes_activos');
  assert.deepEqual(out.map(r => r.trip_number), ['B', 'A']);
});

test('no muta el arreglo de registros recibido', () => {
  const registros = [
    { trip_number: 'A', activated_on: '01/05/2026 08:00:00' },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00' },
  ];
  const copia = [...registros];
  ordenarPorFechaSeleccionada(registros, COLUMNAS_CON_FECHA, 'viajes_activos');
  assert.deepEqual(registros, copia);
});
