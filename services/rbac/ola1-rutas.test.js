/**
 * Integration tests — Ola 1 enforcement RBAC (Sprint 3D-7.11K.2-B.1)
 *
 * Verifica que los 5 endpoints GET de listado protegidos en Ola 1:
 *   GET /api/viajes       → viajes:listar
 *   GET /api/gps          → gps:listar
 *   GET /api/cumplidos    → cumplidos:listar
 *   GET /api/programacion → programacion:listar
 *   GET /api/clientes     → clientes:listar
 *
 * ...respetan el contrato:
 *   - usuario con permiso              → next() (no 403)
 *   - usuario sin permiso              → 403
 *   - master                           → next() (acceso total)
 *   - usuario inactivo (profiles.activo=false) → 403 (sin permiso efectivo)
 *   - sin req.erpUserId (legacy token) → 403 (fail-closed, decisión G1)
 *
 * Se prueba directamente requirePermiso() con el mismo almacén de datos que
 * usa el resto de tests RBAC — no levanta un servidor Express (no es necesario
 * para verificar el enforcement; los tests de index.js require E2E separados).
 *
 * Run: node --test services/rbac/ola1-rutas.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from '../gps/testStore.js';
import { _resetCatalogoParaTests } from './catalogo.js';
import { _resetResolverParaTests } from './resolver.js';
import { requirePermiso } from './middleware.js';

function reset() {
  _resetCatalogoParaTests();
  _resetResolverParaTests();
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(body)  { res.body = body;       return res; },
  };
  return res;
}

/**
 * Almacén con un usuario que tiene exactamente UN permiso dado.
 * Útil para probar cada ruta de Ola 1 de forma aislada.
 */
function almacenConPermiso(profileId, nombrePermiso) {
  return crearAlmacen({
    profiles:    [
      { id: profileId,   activo: true },
      { id: 'user-otro', activo: true },
    ],
    roles:       [{ id: 'rol-limitado', nombre: 'limitado', activo: true }],
    permisos:    [{ id: `perm-${nombrePermiso}`, nombre: nombrePermiso }],
    rol_permisos: [{ rol_id: 'rol-limitado', permiso_id: `perm-${nombrePermiso}` }],
    usuario_roles: [{ id: 'ur1', profile_id: profileId, rol_id: 'rol-limitado', activo: true }],
    usuario_permisos: [],
  });
}

function almacenMaster(profileId) {
  return crearAlmacen({
    profiles:    [{ id: profileId, activo: true }],
    roles:       [{ id: 'rol-master', nombre: 'master', activo: true }],
    permisos:    [],
    rol_permisos: [],
    usuario_roles: [{ id: 'ur-m', profile_id: profileId, rol_id: 'rol-master', activo: true }],
    usuario_permisos: [],
  });
}

function almacenInactivo(profileId) {
  return crearAlmacen({
    profiles:    [{ id: profileId, activo: false }],
    roles:       [{ id: 'rol-op', nombre: 'operador', activo: true }],
    permisos:    [{ id: 'perm-viajes', nombre: 'viajes:listar' }],
    rol_permisos: [{ rol_id: 'rol-op', permiso_id: 'perm-viajes' }],
    usuario_roles: [{ id: 'ur2', profile_id: profileId, rol_id: 'rol-op', activo: true }],
    usuario_permisos: [],
  });
}

// ─── Tabla de los 5 endpoints de Ola 1 ───────────────────────────────────────
const RUTAS_OLA1 = [
  { nombre: 'GET /api/viajes',       permiso: 'viajes:listar'       },
  { nombre: 'GET /api/gps',          permiso: 'gps:listar'          },
  { nombre: 'GET /api/cumplidos',    permiso: 'cumplidos:listar'    },
  { nombre: 'GET /api/programacion', permiso: 'programacion:listar' },
  { nombre: 'GET /api/clientes',     permiso: 'clientes:listar'     },
];

// ─── Tests parametrizados ─────────────────────────────────────────────────────

for (const { nombre, permiso } of RUTAS_OLA1) {

  test(`[${nombre}] usuario con permiso → next() (acceso concedido)`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-ok', permiso);
    const mw  = requirePermiso(permiso, { sbFetch });
    const req = { erpUserId: 'user-ok' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(nextLlamado, true, 'next() debe llamarse');
    assert.equal(res.statusCode, null, 'no debe responder 403');
  });

  test(`[${nombre}] usuario SIN permiso → 403`, async () => {
    reset();
    // 'user-otro' existe en profiles pero no tiene el rol del permiso
    const sbFetch = almacenConPermiso('user-con-permiso', permiso);
    const mw  = requirePermiso(permiso, { sbFetch });
    const req = { erpUserId: 'user-otro' }; // user-otro: activo, sin roles
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403, 'debe responder 403');
    assert.equal(nextLlamado, false, 'next() no debe llamarse');
    assert.equal(res.body?.permiso, permiso);
  });

  test(`[${nombre}] master → next() (acceso total, sin permiso explícito)`, async () => {
    reset();
    const sbFetch = almacenMaster('user-master');
    const mw  = requirePermiso(permiso, { sbFetch });
    const req = { erpUserId: 'user-master' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(nextLlamado, true, 'master debe pasar sin permiso explícito');
    assert.equal(res.statusCode, null);
  });

  test(`[${nombre}] usuario inactivo (profiles.activo=false) → 403`, async () => {
    reset();
    const sbFetch = almacenInactivo('user-inactivo');
    const mw  = requirePermiso(permiso, { sbFetch });
    const req = { erpUserId: 'user-inactivo' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextLlamado, false);
  });

  test(`[${nombre}] sin req.erpUserId (token legacy / sin JWT) → 403 (decisión G1)`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-ok', permiso);
    const mw  = requirePermiso(permiso, { sbFetch });
    const req = { erpUserId: null };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextLlamado, false);
    assert.equal(sbFetch.llamadas.length, 0, 'no debe consultar RBAC sin identidad');
  });
}
