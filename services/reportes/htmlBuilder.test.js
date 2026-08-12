/**
 * Unit tests for htmlBuilder.js
 * Run: node --test services/reportes/htmlBuilder.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generarHtml,
  generarHtmlFilas,
  generarHtmlColumnas,
  generarHtmlDeReporte,
  MIME_HTML,
} from './htmlBuilder.js';

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

// ── html_filas — columnas, títulos, orden y registros ──────────────────────

test('html_filas: encabezados usan los títulos configurados, en el orden configurado', () => {
  const datos = datosBase({
    columnas: [
      { campo: 'driver_name',   titulo: 'Nombre del conductor' },
      { campo: 'license_plate', titulo: 'Placa del vehículo' },
    ],
  });
  const html = generarHtmlFilas(datos, { nombre: 'Centro GPS' });
  const encabezado = html.match(/<thead><tr>(.*?)<\/tr><\/thead>/s)[1];
  assert.deepEqual(
    [...encabezado.matchAll(/<th>(.*?)<\/th>/g)].map(m => m[1]),
    ['Nombre del conductor', 'Placa del vehículo']
  );
});

test('html_filas: una fila <tr> por registro, con las celdas en el orden de columnas', () => {
  const html = generarHtmlFilas(datosBase(), { nombre: 'Centro GPS' });
  const filas = html.match(/<tbody>(.*?)<\/tbody>/s)[1];
  const tr = [...filas.matchAll(/<tr>(.*?)<\/tr>/g)];
  assert.equal(tr.length, 2);
  const celdasFila1 = [...tr[0][1].matchAll(/<td>(.*?)<\/td>/g)].map(m => m[1]);
  assert.deepEqual(celdasFila1, ['ABC123', 'Juan Pérez']);
});

test('html_filas: solo las columnas configuradas aparecen — ni más ni menos', () => {
  const datos = datosBase({ columnas: [{ campo: 'license_plate', titulo: 'Placa' }] });
  const html = generarHtmlFilas(datos, { nombre: 'Centro GPS' });
  const encabezados = [...html.matchAll(/<th>(.*?)<\/th>/g)];
  assert.equal(encabezados.length, 1);
  assert.equal(encabezados[0][1], 'Placa');
});

// ── html_columnas — transposición correcta ──────────────────────────────────

test('html_columnas: cada registro es una columna, cada campo es una fila', () => {
  const html = generarHtmlColumnas(datosBase(), { nombre: 'Centro GPS' });
  const filas = html.match(/<tbody>(.*?)<\/tbody>/s)[1];
  const tr = [...filas.matchAll(/<tr>(.*?)<\/tr>/g)];
  assert.equal(tr.length, 2); // 2 campos = 2 filas

  // Fila 1 = campo "Placa": encabezado de fila + un valor por registro
  const fila1 = tr[0][1];
  assert.match(fila1, /<th scope="row">Placa<\/th>/);
  const valoresFila1 = [...fila1.matchAll(/<td>(.*?)<\/td>/g)].map(m => m[1]);
  assert.deepEqual(valoresFila1, ['ABC123', 'XYZ789']); // un valor por registro
});

test('html_columnas: la primera columna es el título del campo', () => {
  const html = generarHtmlColumnas(datosBase(), { nombre: 'Centro GPS' });
  assert.match(html, /<th scope="row">Placa<\/th>/);
  assert.match(html, /<th scope="row">Conductor<\/th>/);
});

test('html_columnas: encabezado de columnas tiene una entrada por registro', () => {
  const html = generarHtmlColumnas(datosBase(), { nombre: 'Centro GPS' });
  const encabezado = html.match(/<thead><tr>(.*?)<\/tr><\/thead>/s)[1];
  const th = [...encabezado.matchAll(/<th>(.*?)<\/th>/g)].map(m => m[1]);
  assert.deepEqual(th, ['Campo', 'Registro 1', 'Registro 2']);
});

// ── Escape de HTML ───────────────────────────────────────────────────────────

test('escapa datos de fila que contienen markup — nunca se interpretan como HTML', () => {
  const datos = datosBase({
    registros: [{ license_plate: '<script>alert(1)</script>', driver_name: 'A & B "C" <tag>' }],
  });
  const html = generarHtmlFilas(datos, { nombre: 'Centro GPS' });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('A &amp; B &quot;C&quot; &lt;tag&gt;'));
});

test('escapa títulos de columna configurados por el usuario', () => {
  const datos = datosBase({ columnas: [{ campo: 'license_plate', titulo: '<b>Placa</b> & Cía' }] });
  const html = generarHtmlFilas(datos, { nombre: 'Centro GPS' });
  assert.ok(!html.includes('<b>Placa</b>'));
  assert.ok(html.includes('&lt;b&gt;Placa&lt;/b&gt; &amp; Cía'));
});

test('escapa el nombre del reporte (usado como título del documento)', () => {
  const html = generarHtmlFilas(datosBase(), { nombre: '<img src=x onerror=alert(1)>' });
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('html_columnas también escapa los valores transpuestos', () => {
  const datos = datosBase({ registros: [{ license_plate: '<script>x</script>', driver_name: 'ok' }] });
  const html = generarHtmlColumnas(datos, { nombre: 'Centro GPS' });
  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
});

// ── Valores vacíos ────────────────────────────────────────────────────────────

test('valores vacíos (null/undefined/"") producen celda vacía, sin placeholder', () => {
  const datos = datosBase({ registros: [{ license_plate: null, driver_name: undefined }] });
  const html = generarHtmlFilas(datos, { nombre: 'Centro GPS' });
  const filas = html.match(/<tbody>(.*?)<\/tbody>/s)[1];
  const celdas = [...filas.matchAll(/<td>(.*?)<\/td>/g)].map(m => m[1]);
  assert.deepEqual(celdas, ['', '']);
  assert.ok(!html.includes('>—<')); // sin el placeholder "—" de la Preview del wizard
});

// ── Tipos de dato como texto ─────────────────────────────────────────────────

test('columnas de tipo fecha se formatean como DD/MM/YYYY', () => {
  const datos = {
    columnas:  [{ campo: 'activated_on', titulo: 'Fecha de activación' }],
    registros: [{ activated_on: '08/11/2026 09:00:00' }], // MDY (viajes_activos)
    metadata:  { tipoReporte: 'viajes_activos', fechaEjecucion: '2026-08-11' },
  };
  const html = generarHtmlFilas(datos, { nombre: 'Viajes activos' });
  assert.ok(html.includes('<td>11/08/2026</td>'));
});

test('columnas de tipo booleano se muestran como Sí/No', () => {
  const datos = {
    columnas:  [{ campo: 'tiene_soporte', titulo: 'Tiene soporte' }],
    registros: [{ tiene_soporte: true }, { tiene_soporte: false }],
    metadata:  { tipoReporte: 'viajes_finalizados', fechaEjecucion: '2026-08-11' },
  };
  const html = generarHtmlFilas(datos, { nombre: 'Viajes finalizados' });
  assert.ok(html.includes('<td>Sí</td>'));
  assert.ok(html.includes('<td>No</td>'));
});

// ── Cliente con nombres duplicados (Fase 9H) ────────────────────────────────

test('un valor de texto con el mismo nombre repetido por comas se normaliza en HTML', () => {
  const datos = {
    columnas:  [{ campo: 'company_customer_name', titulo: 'Cliente' }],
    registros: [{ company_customer_name: 'FRONTERA ENERGY COLOMBIA CORP, FRONTERA ENERGY COLOMBIA CORP' }],
    metadata:  { tipoReporte: 'viajes_activos', fechaEjecucion: '2026-08-11' },
  };
  const html = generarHtmlFilas(datos, { nombre: 'Viajes activos' });
  assert.ok(html.includes('<td>FRONTERA ENERGY COLOMBIA CORP</td>'));
  assert.ok(!html.includes('FRONTERA ENERGY COLOMBIA CORP, FRONTERA ENERGY COLOMBIA CORP'));
});

test('un valor de texto con clientes realmente distintos separados por coma no se altera en HTML', () => {
  const datos = {
    columnas:  [{ campo: 'company_customer_name', titulo: 'Cliente' }],
    registros: [{ company_customer_name: 'ACME S.A.S., FRONTERA ENERGY COLOMBIA CORP' }],
    metadata:  { tipoReporte: 'viajes_activos', fechaEjecucion: '2026-08-11' },
  };
  const html = generarHtmlFilas(datos, { nombre: 'Viajes activos' });
  assert.ok(html.includes('<td>ACME S.A.S., FRONTERA ENERGY COLOMBIA CORP</td>'));
});

// ── Sin registros ─────────────────────────────────────────────────────────────

test('html_filas sin registros: HTML válido, encabezados presentes, aviso de "sin registros"', () => {
  const datos = datosBase({ registros: [] });
  const html = generarHtmlFilas(datos, { nombre: 'Centro GPS' });
  assert.ok(html.includes('<th>Placa</th>'));
  assert.ok(html.includes('<th>Conductor</th>'));
  assert.ok(html.includes('Sin registros para este reporte.'));
  assert.match(html, /<tbody>\s*<\/tbody>/);
});

test('html_columnas sin registros: encabezados de campo presentes, aviso de "sin registros"', () => {
  const datos = datosBase({ registros: [] });
  const html = generarHtmlColumnas(datos, { nombre: 'Centro GPS' });
  assert.ok(html.includes('<th scope="row">Placa</th>'));
  assert.ok(html.includes('<th scope="row">Conductor</th>'));
  assert.ok(html.includes('Sin registros para este reporte.'));
});

test('reporte sin columnas ni registros sigue generando HTML autocontenido válido', () => {
  const datos = { columnas: [], registros: [], metadata: { tipoReporte: 'centro_gps', fechaEjecucion: '2026-08-11' } };
  const html = generarHtmlFilas(datos, { nombre: 'Vacío total' });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.ok(html.includes('Sin registros para este reporte.'));
});

// ── filename / mimeType ──────────────────────────────────────────────────────

test('mimeType es text/html', () => {
  const { mimeType } = generarHtml(datosBase(), { nombre: 'Centro GPS', formato: 'html_filas' });
  assert.equal(mimeType, MIME_HTML);
  assert.equal(mimeType, 'text/html');
});

test('filename se deriva del nombre del reporte y la fecha de ejecución', () => {
  const { filename } = generarHtml(datosBase(), { nombre: 'Viajes Activos — Diario', formato: 'html_filas' });
  assert.equal(filename, 'viajes_activos_diario_2026-08-11.html');
});

test('filename cae a tipo_reporte cuando el reporte no tiene nombre configurado', () => {
  const { filename } = generarHtml(datosBase(), { tipo_reporte: 'centro_gps' });
  assert.equal(filename, 'centro_gps_2026-08-11.html');
});

test('generarHtml se genera en memoria como Buffer', () => {
  const { buffer } = generarHtml(datosBase(), { nombre: 'Centro GPS' });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
  assert.match(buffer.toString('utf-8'), /^<!DOCTYPE html>/);
});

// ── Selección de formato (dispatcher) ────────────────────────────────────────

test('generarHtml usa reporte.formato cuando no se pasa formato explícito', () => {
  const { buffer } = generarHtml(datosBase(), { nombre: 'X', formato: 'html_columnas' });
  const html = buffer.toString('utf-8');
  assert.ok(html.includes('Registro 1'));
});

test('generarHtml cae a html_filas para cualquier formato que no sea html_columnas', () => {
  const { buffer: b1 } = generarHtml(datosBase(), { nombre: 'X', formato: 'excel' });
  const { buffer: b2 } = generarHtml(datosBase(), { nombre: 'X' }); // sin formato
  assert.ok(!b1.toString('utf-8').includes('Registro 1'));
  assert.ok(!b2.toString('utf-8').includes('Registro 1'));
});

test('el parámetro formatoOverride tiene prioridad sobre reporte.formato', () => {
  const { buffer } = generarHtml(datosBase(), { nombre: 'X', formato: 'html_filas' }, 'html_columnas');
  assert.ok(buffer.toString('utf-8').includes('Registro 1'));
});

// ── Pipeline completo: obtenerDatosReporte → generarHtml ───────────────────

test('generarHtmlDeReporte encadena el pipeline completo (Fase 9B + 9D)', async () => {
  const reporte = {
    nombre:       'Centro GPS activo',
    tipo_reporte: 'centro_gps',
    filtros:      [],
    columnas:     [],
    formato:      'html_columnas',
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

  const { buffer, filename, mimeType } = await generarHtmlDeReporte(reporte, deps);
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(filename, 'centro_gps_activo_2026-08-11.html');
  assert.equal(mimeType, MIME_HTML);

  const html = buffer.toString('utf-8');
  assert.ok(html.includes('Registro 1')); // formato transpuesto, según reporte.formato
  assert.ok(html.includes('T1'));
});
