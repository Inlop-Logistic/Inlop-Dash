/**
 * Unit tests for services/gps/sesiones.js
 * Run: node --test services/gps/sesiones.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from './testStore.js';
import { crearEnlace, revocarEnlace } from './enlaces.js';
import { crearSesion, validarSesion } from './sesiones.js';

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
  const validado = await deps.sbFetch(`/reportes_gps_enlaces?id=eq.${creado.enlaceId}&limit=1`);
  return { creado, enlace: validado[0], deps };
}

// ── crearSesion ────────────────────────────────────────────────────────────────

test('crearSesion: la expiración nunca supera la del enlace padre', async () => {
  const { enlace, deps } = await crearEnlacePrueba({}); // TTL por defecto del enlace: 7 días
  // Pedimos una sesión con TTL "deseado" mucho más largo que el enlace.
  const out = await crearSesion(enlace, 'cliente@externo.com', deps, 24 * 30); // 30 días
  assert.equal(out.ok, true);
  assert.ok(new Date(out.expiraEn).getTime() <= new Date(enlace.expira_en).getTime());
});

test('crearSesion: con TTL de sesión menor al del enlace, se respeta el TTL pedido', async () => {
  const { enlace, deps } = await crearEnlacePrueba({});
  const out = await crearSesion(enlace, 'cliente@externo.com', deps, 1); // 1 hora
  const esperado = Date.now() + 3_600_000;
  assert.ok(Math.abs(new Date(out.expiraEn).getTime() - esperado) < 5000);
});

test('crearSesion: el token en claro no se persiste — solo su hash', async () => {
  const { enlace, deps } = await crearEnlacePrueba({});
  const out = await crearSesion(enlace, 'cliente@externo.com', deps);
  const fila = deps.sbFetch.tablas.reportes_gps_enlaces_sesiones[0];
  assert.notEqual(fila.sesion_token_hash, out.sesionToken);
  assert.equal(fila.sesion_token_hash.length, 64);
});

// ── validarSesion ──────────────────────────────────────────────────────────────

test('validarSesion: token requerido', async () => {
  const { deps } = await crearEnlacePrueba({});
  const out = await validarSesion(undefined, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'token_requerido');
});

test('validarSesion: token inexistente', async () => {
  const { deps } = await crearEnlacePrueba({});
  const out = await validarSesion('token-inventado', deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'no_encontrada');
});

test('validarSesion: sesión válida devuelve sesión + enlace', async () => {
  const { enlace, deps } = await crearEnlacePrueba({});
  const sesion = await crearSesion(enlace, 'cliente@externo.com', deps);
  const out = await validarSesion(sesion.sesionToken, deps);
  assert.equal(out.ok, true);
  assert.equal(out.sesion.correo, 'cliente@externo.com');
  assert.equal(out.enlace.id, enlace.id);
});

test('validarSesion: sesión expirada', async () => {
  const { enlace, deps } = await crearEnlacePrueba({});
  const sesion = await crearSesion(enlace, 'cliente@externo.com', deps, -1); // ya vencida
  const out = await validarSesion(sesion.sesionToken, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'expirada');
});

test('validarSesion: sesión revocada explícitamente', async () => {
  const { enlace, deps } = await crearEnlacePrueba({});
  const sesion = await crearSesion(enlace, 'cliente@externo.com', deps);
  const filaSesion = deps.sbFetch.tablas.reportes_gps_enlaces_sesiones[0];
  filaSesion.revocada = true;

  const out = await validarSesion(sesion.sesionToken, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'revocada');
});

// ── Revocación en cascada: revocar el enlace corta sesiones ya emitidas ────

test('validarSesion: revocar el enlace invalida de inmediato una sesión activa', async () => {
  const { creado, enlace, deps } = await crearEnlacePrueba({});
  const sesion = await crearSesion(enlace, 'cliente@externo.com', deps);

  // La sesión es válida antes de revocar el enlace.
  assert.equal((await validarSesion(sesion.sesionToken, deps)).ok, true);

  await revocarEnlace(creado.enlaceId, deps);

  const out = await validarSesion(sesion.sesionToken, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'enlace_revocado');
});

test('validarSesion: el enlace expirado (aunque la sesión no) invalida el acceso', async () => {
  const { enlace, deps } = await crearEnlacePrueba({});
  const sesion = await crearSesion(enlace, 'cliente@externo.com', deps);

  // Forzamos la expiración del enlace directamente en el almacén (simula el paso del tiempo).
  const filaEnlace = deps.sbFetch.tablas.reportes_gps_enlaces.find(e => e.id === enlace.id);
  filaEnlace.expira_en = new Date(Date.now() - 1000).toISOString();

  const out = await validarSesion(sesion.sesionToken, deps);
  assert.equal(out.ok, false);
  assert.equal(out.codigo, 'enlace_expirado');
});
