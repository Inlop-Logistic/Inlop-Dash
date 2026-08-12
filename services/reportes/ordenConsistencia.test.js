/**
 * Unit tests — consistencia de orden entre Excel y HTML (Fase 9H)
 *
 * Excel (excelBuilder.js) y HTML (htmlBuilder.js) parten ambos de la misma
 * salida de obtenerDatosReporte() (services/reportes/index.js), que aplica
 * el orden por fecha (ordenReporte.js) una sola vez. Esta prueba de
 * integración verifica el resultado end-to-end: con una columna de fecha
 * seleccionada, ambos formatos deben listar los registros en el mismo
 * orden — sin volver a implementar el ordenamiento en cada builder.
 *
 * Run: node --test services/reportes/ordenConsistencia.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { generarExcelDeReporte } from './excelBuilder.js';
import { generarHtmlDeReporte }  from './htmlBuilder.js';

test('Excel y HTML listan los registros en el mismo orden (por fecha DESC) para el mismo reporte', async () => {
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
    fechaEjecucion: '2026-08-11',
  };
  const reporteBase = {
    nombre:       'Viajes activos',
    tipo_reporte: 'viajes_activos',
    filtros:      [],
    columnas: [
      { campo: 'trip_number',  titulo: 'Manifiesto', orden: 0 },
      { campo: 'activated_on', titulo: 'Fecha',       orden: 1 },
    ],
  };

  const { buffer: bufferExcel } = await generarExcelDeReporte(reporteBase, deps);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bufferExcel);
  const hoja = wb.worksheets[0];
  const ordenExcel = [];
  for (let fila = 2; fila <= hoja.rowCount; fila++) {
    ordenExcel.push(hoja.getRow(fila).getCell(1).value);
  }

  const { buffer: bufferHtml } = await generarHtmlDeReporte({ ...reporteBase, formato: 'html_filas' }, deps);
  const html = bufferHtml.toString('utf-8');
  const filas = html.match(/<tbody>(.*?)<\/tbody>/s)[1];
  const ordenHtml = [...filas.matchAll(/<td>([A-C])<\/td>/g)].map(m => m[1]);

  assert.deepEqual(ordenExcel, ['B', 'C', 'A']);
  assert.deepEqual(ordenHtml, ['B', 'C', 'A']);
  assert.deepEqual(ordenExcel, ordenHtml);
});

test('sin columna de fecha seleccionada, Excel y HTML conservan el mismo orden del dataset', async () => {
  const viajesCache = [
    { trip_number: 'A', activated_on: '01/05/2026 08:00:00', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
    { trip_number: 'B', activated_on: '08/11/2026 08:00:00', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
  ];
  const deps = {
    viajesCache,
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
    fechaEjecucion: '2026-08-11',
  };
  const reporteBase = {
    nombre:       'Viajes activos',
    tipo_reporte: 'viajes_activos',
    filtros:      [],
    columnas: [{ campo: 'trip_number', titulo: 'Manifiesto', orden: 0 }],
  };

  const { buffer: bufferExcel } = await generarExcelDeReporte(reporteBase, deps);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bufferExcel);
  const hoja = wb.worksheets[0];
  assert.equal(hoja.getRow(2).getCell(1).value, 'A');
  assert.equal(hoja.getRow(3).getCell(1).value, 'B');

  const { buffer: bufferHtml } = await generarHtmlDeReporte({ ...reporteBase, formato: 'html_filas' }, deps);
  const html = bufferHtml.toString('utf-8');
  const filas = html.match(/<tbody>(.*?)<\/tbody>/s)[1];
  const ordenHtml = [...filas.matchAll(/<td>([A-C])<\/td>/g)].map(m => m[1]);
  assert.deepEqual(ordenHtml, ['A', 'B']);
});
