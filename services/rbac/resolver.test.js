/**
 * Unit tests for services/rbac/resolver.js
 * Run: node --test services/rbac/resolver.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from '../gps/testStore.js';
import { _resetCatalogoParaTests } from './catalogo.js';
import { calcularPermisosEfectivos, tienePermiso, _resetResolverParaTests } from './resolver.js';

// ── Fixture compartido ────────────────────────────────────────────────────
// 3 roles: operador (viajes:listar), supervisor (viajes:listar + cumplidos:estado),
// master (sin filas en rol_permisos — acceso por regla especial).
// rbac:gestionar no está asignado a ningún rol (igual que en producción).
function almacenBase(overrides = {}) {
  return crearAlmacen({
    profiles: [
      { id: 'user-activo',   activo: true },
      { id: 'user-inactivo', activo: false },
      { id: 'user-master',   activo: true },
    ],
    roles: [
      { id: 'rol-operador',   nombre: 'operador',   activo: true },
      { id: 'rol-supervisor', nombre: 'supervisor', activo: true },
      { id: 'rol-master',     nombre: 'master',     activo: true },
      { id: 'rol-inactivo',   nombre: 'descontinuado', activo: false },
    ],
    permisos: [
      { id: 'perm-viajes-listar',    nombre: 'viajes:listar' },
      { id: 'perm-cumplidos-estado', nombre: 'cumplidos:estado' },
      { id: 'perm-rbac-gestionar',   nombre: 'rbac:gestionar' },
    ],
    rol_permisos: [
      { rol_id: 'rol-operador',   permiso_id: 'perm-viajes-listar' },
      { rol_id: 'rol-supervisor', permiso_id: 'perm-viajes-listar' },
      { rol_id: 'rol-supervisor', permiso_id: 'perm-cumplidos-estado' },
      // rol-master: SIN filas — acceso total por regla especial.
      // rol-inactivo: con filas, pero el rol está desactivado — no debe contar.
      { rol_id: 'rol-inactivo',   permiso_id: 'perm-viajes-listar' },
    ],
    usuario_roles: [],
    usuario_permisos: [],
    ...overrides,
  });
}

function reset() {
  _resetCatalogoParaTests();
  _resetResolverParaTests();
}

// ── Casos base ────────────────────────────────────────────────────────────

test('calcularPermisosEfectivos: profileId ausente → sin permisos, sin llamar a Supabase', async () => {
  reset();
  const sbFetch = almacenBase();
  const resultado = await calcularPermisosEfectivos(null, { sbFetch });
  assert.deepEqual(resultado, { esMaster: false, permisos: new Set() });
  assert.equal(sbFetch.llamadas.length, 0);
});

test('calcularPermisosEfectivos: deps.sbFetch ausente → sin permisos, no lanza', async () => {
  reset();
  const resultado = await calcularPermisosEfectivos('user-activo', {});
  assert.deepEqual(resultado, { esMaster: false, permisos: new Set() });
});

test('calcularPermisosEfectivos: usuario sin usuario_roles → sin permisos', async () => {
  reset();
  const sbFetch = almacenBase();
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch });
  assert.equal(resultado.esMaster, false);
  assert.equal(resultado.permisos.size, 0);
});

test('calcularPermisosEfectivos: un rol simple otorga exactamente sus permisos', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador', activo: true }],
  });
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch });
  assert.equal(resultado.esMaster, false);
  assert.ok(resultado.permisos.has('viajes:listar'));
  assert.equal(resultado.permisos.has('cumplidos:estado'), false);
});

test('calcularPermisosEfectivos: múltiples roles activos se unen (aditivo, sin jerarquía)', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [
      { id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador',   activo: true },
      { id: 'ur2', profile_id: 'user-activo', rol_id: 'rol-supervisor', activo: true },
    ],
  });
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch });
  assert.ok(resultado.permisos.has('viajes:listar'));
  assert.ok(resultado.permisos.has('cumplidos:estado'));
});

// ── Estados inactivos ─────────────────────────────────────────────────────

test('calcularPermisosEfectivos: profiles.activo=false → sin permisos aunque tenga roles', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-inactivo', rol_id: 'rol-operador', activo: true }],
  });
  const resultado = await calcularPermisosEfectivos('user-inactivo', { sbFetch });
  assert.deepEqual(resultado, { esMaster: false, permisos: new Set() });
});

test('calcularPermisosEfectivos: usuario_roles.activo=false (asignación suspendida) no cuenta', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador', activo: false }],
  });
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch });
  assert.equal(resultado.permisos.size, 0);
});

test('calcularPermisosEfectivos: roles.activo=false (rol desactivado globalmente) no cuenta', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-inactivo', activo: true }],
  });
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch });
  assert.equal(resultado.permisos.size, 0, 'rol-inactivo tiene viajes:listar en rol_permisos pero está desactivado');
});

// ── Grants / revokes ──────────────────────────────────────────────────────

test('calcularPermisosEfectivos: grant individual añade un permiso que el rol no otorga', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador', activo: true }],
    usuario_permisos: [
      { id: 'up1', profile_id: 'user-activo', permiso_id: 'perm-cumplidos-estado', efecto: 'grant', activo: true },
    ],
  });
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch });
  assert.ok(resultado.permisos.has('viajes:listar'));
  assert.ok(resultado.permisos.has('cumplidos:estado'), 'el grant debe agregar el permiso individual');
});

test('calcularPermisosEfectivos: revoke individual quita un permiso que el rol sí otorga', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-supervisor', activo: true }],
    usuario_permisos: [
      { id: 'up1', profile_id: 'user-activo', permiso_id: 'perm-cumplidos-estado', efecto: 'revoke', activo: true },
    ],
  });
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch });
  assert.ok(resultado.permisos.has('viajes:listar'));
  assert.equal(resultado.permisos.has('cumplidos:estado'), false, 'el revoke debe quitar el permiso del rol');
});

test('calcularPermisosEfectivos: excepción con activo=false se ignora', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador', activo: true }],
    usuario_permisos: [
      { id: 'up1', profile_id: 'user-activo', permiso_id: 'perm-cumplidos-estado', efecto: 'grant', activo: false },
    ],
  });
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch });
  assert.equal(resultado.permisos.has('cumplidos:estado'), false);
});

// ── Master ────────────────────────────────────────────────────────────────

test('calcularPermisosEfectivos: master → esMaster=true, sin consultar usuario_permisos', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-master', rol_id: 'rol-master', activo: true }],
    usuario_permisos: [
      // Aunque exista un revoke activo, master no debe consultarlo siquiera.
      { id: 'up1', profile_id: 'user-master', permiso_id: 'perm-viajes-listar', efecto: 'revoke', activo: true },
    ],
  });
  const resultado = await calcularPermisosEfectivos('user-master', { sbFetch });
  assert.equal(resultado.esMaster, true);

  const llamadasAExcepciones = sbFetch.llamadas.filter(l => l.qs.startsWith('/usuario_permisos'));
  assert.equal(llamadasAExcepciones.length, 0, 'master corta ANTES de consultar usuario_permisos');
});

test('tienePermiso: master obtiene true incluso con un revoke activo sobre ese permiso', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-master', rol_id: 'rol-master', activo: true }],
    usuario_permisos: [
      { id: 'up1', profile_id: 'user-master', permiso_id: 'perm-viajes-listar', efecto: 'revoke', activo: true },
    ],
  });
  assert.equal(await tienePermiso('user-master', 'viajes:listar', { sbFetch }), true);
});

test('tienePermiso: master obtiene true para rbac:gestionar (nunca asignado por rol_permisos)', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-master', rol_id: 'rol-master', activo: true }],
  });
  assert.equal(await tienePermiso('user-master', 'rbac:gestionar', { sbFetch }), true);
});

test('tienePermiso: rol no-master NUNCA obtiene rbac:gestionar', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [
      { id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador', activo: true },
      { id: 'ur2', profile_id: 'user-activo', rol_id: 'rol-supervisor', activo: true },
    ],
  });
  assert.equal(await tienePermiso('user-activo', 'rbac:gestionar', { sbFetch }), false);
});

test('calcularPermisosEfectivos: profiles.activo=false bloquea incluso a master (decisión G2)', async () => {
  reset();
  const sbFetch = almacenBase({
    profiles: [{ id: 'user-master-inactivo', activo: false }],
    roles: [{ id: 'rol-master', nombre: 'master', activo: true }],
    usuario_roles: [{ id: 'ur1', profile_id: 'user-master-inactivo', rol_id: 'rol-master', activo: true }],
  });
  const resultado = await calcularPermisosEfectivos('user-master-inactivo', { sbFetch });
  assert.deepEqual(resultado, { esMaster: false, permisos: new Set() });
});

// ── tienePermiso() y cache ────────────────────────────────────────────────

test('tienePermiso: true si el permiso está en el conjunto efectivo, false si no', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador', activo: true }],
  });
  assert.equal(await tienePermiso('user-activo', 'viajes:listar', { sbFetch }), true);
  assert.equal(await tienePermiso('user-activo', 'cumplidos:estado', { sbFetch }), false);
});

test('tienePermiso: profileId o permiso ausente → false sin tocar Supabase', async () => {
  reset();
  const sbFetch = almacenBase();
  assert.equal(await tienePermiso(null, 'viajes:listar', { sbFetch }), false);
  assert.equal(await tienePermiso('user-activo', '', { sbFetch }), false);
  assert.equal(sbFetch.llamadas.length, 0);
});

test('tienePermiso: dentro del TTL de 30s, no vuelve a resolver contra Supabase', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [{ id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador', activo: true }],
  });
  await tienePermiso('user-activo', 'viajes:listar', { sbFetch });
  const llamadasTrasPrimeraResolucion = sbFetch.llamadas.length;

  await tienePermiso('user-activo', 'viajes:listar', { sbFetch });
  await tienePermiso('user-activo', 'cumplidos:estado', { sbFetch }); // otro permiso, mismo usuario → misma cache

  assert.equal(sbFetch.llamadas.length, llamadasTrasPrimeraResolucion, 'debe reutilizar la resolución cacheada');
});

test('tienePermiso: usuarios distintos no comparten entrada de cache', async () => {
  reset();
  const sbFetch = almacenBase({
    usuario_roles: [
      { id: 'ur1', profile_id: 'user-activo', rol_id: 'rol-operador', activo: true },
      { id: 'ur2', profile_id: 'user-master', rol_id: 'rol-master',   activo: true },
    ],
  });
  assert.equal(await tienePermiso('user-activo', 'cumplidos:estado', { sbFetch }), false);
  assert.equal(await tienePermiso('user-master', 'cumplidos:estado', { sbFetch }), true);
});

// ── Fail-closed ───────────────────────────────────────────────────────────

test('tienePermiso: si sbFetch lanza, resuelve false (fail-closed) sin propagar la excepción', async () => {
  reset();
  const sbFetchRoto = async () => { throw new Error('fallo de red simulado'); };
  const resultado = await tienePermiso('user-activo', 'viajes:listar', { sbFetch: sbFetchRoto });
  assert.equal(resultado, false);
});

test('calcularPermisosEfectivos: si sbFetch lanza, resuelve VACIO (fail-closed) sin propagar la excepción', async () => {
  reset();
  const sbFetchRoto = async () => { throw new Error('fallo de red simulado'); };
  const resultado = await calcularPermisosEfectivos('user-activo', { sbFetch: sbFetchRoto });
  assert.deepEqual(resultado, { esMaster: false, permisos: new Set() });
});
