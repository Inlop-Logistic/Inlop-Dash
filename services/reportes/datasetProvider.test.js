/**
 * Unit tests for datasetProvider.js
 * Run: node --test services/reportes/datasetProvider.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enriquecerFilas,
  transformarViajesActivos,
  transformarCentroGps,
  calcularRangoPushdown,
  obtenerSolicitudesCompletas,
  obtenerProgramacionCompleta,
  obtenerCumplidosCompletos,
  obtenerDatasetCompleto,
  derivarEstadoGps,
  parseLatLon,
  ESTADOS_MONITOREABLES,
} from './datasetProvider.js';

// ── enriquecerFilas ──────────────────────────────────────────────────────────

test('enriquecerFilas agrega tipo_servicio cuando falta (origin === destiny → Urbano)', () => {
  const out = enriquecerFilas([{ origin_city_name: 'Bogotá', destiny_city_name: 'Bogotá' }]);
  assert.equal(out[0].tipo_servicio, 'Urbano');
});

test('enriquecerFilas agrega tipo_servicio Nacional cuando origen y destino difieren', () => {
  const out = enriquecerFilas([{ origin_city_name: 'Bogotá', destiny_city_name: 'Cali' }]);
  assert.equal(out[0].tipo_servicio, 'Nacional');
});

test('enriquecerFilas no sobreescribe tipo_servicio ya presente (ej. programacion)', () => {
  const out = enriquecerFilas([{ tipo_servicio: 'Urbano', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' }]);
  assert.equal(out[0].tipo_servicio, 'Urbano'); // conserva el valor ya resuelto, no lo recalcula
});

test('enriquecerFilas deriva linea_negocio con match exacto "granel liquido" (no substring — Fase 8E)', () => {
  const liquido = enriquecerFilas([{ type_operation: 'Granel Liquido' }]);
  assert.equal(liquido[0].linea_negocio, 'Carga Líquida');

  const noLiquido = enriquecerFilas([{ type_operation: 'Granel Solido' }]); // contiene "granel" pero no es igual
  assert.equal(noLiquido[0].linea_negocio, 'Carga Seca');

  const seca = enriquecerFilas([{ type_operation: 'Carga General' }]);
  assert.equal(seca[0].linea_negocio, 'Carga Seca');
});

test('enriquecerFilas no modifica el objeto original (inmutable)', () => {
  const fila = { origin_city_name: 'Bogotá', destiny_city_name: 'Bogotá' };
  enriquecerFilas([fila]);
  assert.equal(fila.tipo_servicio, undefined);
});

// ── transformarViajesActivos ─────────────────────────────────────────────────

test('transformarViajesActivos mapea los campos esperados del catálogo', () => {
  const deps = {
    tripCustomerCache: new Map([['T1', { empresa_cliente_id: 'E1', razon_social: 'ACME S.A.S.' }]]),
    extraerTelefono: () => '3001234567',
    primerNombreCliente: (s) => (s ?? '').split(',')[0],
  };
  const out = transformarViajesActivos([
    { trip_number: 'T1', company_customer_name: 'ACME, sucursal norte', state_travel: 'en transíto', latitude: '4.6', longitude: '-74.1' },
  ], deps);

  assert.equal(out.length, 1);
  assert.equal(out[0].trip_number, 'T1');
  assert.equal(out[0].razon_social, 'ACME S.A.S.');
  assert.equal(out[0].cliente, 'ACME');
  assert.equal(out[0].conductor_tel, '3001234567');
  assert.equal(out[0].lat, 4.6);
  assert.equal(out[0].lon, -74.1);
});

// ── transformarCentroGps ─────────────────────────────────────────────────────

test('transformarCentroGps filtra por ESTADOS_MONITOREABLES', () => {
  const deps = { tripCustomerCache: new Map() };
  const out = transformarCentroGps([
    { trip_number: 'T1', state_travel: 'en transíto' },
    { trip_number: 'T2', state_travel: 'completado' }, // no monitoreable
  ], deps);
  assert.deepEqual(out.map(v => v.trip_number), ['T1']);
});

test('parseLatLon y derivarEstadoGps — casos básicos', () => {
  assert.equal(parseLatLon('4.6097'), 4.6097);
  assert.equal(parseLatLon(''), null);
  assert.equal(parseLatLon(null), null);

  assert.equal(derivarEstadoGps({ last_alarm_name: 'Pánico activado' }), 'panico');
  assert.equal(derivarEstadoGps({ last_alarm_name: 'Exceso de velocidad' }), 'con_alarma');
  assert.equal(derivarEstadoGps({ last_alarm_name: null, latest_gps_report: null }), 'desconectado');
});

test('ESTADOS_MONITOREABLES contiene los estados operativos esperados', () => {
  assert.ok(ESTADOS_MONITOREABLES.has('en transíto'));
  assert.ok(!ESTADOS_MONITOREABLES.has('completado'));
});

// ── calcularRangoPushdown (Fase 9A §5.2) ────────────────────────────────────

test('calcularRangoPushdown: sin filtro sobre el campo → null (usar default)', () => {
  assert.equal(calcularRangoPushdown([{ campo: 'estado', operador: 'es', valor: 'x' }], 'creado_en'), null);
  assert.equal(calcularRangoPushdown([], 'creado_en'), null);
});

test('calcularRangoPushdown: "es" produce un rango de un solo día', () => {
  const out = calcularRangoPushdown([{ campo: 'creado_en', operador: 'es', valor: '2026-08-11' }], 'creado_en');
  assert.deepEqual(out, { desde: '2026-08-11', hasta: '2026-08-11' });
});

test('calcularRangoPushdown: "antes_de"/"despues_de" producen rango abierto', () => {
  const antes = calcularRangoPushdown([{ campo: 'creado_en', operador: 'antes_de', valor: '2026-08-11' }], 'creado_en');
  assert.deepEqual(antes, { desde: null, hasta: '2026-08-11' });

  const despues = calcularRangoPushdown([{ campo: 'creado_en', operador: 'despues_de', valor: '2026-08-11' }], 'creado_en');
  assert.deepEqual(despues, { desde: '2026-08-11', hasta: null });
});

test('calcularRangoPushdown: "entre" respeta límites parciales', () => {
  const out = calcularRangoPushdown(
    [{ campo: 'creado_en', operador: 'entre', valor_desde: '2026-08-01', valor_hasta: null }],
    'creado_en'
  );
  assert.deepEqual(out, { desde: '2026-08-01', hasta: null });
});

test('calcularRangoPushdown: filtro incompleto (sin valor) → null', () => {
  assert.equal(calcularRangoPushdown([{ campo: 'creado_en', operador: 'es', valor: null }], 'creado_en'), null);
});

// ── Datasets respaldados por Supabase — con sbFetch simulado ────────────────

function mockSbFetch(respuestas) {
  return async (qs) => {
    for (const [prefijo, data] of respuestas) {
      if (qs.startsWith(prefijo)) return data;
    }
    return [];
  };
}

test('obtenerSolicitudesCompletas construye el rango de fecha solo cuando se provee', async () => {
  const llamadas = [];
  const sbFetch = async (qs) => {
    llamadas.push(qs);
    if (qs.startsWith('/solicitudes?')) {
      return [{ id: '1', codigo_solicitud: 'S-1', estado: 'confirmado', creado_en: '2026-08-11T10:00:00-05:00' }];
    }
    return [];
  };

  const out = await obtenerSolicitudesCompletas({ desde: '2026-08-11', hasta: '2026-08-11' }, { sbFetch });
  assert.equal(out.length, 1);
  assert.equal(out[0].estado, 'aprobado'); // 'confirmado' se traduce a 'aprobado'
  assert.ok(llamadas[0].includes('creado_en=gte.2026-08-11T00%3A00%3A00'));
  assert.ok(llamadas[0].includes('creado_en=lte.2026-08-11T23%3A59%3A59'));
});

test('obtenerSolicitudesCompletas sin desde/hasta no agrega cota de fecha (rango abierto)', async () => {
  const llamadas = [];
  const sbFetch = async (qs) => { llamadas.push(qs); return []; };
  await obtenerSolicitudesCompletas({}, { sbFetch });
  assert.ok(!llamadas[0].includes('creado_en=gte.'));
  assert.ok(!llamadas[0].includes('creado_en=lte.'));
});

test('obtenerProgramacionCompleta enriquece con tipo_servicio y conductor_tel', async () => {
  const sbFetch = mockSbFetch([
    ['/planeados?', [{ trip_number: 'T1', city_origin: 'Cali', city_destination: 'Cali', empresa_cliente_id: null, company_customer_name: 'Cliente X' }]],
    ['/empresas_cliente?', []],
    ['/solicitudes?', [{ controlt_trip_number: 'T1', conductor_tel: '3009999999' }]],
  ]);
  const out = await obtenerProgramacionCompleta({ desde: '2026-08-11', hasta: '2026-08-11' }, {
    sbFetch, viajesCache: [], extraerTelefono: () => null,
  });
  assert.equal(out[0].tipo_servicio, 'Urbano');
  assert.equal(out[0].conductor_tel, '3009999999');
});

test('obtenerCumplidosCompletos pagina hasta agotar resultados (sin tope de Preview)', async () => {
  let paginas = 0;
  const sbFetch = async () => {
    paginas += 1;
    if (paginas === 1) return Array.from({ length: 500 }, (_, i) => ({ id: `C${i}` }));
    if (paginas === 2) return [{ id: 'ULTIMO' }];
    return [];
  };
  const out = await obtenerCumplidosCompletos({}, { sbFetch });
  assert.equal(out.length, 501); // 500 + 1 — cruzó la primera página completa, sin tope de 10
  assert.equal(paginas, 2); // se detiene al recibir una página incompleta, sin pedir una tercera
});

// ── obtenerDatasetCompleto — dispatcher ─────────────────────────────────────

test('obtenerDatasetCompleto lanza para un tipo_reporte sin fuente configurada', async () => {
  await assert.rejects(() => obtenerDatasetCompleto('inexistente', {}, {}), /Sin fuente de datos configurada/);
});

test('obtenerDatasetCompleto usa la fecha de ejecución por defecto cuando no hay push-down', async () => {
  const llamadas = [];
  const sbFetch = async (qs) => { llamadas.push(qs); return []; };
  await obtenerDatasetCompleto('solicitudes', { filtros: [], fechaEjecucion: '2026-08-11' }, { sbFetch });
  assert.ok(llamadas[0].includes('creado_en=gte.2026-08-11'));
  assert.ok(llamadas[0].includes('creado_en=lte.2026-08-11'));
});

test('obtenerDatasetCompleto respeta un filtro de fecha explícito (push-down)', async () => {
  const llamadas = [];
  const sbFetch = async (qs) => { llamadas.push(qs); return []; };
  const filtros = [{ campo: 'creado_en', operador: 'despues_de', valor: '2026-01-01' }];
  await obtenerDatasetCompleto('solicitudes', { filtros, fechaEjecucion: '2026-08-11' }, { sbFetch });
  assert.ok(llamadas[0].includes('creado_en=gte.2026-01-01'));
  assert.ok(!llamadas[0].includes('creado_en=lte.')); // despues_de es abierto por arriba
});
