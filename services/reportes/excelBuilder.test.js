/**
 * Unit tests for excelBuilder.js
 * Run: node --test services/reportes/excelBuilder.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  generarExcel,
  generarExcelDeReporte,
  construirNombreArchivo,
  MIME_XLSX,
} from './excelBuilder.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function datosBase(overrides = {}) {
  return {
    columnas: [
      { campo: 'license_plate', titulo: 'Placa' },
      { campo: 'driver_name',   titulo: 'Conductor' },
    ],
    registros: [
      { license_plate: 'ABC123', driver_name: 'Juan Pérez' },
      { license_plate: 'XYZ789', driver_name: 'María López' },
    ],
    metadata: { tipoReporte: 'centro_gps', fechaEjecucion: '2026-08-11' },
    ...overrides,
  };
}

/** Lee de vuelta un buffer .xlsx con exceljs para verificar su contenido real. */
async function leerHoja(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets[0];
}

// ── Generación válida del Buffer ────────────────────────────────────────────

test('genera un Buffer válido con firma ZIP (.xlsx es un contenedor ZIP)', async () => {
  const { buffer } = await generarExcel(datosBase(), { nombre: 'Centro GPS' });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
  assert.equal(buffer.slice(0, 2).toString('ascii'), 'PK'); // firma de archivo ZIP/OOXML
});

test('el buffer generado es un .xlsx legible por exceljs (round-trip)', async () => {
  const { buffer } = await generarExcel(datosBase(), { nombre: 'Centro GPS' });
  const hoja = await leerHoja(buffer);
  assert.ok(hoja);
  assert.equal(hoja.rowCount, 3); // 1 encabezado + 2 registros
});

// ── Columnas, títulos y orden ────────────────────────────────────────────────

test('el encabezado usa los títulos configurados, en el orden configurado', async () => {
  const datos = datosBase({
    columnas: [
      { campo: 'driver_name',   titulo: 'Nombre del conductor' },
      { campo: 'license_plate', titulo: 'Placa del vehículo' },
    ],
  });
  const { buffer } = await generarExcel(datos, { nombre: 'Centro GPS' });
  const hoja = await leerHoja(buffer);
  const encabezado = hoja.getRow(1).values.slice(1); // values[0] es undefined (1-based)
  assert.deepEqual(encabezado, ['Nombre del conductor', 'Placa del vehículo']);
});

test('las columnas seleccionadas se respetan exactamente — sin columnas de más ni de menos', async () => {
  const datos = datosBase({ columnas: [{ campo: 'license_plate', titulo: 'Placa' }] });
  const { buffer } = await generarExcel(datos, { nombre: 'Centro GPS' });
  const hoja = await leerHoja(buffer);
  assert.equal(hoja.columnCount, 1);
  assert.equal(hoja.getRow(1).getCell(1).value, 'Placa');
});

// ── Registros filtrados ─────────────────────────────────────────────────────

test('las filas del Excel son exactamente los registros recibidos (ya filtrados)', async () => {
  const datos = datosBase({
    registros: [{ license_plate: 'SOLO1', driver_name: 'Único Conductor' }],
  });
  const { buffer } = await generarExcel(datos, { nombre: 'Centro GPS' });
  const hoja = await leerHoja(buffer);
  assert.equal(hoja.rowCount, 2); // encabezado + 1 fila
  assert.equal(hoja.getRow(2).getCell(1).value, 'SOLO1');
  assert.equal(hoja.getRow(2).getCell(2).value, 'Único Conductor');
});

test('reporte sin registros genera un Excel válido con solo el encabezado', async () => {
  const datos = datosBase({ registros: [] });
  const { buffer } = await generarExcel(datos, { nombre: 'Centro GPS' });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
  const hoja = await leerHoja(buffer);
  assert.equal(hoja.rowCount, 1); // solo encabezado, ningún dato
});

// ── Tipos de dato por campo ──────────────────────────────────────────────────

test('columnas de tipo fecha se escriben como fecha real (Date), no como texto', async () => {
  const datos = {
    columnas:  [{ campo: 'activated_on', titulo: 'Fecha de activación' }],
    registros: [{ activated_on: '08/11/2026 09:00:00' }], // MDY (viajes_activos)
    metadata:  { tipoReporte: 'viajes_activos', fechaEjecucion: '2026-08-11' },
  };
  const { buffer } = await generarExcel(datos, { nombre: 'Viajes activos' });
  const hoja = await leerHoja(buffer);
  const celda = hoja.getRow(2).getCell(1).value;
  assert.ok(celda instanceof Date);
  assert.equal(celda.getUTCFullYear?.() ?? celda.getFullYear(), 2026);
  // Columna de fecha con formato dd/mm/yyyy aplicado
  assert.equal(hoja.getColumn(1).numFmt, 'dd/mm/yyyy');
});

test('columnas de tipo booleano se muestran como Sí/No (legibilidad para el destinatario)', async () => {
  const datos = {
    columnas:  [{ campo: 'tiene_soporte', titulo: 'Tiene soporte' }],
    registros: [{ tiene_soporte: true }, { tiene_soporte: false }],
    metadata:  { tipoReporte: 'viajes_finalizados', fechaEjecucion: '2026-08-11' },
  };
  const { buffer } = await generarExcel(datos, { nombre: 'Viajes finalizados' });
  const hoja = await leerHoja(buffer);
  assert.equal(hoja.getRow(2).getCell(1).value, 'Sí');
  assert.equal(hoja.getRow(3).getCell(1).value, 'No');
});

test('valores vacíos producen celda vacía (null), no la cadena "null" o "undefined"', async () => {
  const datos = datosBase({ registros: [{ license_plate: null, driver_name: undefined }] });
  const { buffer } = await generarExcel(datos, { nombre: 'Centro GPS' });
  const hoja = await leerHoja(buffer);
  assert.equal(hoja.getRow(2).getCell(1).value, null);
  assert.equal(hoja.getRow(2).getCell(2).value, null);
});

// ── filename / mimeType ──────────────────────────────────────────────────────

test('mimeType es el de un .xlsx (OOXML spreadsheet)', async () => {
  const { mimeType } = await generarExcel(datosBase(), { nombre: 'Centro GPS' });
  assert.equal(mimeType, MIME_XLSX);
  assert.equal(mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('filename se deriva del nombre del reporte y la fecha de ejecución', async () => {
  const { filename } = await generarExcel(datosBase(), { nombre: 'Viajes Activos — Diario' });
  assert.equal(filename, 'viajes_activos_diario_2026-08-11.xlsx');
});

test('filename cae a tipo_reporte cuando el reporte no tiene nombre configurado', async () => {
  const { filename } = await generarExcel(datosBase(), { tipo_reporte: 'centro_gps' });
  assert.equal(filename, 'centro_gps_2026-08-11.xlsx');
});

test('construirNombreArchivo nunca usa un literal hardcodeado — cambia con el reporte y la fecha', () => {
  const a = construirNombreArchivo({ nombre: 'Solicitudes de hoy' }, { fechaEjecucion: '2026-01-05' }, 'xlsx');
  const b = construirNombreArchivo({ nombre: 'Programación semanal' }, { fechaEjecucion: '2026-12-25' }, 'xlsx');
  assert.equal(a, 'solicitudes_de_hoy_2026-01-05.xlsx');
  assert.equal(b, 'programacion_semanal_2026-12-25.xlsx');
  assert.notEqual(a, b);
});

test('construirNombreArchivo sin fechaEjecucion usa la fecha de hoy (Colombia) — nunca vacío', () => {
  const nombre = construirNombreArchivo({ nombre: 'X' }, {}, 'xlsx');
  assert.match(nombre, /^x_\d{4}-\d{2}-\d{2}\.xlsx$/);
});

// ── Pipeline completo: obtenerDatosReporte → generarExcel ──────────────────

test('generarExcelDeReporte encadena el pipeline completo (Fase 9B + 9C)', async () => {
  const reporte = {
    nombre:       'Centro GPS activo',
    tipo_reporte: 'centro_gps',
    filtros:      [],
    columnas:     [],
  };
  const deps = {
    viajesCache: [
      { trip_number: 'T1', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
    ],
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
    fechaEjecucion: '2026-08-11',
  };

  const { buffer, filename, mimeType } = await generarExcelDeReporte(reporte, deps);
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(filename, 'centro_gps_activo_2026-08-11.xlsx');
  assert.equal(mimeType, MIME_XLSX);

  const hoja = await leerHoja(buffer);
  assert.equal(hoja.rowCount, 2); // encabezado + 1 viaje monitoreable
});
