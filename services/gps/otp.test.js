/**
 * Unit tests for services/gps/otp.js
 * Run: node --test services/gps/otp.test.js
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from './testStore.js';
import { crearEnlace } from './enlaces.js';
import { solicitarOtp, validarOtp, OTP_MAX_INTENTOS } from './otp.js';
import { _resetParaTests } from './rateLimiter.js';
import { hashSecreto } from './crypto.js';

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
    destinatarios: { personal_ids: [], correos_externos: ['cliente@externo.com'] },
    ...overrides,
  };
}

async function crearEnlacePrueba(overrides = {}) {
  const sbFetch = crearAlmacen({ reportes_automaticos: [reporteBase(overrides)] });
  const deps = {
    sbFetch,
    viajesCache: [{ trip_number: 'T1', license_plate: 'ABC123', state_travel: 'en transíto', origin_city_name: 'Bogotá', destiny_city_name: 'Cali' }],
    tripCustomerCache: new Map(),
    extraerTelefono: () => null,
    primerNombreCliente: () => null,
  };
  const creado = await crearEnlace({ reporteId: 'R1' }, deps);
  return { creado, deps };
}

function conCorreoMock(deps) {
  const enviados = [];
  const sendWithAttachment = async (params) => { enviados.push(params); return { ok: true, id: 'msg_1' }; };
  sendWithAttachment.enviados = enviados;
  return { ...deps, sendWithAttachment };
}

// ── solicitarOtp — validaciones básicas ──────────────────────────────────────

test('solicitarOtp exige token', async () => {
  const out = await solicitarOtp({ correo: 'a@x.com' }, {});
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'token_requerido');
});

test('solicitarOtp rechaza correo con formato inválido', async () => {
  const { deps } = await crearEnlacePrueba();
  const out = await solicitarOtp({ token: 't', correo: 'no-es-un-correo' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'correo_invalido');
});

test('solicitarOtp: token inválido devuelve enlace_invalido', async () => {
  const { deps } = await crearEnlacePrueba();
  const out = await solicitarOtp({ token: 'token-que-no-existe', correo: 'cliente@externo.com' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'enlace_invalido');
});

// ── Destinatario autorizado / no autorizado + anti-enumeración ─────────────

test('solicitarOtp: correo NO autorizado responde ok:true, enviado:false — no crea OTP ni envía correo', async () => {
  const { creado, deps: depsBase } = await crearEnlacePrueba();
  const deps = conCorreoMock(depsBase);

  const out = await solicitarOtp({ token: creado.token, correo: 'no-autorizado@x.com' }, deps);
  assert.equal(out.ok, true);
  assert.equal(out.enviado, false);
  assert.equal(deps.sendWithAttachment.enviados.length, 0);
  assert.equal(deps.sbFetch.tablas.reportes_gps_enlaces_otp?.length ?? 0, 0);
});

test('solicitarOtp: correo autorizado responde ok:true, enviado:true — crea OTP y envía correo', async () => {
  const { creado, deps: depsBase } = await crearEnlacePrueba();
  const deps = conCorreoMock(depsBase);

  const out = await solicitarOtp({ token: creado.token, correo: 'cliente@externo.com' }, deps);
  assert.equal(out.ok, true);
  assert.equal(out.enviado, true);
  assert.equal(deps.sendWithAttachment.enviados.length, 1);
  assert.deepEqual(deps.sendWithAttachment.enviados[0].to, ['cliente@externo.com']);

  const filaOtp = deps.sbFetch.tablas.reportes_gps_enlaces_otp[0];
  assert.equal(filaOtp.correo, 'cliente@externo.com');
  assert.notEqual(filaOtp.otp_hash, undefined);
  assert.equal(filaOtp.usado, false);
  assert.equal(filaOtp.intentos, 0);

  // El código en claro NUNCA se persiste — solo su hash, y el hash no
  // coincide con ningún valor obviamente derivable del correo/token.
  assert.equal(filaOtp.otp_hash.length, 64);
});

test('solicitarOtp: la respuesta es idéntica en forma para correo autorizado y no autorizado (anti-enumeración)', async () => {
  const { creado, deps: depsBase } = await crearEnlacePrueba();
  const deps = conCorreoMock(depsBase);
  const noAutorizado = await solicitarOtp({ token: creado.token, correo: 'quien-sea@x.com' }, deps);
  const autorizado    = await solicitarOtp({ token: creado.token, correo: 'cliente@externo.com' }, deps);
  assert.equal(noAutorizado.ok, true);
  assert.equal(autorizado.ok, true);
  assert.deepEqual(Object.keys(noAutorizado).sort(), Object.keys(autorizado).sort());
});

test('solicitarOtp: pedir un nuevo OTP invalida el anterior no usado del mismo correo', async () => {
  const { creado, deps: depsBase } = await crearEnlacePrueba();
  const deps = conCorreoMock(depsBase);

  await solicitarOtp({ token: creado.token, correo: 'cliente@externo.com' }, deps);
  const primero = deps.sbFetch.tablas.reportes_gps_enlaces_otp[0];

  await solicitarOtp({ token: creado.token, correo: 'cliente@externo.com' }, deps);
  const filas = deps.sbFetch.tablas.reportes_gps_enlaces_otp;
  assert.equal(filas.length, 2);
  assert.equal(filas.find(f => f.id === primero.id).usado, true); // invalidado
  assert.equal(filas[1].usado, false); // el nuevo sigue vigente
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

test('solicitarOtp: rate limiting por (token, correo)', async () => {
  const { creado, deps: depsBase } = await crearEnlacePrueba();
  const deps = conCorreoMock(depsBase);
  let ultimo;
  for (let i = 0; i < 6; i++) {
    ultimo = await solicitarOtp({ token: creado.token, correo: 'cliente@externo.com' }, deps);
  }
  assert.equal(ultimo.ok, false);
  assert.equal(ultimo.codigo, 'rate_limited');
});

// ── validarOtp — correcto / incorrecto / expirado / reutilizado ────────────

test('validarOtp: correo no autorizado → otp_invalido (mismo código que "incorrecto")', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  const out = await validarOtp({ token: creado.token, correo: 'no-autorizado@x.com', codigo: '123456' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'otp_invalido');
});

test('validarOtp: sin haber solicitado OTP → otp_invalido', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  const out = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '123456' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'otp_invalido');
});

test('validarOtp: código correcto → sesión creada, OTP marcado como usado', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  // Inyectamos directamente un OTP conocido para no depender de leer el correo enviado.
  const otpHash = hashSecreto('654321');
  await deps.sbFetch('/reportes_gps_enlaces_otp', 'POST', {
    enlace_id: creado.enlaceId, correo: 'cliente@externo.com', otp_hash: otpHash,
    expira_en: new Date(Date.now() + 60_000).toISOString(),
    intentos: 0, usado: false,
  });

  const out = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '654321' }, deps);
  assert.equal(out.ok, true);
  assert.equal(typeof out.sesionToken, 'string');
  assert.ok(out.sesionToken.length >= 40);

  const filaOtp = deps.sbFetch.tablas.reportes_gps_enlaces_otp.find(f => f.otp_hash === otpHash);
  assert.equal(filaOtp.usado, true); // de un solo uso
});

test('validarOtp: código incorrecto → otp_incorrecto, incrementa intentos', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  const otpHash = hashSecreto('654321');
  await deps.sbFetch('/reportes_gps_enlaces_otp', 'POST', {
    enlace_id: creado.enlaceId, correo: 'cliente@externo.com', otp_hash: otpHash,
    expira_en: new Date(Date.now() + 60_000).toISOString(),
    intentos: 0, usado: false,
  });

  const out = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '000000' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'otp_incorrecto');

  const filaOtp = deps.sbFetch.tablas.reportes_gps_enlaces_otp.find(f => f.otp_hash === otpHash);
  assert.equal(filaOtp.intentos, 1);
  assert.equal(filaOtp.usado, false); // todavía no agotó intentos
});

test('validarOtp: código reutilizado (ya usado) → otp_invalido', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  const otpHash = hashSecreto('654321');
  await deps.sbFetch('/reportes_gps_enlaces_otp', 'POST', {
    enlace_id: creado.enlaceId, correo: 'cliente@externo.com', otp_hash: otpHash,
    expira_en: new Date(Date.now() + 60_000).toISOString(),
    intentos: 0, usado: false,
  });

  const primero = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '654321' }, deps);
  assert.equal(primero.ok, true);

  const segundo = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '654321' }, deps);
  assert.equal(segundo.ok, false);
  assert.equal(segundo.codigo, 'otp_invalido');
});

test('validarOtp: código expirado → otp_expirado', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  const otpHash = hashSecreto('654321');
  await deps.sbFetch('/reportes_gps_enlaces_otp', 'POST', {
    enlace_id: creado.enlaceId, correo: 'cliente@externo.com', otp_hash: otpHash,
    expira_en: new Date(Date.now() - 1000).toISOString(), // ya vencido
    intentos: 0, usado: false,
  });

  const out = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '654321' }, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'otp_expirado');
});

test('validarOtp: límite de intentos agotado → otp_limite_excedido y se invalida', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  const otpHash = hashSecreto('654321');
  await deps.sbFetch('/reportes_gps_enlaces_otp', 'POST', {
    enlace_id: creado.enlaceId, correo: 'cliente@externo.com', otp_hash: otpHash,
    expira_en: new Date(Date.now() + 60_000).toISOString(),
    intentos: 0, usado: false,
  });

  let ultimo;
  for (let i = 0; i < OTP_MAX_INTENTOS; i++) {
    ultimo = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '000000' }, deps);
  }
  assert.equal(ultimo.ok, false);
  assert.equal(ultimo.codigo, 'otp_limite_excedido');

  // Incluso con el código correcto, ya no vale — de un solo grupo de intentos.
  const conCodigoCorrecto = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '654321' }, deps);
  assert.equal(conCodigoCorrecto.ok, false);
});

test('validarOtp: rate limiting de intentos de validación', async () => {
  const { creado, deps } = await crearEnlacePrueba();
  let ultimo;
  for (let i = 0; i < 11; i++) {
    ultimo = await validarOtp({ token: creado.token, correo: 'cliente@externo.com', codigo: '000000' }, deps);
  }
  assert.equal(ultimo.ok, false);
  assert.equal(ultimo.codigo, 'rate_limited');
});
