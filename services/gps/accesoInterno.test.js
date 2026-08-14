/**
 * Unit tests for services/gps/accesoInterno.js (Fase 11B)
 * Run: node --test services/gps/accesoInterno.test.js
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from './testStore.js';
import { crearEnlace } from './enlaces.js';
import { resolverAccesoInterno } from './accesoInterno.js';
import { validarSesion } from './sesiones.js';
import { _resetParaTests } from './rateLimiter.js';

beforeEach(() => { _resetParaTests(); });

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
    destinatarios: { personal_ids: [], correos_externos: ['ext@x.com'] },
    ...overrides,
  };
}

async function crearEnlacePrueba({ reporteOverrides = {}, internosAutorizados = ['interno@inlop.com.co'], personal = [] } = {}) {
  const sbFetch = crearAlmacen({ reportes_automaticos: [reporteBase(reporteOverrides)], personal });
  const deps = {
    sbFetch,
    viajesCache: [{ trip_number: 'T1', license_plate: 'ABC123', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' }],
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
  };
  const creado = await crearEnlace(
    { reporteId: 'R1', destinatariosInternosAutorizados: internosAutorizados },
    deps,
  );
  return { creado, deps };
}

// ── Validaciones básicas ──────────────────────────────────────────────────────

test('resolverAccesoInterno exige token', async () => {
  const out = await resolverAccesoInterno({ correo: 'a@x.com' }, {});
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'token_requerido');
});

test('resolverAccesoInterno rechaza correo con formato inválido', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  const out = await resolverAccesoInterno({ token: creado.token, correo: 'no-es-un-correo' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'correo_invalido');
});

test('resolverAccesoInterno: token inválido devuelve enlace_invalido', async () => {
  const { deps } = await crearEnlacePrueba();
  const out = await resolverAccesoInterno({ token: 'token-que-no-existe', correo: 'interno@inlop.com.co' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'enlace_invalido');
});

// ── Caso obligatorio: interno activo autorizado → acceso ──────────────────

test('interno activo y autorizado en el enlace → acceso concedido, SIN OTP', async () => {
  const { creado, deps } = await crearEnlacePrueba({
    internosAutorizados: ['interno@inlop.com.co'],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });

  const out = await resolverAccesoInterno({ token: creado.token, correo: 'Interno@Inlop.com.co' }, deps);
  assert.equal(out.ok, true);
  assert.equal(typeof out.sesionToken, 'string');
  assert.ok(out.sesionToken.length >= 40);

  // La sesión emitida es una sesión real y válida — mismo mecanismo que OTP.
  const validacion = await validarSesion(out.sesionToken, deps);
  assert.equal(validacion.ok, true);
  assert.equal(validacion.sesion.correo, 'interno@inlop.com.co');

  // Ningún OTP se creó ni se requirió para este acceso.
  assert.equal(deps.sbFetch.tablas.reportes_gps_enlaces_otp?.length ?? 0, 0);
});

// ── Caso obligatorio: interno inactivo → rechazo ───────────────────────────

test('interno autorizado en el enlace pero personal.activo=false → rechazado (no_autorizado)', async () => {
  const { creado, deps } = await crearEnlacePrueba({
    internosAutorizados: ['interno@inlop.com.co'],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: false }],
  });

  const out = await resolverAccesoInterno({ token: creado.token, correo: 'interno@inlop.com.co' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_autorizado');
});

test('correo que ya no pertenece a personal (borrado) aunque siga en la whitelist congelada → rechazado', async () => {
  const { creado, deps } = await crearEnlacePrueba({
    internosAutorizados: ['interno@inlop.com.co'],
    personal: [], // el registro de personal ya no existe / no coincide
  });

  const out = await resolverAccesoInterno({ token: creado.token, correo: 'interno@inlop.com.co' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_autorizado');
});

// ── Caso obligatorio: interno no autorizado en ESE reporte/enlace → rechazo ─

test('correo activo en personal pero NO en la whitelist de ESTE enlace → rechazado', async () => {
  const { creado, deps } = await crearEnlacePrueba({
    internosAutorizados: ['otro-interno@inlop.com.co'],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });

  const out = await resolverAccesoInterno({ token: creado.token, correo: 'interno@inlop.com.co' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_autorizado');
});

test('respuesta genérica: el código de fallo es el mismo sin importar cuál de las 3 condiciones falló', async () => {
  const { creado: enlaceSinWhitelist, deps: depsA } = await crearEnlacePrueba({
    internosAutorizados: [],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });
  const { creado: enlaceInactivo, deps: depsB } = await crearEnlacePrueba({
    internosAutorizados: ['interno@inlop.com.co'],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: false }],
  });

  const noEnWhitelist = await resolverAccesoInterno({ token: enlaceSinWhitelist.token, correo: 'interno@inlop.com.co' }, depsA);
  const inactivo       = await resolverAccesoInterno({ token: enlaceInactivo.token, correo: 'interno@inlop.com.co' }, depsB);
  assert.equal(noEnWhitelist.codigo, inactivo.codigo); // 'no_autorizado' en ambos casos — no revela cuál falló
});

// ── externo → OTP sin regresión (verificado también en otp.test.js; aquí
// se confirma que un enlace sin whitelist interna nunca concede acceso
// directo a un correo externo legítimo) ─────────────────────────────────────

test('correo externo autorizado (destinatarios_autorizados, no interno) nunca obtiene acceso directo aquí', async () => {
  const { creado, deps } = await crearEnlacePrueba({
    reporteOverrides: { destinatarios: { personal_ids: [], correos_externos: ['ext@x.com'] } },
    internosAutorizados: [], // ningún interno en este enlace
    personal: [],
  });

  const out = await resolverAccesoInterno({ token: creado.token, correo: 'ext@x.com' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_autorizado'); // el flujo externo real sigue siendo OTP (otp.js, no modificado)
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

test('resolverAccesoInterno: rate limiting por (token, correo)', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  let ultimo;
  for (let i = 0; i < 11; i++) {
    ultimo = await resolverAccesoInterno({ token: creado.token, correo: 'quien-sea@x.com' }, deps);
  }
  assert.equal(ultimo.ok, false);
  assert.equal(ultimo.codigo, 'rate_limited');
});

// ── Aislamiento por reporte/enlace ────────────────────────────────────────────

test('un correo interno autorizado en el enlace A no obtiene acceso con el token del enlace B', async () => {
  const sbFetch = crearAlmacen({
    reportes_automaticos: [reporteBase({ id: 'RA' }), reporteBase({ id: 'RB' })],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });
  const deps = {
    sbFetch,
    viajesCache: [{ trip_number: 'T1', license_plate: 'ABC123', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' }],
    tripCustomerCache: new Map(), extraerTelefono: () => null, primerNombreCliente: () => null,
  };

  const enlaceA = await crearEnlace({ reporteId: 'RA', destinatariosInternosAutorizados: ['interno@inlop.com.co'] }, deps);
  const enlaceB = await crearEnlace({ reporteId: 'RB', destinatariosInternosAutorizados: [] }, deps); // interno NO autorizado en B

  const okEnA = await resolverAccesoInterno({ token: enlaceA.token, correo: 'interno@inlop.com.co' }, deps);
  const okEnB = await resolverAccesoInterno({ token: enlaceB.token, correo: 'interno@inlop.com.co' }, deps);

  assert.equal(okEnA.ok, true);
  assert.equal(okEnB.ok, false);
  assert.equal(okEnB.codigo, 'no_autorizado');
});

// ── Expiración/revocación (mismas reglas que el flujo externo — vía validarEnlace) ─

test('enlace expirado → enlace_invalido, ni siquiera llega a revisar personal', async () => {
  const sbFetch = crearAlmacen({
    reportes_automaticos: [reporteBase()],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });
  const deps = {
    sbFetch,
    viajesCache: [{ trip_number: 'T1', license_plate: 'ABC123', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' }],
    tripCustomerCache: new Map(), extraerTelefono: () => null, primerNombreCliente: () => null,
  };
  const vencido = await crearEnlace(
    { reporteId: 'R1', destinatariosInternosAutorizados: ['interno@inlop.com.co'], ttlHoras: -1 },
    deps,
  );

  const out = await resolverAccesoInterno({ token: vencido.token, correo: 'interno@inlop.com.co' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'enlace_invalido');
});

test('la sesión emitida por acceso interno también se revoca si el enlace padre se revoca (mismo mecanismo que OTP)', async () => {
  const { creado, deps } = await crearEnlacePrueba({
    internosAutorizados: ['interno@inlop.com.co'],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });

  const acceso = await resolverAccesoInterno({ token: creado.token, correo: 'interno@inlop.com.co' }, deps);
  assert.equal(acceso.ok, true);

  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces.find(e => e.id === creado.enlaceId);
  filaEnlace.revocado = true;
  filaEnlace.revocado_en = new Date().toISOString();

  const validacion = await validarSesion(acceso.sesionToken, deps);
  assert.equal(validacion.ok, false);
  assert.equal(validacion.codigo, 'enlace_revocado');
});

// ── Auditoría ──────────────────────────────────────────────────────────────────

test('acceso interno concedido y rechazado quedan registrados en la auditoría', async () => {
  const { creado, deps } = await crearEnlacePrueba({
    internosAutorizados: ['interno@inlop.com.co'],
    personal: [{ id: 'P1', correo_compartido: 'interno@inlop.com.co', activo: true }],
  });

  await resolverAccesoInterno({ token: creado.token, correo: 'interno@inlop.com.co' }, deps);
  await resolverAccesoInterno({ token: creado.token, correo: 'no-autorizado@x.com' }, deps);

  const eventos = deps.sbFetch.tablas.reportes_gps_enlaces_accesos.map(e => e.evento);
  assert.ok(eventos.includes('acceso_interno_concedido'));
  assert.ok(eventos.includes('acceso_interno_intentado'));
});
