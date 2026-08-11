/**
 * Unit tests for filterEngine.js
 * Run: node --test services/reportes/filterEngine.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarFiltros, evaluaCondicion, fechaCampoYMD } from './filterEngine.js';
import { camposDe } from './catalogoDatasets.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VIAJES = [
  { trip_number: 'A1', state_travel: 'en transíto', linea_negocio: null, type_operation: 'Granel Liquido', activated_on: '08/11/2026 09:00:00', last_alarm_name: 'Pánico' },
  { trip_number: 'A2', state_travel: 'completado',   linea_negocio: null, type_operation: 'Carga General',  activated_on: '07/11/2026 09:00:00', last_alarm_name: '' },
  { trip_number: 'A3', state_travel: 'en transíto', linea_negocio: null, type_operation: 'Granel Solido',   activated_on: '09/11/2026 09:00:00', last_alarm_name: null },
];

// ── Sin filtros / filtros vacíos ────────────────────────────────────────────

test('sin filtros devuelve las filas sin tocar', () => {
  const out = aplicarFiltros(VIAJES, [], 'viajes_activos');
  assert.equal(out, VIAJES); // misma referencia — no clona innecesariamente
});

test('filtro sin campo (aún no configurado) no restringe', () => {
  const filtros = [{ campo: '', operador: 'es', valor: null }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.equal(out.length, 3);
});

test('filtro sobre un campo no filtrable se ignora', () => {
  const filtros = [{ campo: 'trip_number', operador: 'es', valor: 'A1' }]; // trip_number: filtrable=false
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.equal(out.length, 3);
});

test('filtro de un reporte distinto (campo inexistente en este catálogo) se ignora', () => {
  const filtros = [{ campo: 'estado_documental', operador: 'es', valor: 'aprobado' }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.equal(out.length, 3);
});

// ── Enum / texto: es / no_es ────────────────────────────────────────────────

test('operador "es" filtra por igualdad exacta', () => {
  const filtros = [{ campo: 'state_travel', operador: 'es', valor: 'completado' }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.deepEqual(out.map(v => v.trip_number), ['A2']);
});

test('operador "no_es" excluye el valor indicado', () => {
  const filtros = [{ campo: 'state_travel', operador: 'no_es', valor: 'completado' }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.deepEqual(out.map(v => v.trip_number), ['A1', 'A3']);
});

test('"es" sin valor configurado (incompleto) no restringe', () => {
  const filtros = [{ campo: 'state_travel', operador: 'es', valor: null }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.equal(out.length, 3);
});

// ── Booleano: tiene_valor / sin_valor ───────────────────────────────────────

test('"tiene_valor" incluye solo filas con valor no vacío', () => {
  const filtros = [{ campo: 'last_alarm_name', operador: 'tiene_valor' }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.deepEqual(out.map(v => v.trip_number), ['A1']);
});

test('"sin_valor" incluye filas sin valor (vacío, null o false)', () => {
  const filtros = [{ campo: 'last_alarm_name', operador: 'sin_valor' }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.deepEqual(out.map(v => v.trip_number), ['A2', 'A3']);
});

test('booleano real (false) se trata como "sin valor"', () => {
  const filas = [{ tiene_soporte: true }, { tiene_soporte: false }];
  const filtros = [{ campo: 'tiene_soporte', operador: 'sin_valor' }];
  const out = aplicarFiltros(filas, filtros, 'viajes_finalizados');
  assert.equal(out.length, 1);
  assert.equal(out[0].tiene_soporte, false);
});

// ── AND entre múltiples filtros ─────────────────────────────────────────────

test('múltiples filtros se combinan en AND', () => {
  const filtros = [
    { campo: 'state_travel',   operador: 'es', valor: 'en transíto' },
    { campo: 'last_alarm_name', operador: 'sin_valor' },
  ];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.deepEqual(out.map(v => v.trip_number), ['A3']);
});

// ── Fechas: formatos MDY / DMY / ISO ────────────────────────────────────────

test('fechaCampoYMD interpreta MDY (activated_on de viajes_activos)', () => {
  const campoInfo = camposDe('viajes_activos').activated_on;
  assert.equal(fechaCampoYMD('08/11/2026 09:00:00', campoInfo), '2026-08-11');
});

test('fechaCampoYMD interpreta DMY (schedulate_origin de programacion)', () => {
  const campoInfo = camposDe('programacion').schedulate_origin;
  assert.equal(fechaCampoYMD('11/08/2026 09:00:00', campoInfo), '2026-08-11');
});

test('fechaCampoYMD interpreta ISO (creado_en de solicitudes)', () => {
  const campoInfo = camposDe('solicitudes').creado_en;
  assert.equal(fechaCampoYMD('2026-08-11T14:30:00.000-05:00', campoInfo), '2026-08-11');
});

test('fechaCampoYMD devuelve null para valor vacío o no parseable', () => {
  const campoInfo = camposDe('viajes_activos').activated_on;
  assert.equal(fechaCampoYMD(null, campoInfo), null);
  assert.equal(fechaCampoYMD('', campoInfo), null);
  assert.equal(fechaCampoYMD('no-es-una-fecha', campoInfo), null);
});

test('operador "es" en fecha filtra por el día exacto', () => {
  const filtros = [{ campo: 'activated_on', operador: 'es', valor: '2026-08-11' }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.deepEqual(out.map(v => v.trip_number), ['A1']);
});

test('operador "antes_de" / "despues_de" en fecha', () => {
  const antes = aplicarFiltros(VIAJES, [{ campo: 'activated_on', operador: 'antes_de', valor: '2026-08-08' }], 'viajes_activos');
  assert.deepEqual(antes.map(v => v.trip_number), ['A2']);

  const despues = aplicarFiltros(VIAJES, [{ campo: 'activated_on', operador: 'despues_de', valor: '2026-08-08' }], 'viajes_activos');
  assert.deepEqual(despues.map(v => v.trip_number).sort(), ['A1', 'A3']);
});

test('operador "entre" respeta ambos límites, o solo uno si el otro no está configurado', () => {
  // A1=2026-08-11, A2=2026-07-11, A3=2026-09-11 (ver fixture VIAJES) — el
  // rango [07-01, 08-08] deja adentro solo a A2.
  const ambos = aplicarFiltros(
    VIAJES,
    [{ campo: 'activated_on', operador: 'entre', valor_desde: '2026-07-01', valor_hasta: '2026-08-08' }],
    'viajes_activos'
  );
  assert.deepEqual(ambos.map(v => v.trip_number), ['A2']);

  const soloDesde = aplicarFiltros(
    VIAJES,
    [{ campo: 'activated_on', operador: 'entre', valor_desde: '2026-08-09', valor_hasta: null }],
    'viajes_activos'
  );
  assert.deepEqual(soloDesde.map(v => v.trip_number).sort(), ['A1', 'A3']);
});

test('"entre" sin ningún límite configurado no restringe (filtro incompleto)', () => {
  const filtros = [{ campo: 'activated_on', operador: 'entre', valor_desde: null, valor_hasta: null }];
  const out = aplicarFiltros(VIAJES, filtros, 'viajes_activos');
  assert.equal(out.length, 3);
});

// ── Campos derivados (linea_negocio) — regla exacta, no substring (Fase 8E) ──

test('evaluaCondicion sobre linea_negocio usa el valor ya derivado por enriquecerFilas', () => {
  const campoInfo = camposDe('viajes_activos').linea_negocio;
  const filaLiquida = { linea_negocio: 'Carga Líquida' };
  const filaSeca     = { linea_negocio: 'Carga Seca' };
  const filtro = { campo: 'linea_negocio', operador: 'es', valor: 'Carga Líquida' };
  assert.equal(evaluaCondicion(filaLiquida, filtro, campoInfo), true);
  assert.equal(evaluaCondicion(filaSeca,     filtro, campoInfo), false);
});
