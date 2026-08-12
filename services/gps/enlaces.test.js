/**
 * Unit tests for services/gps/enlaces.js
 * Run: node --test services/gps/enlaces.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from './testStore.js';
import { crearEnlace, validarEnlace, revocarEnlace, MODULO_PERMITIDO } from './enlaces.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function reporteBase(overrides = {}) {
  return {
    id: 'R1',
    nombre: 'Centro GPS diario',
    tipo_reporte: 'centro_gps',
    modulo_id: 'gestion_logistica',
    formato: 'excel',
    activo: true,
    borrador: false,
    filtros: [],
    columnas: [],
    destinatarios: { personal_ids: [], correos_externos: ['cliente@externo.com'] },
    ...overrides,
  };
}

function depsBase({ reportes = [], enlaces = [], viajesCache } = {}) {
  const sbFetch = crearAlmacen({ reportes_automaticos: reportes, reportes_gps_enlaces: enlaces });
  return {
    sbFetch,
    viajesCache: viajesCache ?? [
      { trip_number: 'T1', license_plate: 'ABC123', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
      { trip_number: 'T2', license_plate: 'XYZ789', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Medellín' },
    ],
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
  };
}

// ── crearEnlace — validaciones ───────────────────────────────────────────────

test('crearEnlace exige reporteId', async () => {
  const out = await crearEnlace({}, depsBase());
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'reporte_id_requerido');
});

test('crearEnlace exige sbFetch en deps', async () => {
  const out = await crearEnlace({ reporteId: 'R1' }, {});
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'deps_incompletas');
});

test('crearEnlace: reporte no encontrado', async () => {
  const out = await crearEnlace({ reporteId: 'inexistente' }, depsBase({ reportes: [reporteBase()] }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_encontrado');
});

test('crearEnlace: reporte borrador rechazado', async () => {
  const out = await crearEnlace({ reporteId: 'R1' }, depsBase({ reportes: [reporteBase({ borrador: true })] }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'borrador');
});

test('crearEnlace: reporte inactivo rechazado', async () => {
  const out = await crearEnlace({ reporteId: 'R1' }, depsBase({ reportes: [reporteBase({ activo: false })] }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'inactivo');
});

test('crearEnlace: solo aplica a Gestión Logística — otro módulo se rechaza', async () => {
  const out = await crearEnlace({ reporteId: 'R1' }, depsBase({ reportes: [reporteBase({ modulo_id: 'otro_modulo' })] }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'modulo_no_soportado');
  assert.equal(MODULO_PERMITIDO, 'gestion_logistica');
});

test('crearEnlace: sin destinatarios externos rechazado', async () => {
  const reporte = reporteBase({ destinatarios: { personal_ids: ['P1'], correos_externos: [] } });
  const out = await crearEnlace({ reporteId: 'R1' }, depsBase({ reportes: [reporte] }));
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'sin_destinatarios_externos');
});

// ── crearEnlace — éxito ──────────────────────────────────────────────────────

test('crearEnlace: éxito — congela placas del dataset y destinatarios externos normalizados', async () => {
  const reporte = reporteBase({ destinatarios: { personal_ids: [], correos_externos: ['Cliente@Externo.com', ' otro@x.com '] } });
  const deps = depsBase({ reportes: [reporte] });

  const out = await crearEnlace({ reporteId: 'R1', origen: 'manual', creadoPor: 'ana@inlop.com.co' }, deps);

  assert.equal(out.ok, true);
  assert.equal(typeof out.token, 'string');
  assert.ok(out.token.length >= 40); // token en claro, solo se devuelve aquí
  assert.deepEqual(out.placas.sort(), ['ABC123', 'XYZ789']); // ambos viajes están en un estado monitoreable
  assert.deepEqual(out.destinatariosAutorizados.sort(), ['cliente@externo.com', 'otro@x.com']);
  assert.ok(new Date(out.expiraEn).getTime() > Date.now());

  // El token en claro NUNCA se persiste — solo su hash.
  const fila = deps.sbFetch.tablas.reportes_gps_enlaces.find(e => e.id === out.enlaceId);
  assert.ok(fila);
  assert.notEqual(fila.token_hash, out.token);
  assert.equal(fila.token_hash.length, 64); // sha256 hex
  assert.deepEqual(fila.placas.sort(), ['ABC123', 'XYZ789']);
  assert.equal(fila.reporte_id, 'R1');
});

test('crearEnlace acepta destinatariosAutorizados explícitos, sin depender de reporte.destinatarios', async () => {
  const reporte = reporteBase({ destinatarios: { personal_ids: [], correos_externos: ['default@x.com'] } });
  const deps = depsBase({ reportes: [reporte] });

  const out = await crearEnlace(
    { reporteId: 'R1', destinatariosAutorizados: ['solo-este@x.com'] },
    deps,
  );
  assert.equal(out.ok, true);
  assert.deepEqual(out.destinatariosAutorizados, ['solo-este@x.com']);
});

// ── validarEnlace ─────────────────────────────────────────────────────────────

test('validarEnlace: token requerido', async () => {
  const out = await validarEnlace(undefined, depsBase());
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'token_requerido');
});

test('validarEnlace: token que no corresponde a ningún enlace', async () => {
  const out = await validarEnlace('token-inventado', depsBase());
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_encontrado');
});

test('validarEnlace: enlace revocado', async () => {
  const reporte = reporteBase();
  const deps = depsBase({ reportes: [reporte] });
  const creado = await crearEnlace({ reporteId: 'R1' }, deps);
  await revocarEnlace(creado.enlaceId, deps);

  const out = await validarEnlace(creado.token, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'revocado');
});

test('validarEnlace: enlace expirado', async () => {
  const reporte = reporteBase();
  const deps = depsBase({ reportes: [reporte] });
  const creado = await crearEnlace({ reporteId: 'R1', ttlHoras: -1 }, deps); // ya vencido

  const out = await validarEnlace(creado.token, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'expirado');
});

test('validarEnlace: token válido devuelve el enlace correcto', async () => {
  const reporte = reporteBase();
  const deps = depsBase({ reportes: [reporte] });
  const creado = await crearEnlace({ reporteId: 'R1' }, deps);

  const out = await validarEnlace(creado.token, deps);
  assert.equal(out.ok, true);
  assert.equal(out.enlace.id, creado.enlaceId);
  assert.deepEqual(out.enlace.placas.sort(), creado.placas.sort());
});

// ── revocarEnlace ─────────────────────────────────────────────────────────────

test('revocarEnlace: enlace inexistente', async () => {
  const out = await revocarEnlace('id-inventado', depsBase());
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_encontrado');
});

test('revocarEnlace: marca revocado=true y revocado_en', async () => {
  const reporte = reporteBase();
  const deps = depsBase({ reportes: [reporte] });
  const creado = await crearEnlace({ reporteId: 'R1' }, deps);

  const out = await revocarEnlace(creado.enlaceId, deps);
  assert.equal(out.ok, true);

  const fila = deps.sbFetch.tablas.reportes_gps_enlaces.find(e => e.id === creado.enlaceId);
  assert.equal(fila.revocado, true);
  assert.ok(fila.revocado_en);
});

// ── Aislamiento entre reportes ────────────────────────────────────────────────

test('aislamiento: el token del enlace de un reporte nunca resuelve al enlace de otro reporte', async () => {
  const reporteA = reporteBase({ id: 'RA', destinatarios: { personal_ids: [], correos_externos: ['a@x.com'] } });
  const reporteB = reporteBase({ id: 'RB', destinatarios: { personal_ids: [], correos_externos: ['b@x.com'] } });
  const deps = depsBase({
    reportes: [reporteA, reporteB],
    viajesCache: [
      { trip_number: 'T1', license_plate: 'PLACA-A', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' },
    ],
  });

  const enlaceA = await crearEnlace({ reporteId: 'RA' }, deps);
  const enlaceB = await crearEnlace({ reporteId: 'RB' }, deps);

  assert.notEqual(enlaceA.token, enlaceB.token);
  assert.notEqual(enlaceA.enlaceId, enlaceB.enlaceId);

  const validA = await validarEnlace(enlaceA.token, deps);
  const validB = await validarEnlace(enlaceB.token, deps);
  assert.equal(validA.enlace.id, enlaceA.enlaceId);
  assert.equal(validA.enlace.reporte_id, 'RA');
  assert.equal(validB.enlace.id, enlaceB.enlaceId);
  assert.equal(validB.enlace.reporte_id, 'RB');
  assert.notEqual(validA.enlace.id, validB.enlace.id);
});

// ── Intento de manipulación ───────────────────────────────────────────────────

test('manipulación: un token levemente alterado no resuelve al enlace original', async () => {
  const reporte = reporteBase();
  const deps = depsBase({ reportes: [reporte] });
  const creado = await crearEnlace({ reporteId: 'R1' }, deps);

  const tokenAlterado = creado.token.slice(0, -1) + (creado.token.at(-1) === 'A' ? 'B' : 'A');
  const out = await validarEnlace(tokenAlterado, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_encontrado');
});
