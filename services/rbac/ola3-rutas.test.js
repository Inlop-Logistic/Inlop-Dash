/**
 * Integration tests — Ola 3 enforcement RBAC (Sprint 3D-7.11K.2-D)
 *
 * Verifica que los 8 endpoints de detalle/consulta protegidos en Ola 3
 * cumplen el contrato usando únicamente permisos existentes:
 *
 *   GET /api/viajes/:tripNumber                      → viajes:listar
 *   GET /api/cumplidos/:trip/documentos              → cumplidos:listar
 *   GET /api/cumplidos/:trip/documentos/:id/sign     → cumplidos:listar
 *   GET /api/programacion/:id                        → programacion:listar
 *   GET /api/programacion/:id/solicitud              → programacion:listar
 *   GET /api/clientes/:id                            → clientes:listar
 *   GET /api/clientes/:id/alias                      → clientes:listar
 *   GET /api/clientes/:id/merge-preview              → clientes:listar
 *
 * Escenarios por endpoint:
 *   1. usuario con permiso    → next() (acceso concedido)
 *   2. usuario sin permiso    → 403
 *   3. master                 → next() (acceso total)
 *   4. usuario inactivo       → 403 (fail-closed del resolver)
 *   5. sin req.erpUserId      → 403 (decisión G1)
 *
 * Run: node --test services/rbac/ola3-rutas.test.js
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

/** Usuario con exactamente un permiso nombrado. */
function almacenConPermiso(profileId, nombrePermiso) {
  return crearAlmacen({
    profiles:     [{ id: profileId,   activo: true },
                   { id: 'user-otro', activo: true }],
    roles:        [{ id: 'rol-limitado', nombre: 'limitado', activo: true }],
    permisos:     [{ id: `perm-${nombrePermiso}`, nombre: nombrePermiso }],
    rol_permisos: [{ rol_id: 'rol-limitado', permiso_id: `perm-${nombrePermiso}` }],
    usuario_roles:[{ id: 'ur1', profile_id: profileId, rol_id: 'rol-limitado', activo: true }],
    usuario_permisos: [],
  });
}

function almacenMaster(profileId) {
  return crearAlmacen({
    profiles:     [{ id: profileId, activo: true }],
    roles:        [{ id: 'rol-master', nombre: 'master', activo: true }],
    permisos:     [],
    rol_permisos: [],
    usuario_roles:[{ id: 'ur-m', profile_id: profileId, rol_id: 'rol-master', activo: true }],
    usuario_permisos: [],
  });
}

function almacenInactivo(profileId, nombrePermiso) {
  return crearAlmacen({
    profiles:     [{ id: profileId, activo: false }],
    roles:        [{ id: 'rol-op', nombre: 'operador', activo: true }],
    permisos:     [{ id: `perm-${nombrePermiso}`, nombre: nombrePermiso }],
    rol_permisos: [{ rol_id: 'rol-op', permiso_id: `perm-${nombrePermiso}` }],
    usuario_roles:[{ id: 'ur2', profile_id: profileId, rol_id: 'rol-op', activo: true }],
    usuario_permisos: [],
  });
}

// ─── Tabla de rutas de Ola 3 ─────────────────────────────────────────────────
const RUTAS_OLA3 = [
  // Viajes
  { nombre: 'GET /api/viajes/:tripNumber',                  permiso: 'viajes:listar'       },
  // Cumplidos
  { nombre: 'GET /api/cumplidos/:trip/documentos',          permiso: 'cumplidos:listar'    },
  { nombre: 'GET /api/cumplidos/:trip/documentos/:id/sign', permiso: 'cumplidos:listar'    },
  // Programación
  { nombre: 'GET /api/programacion/:id',                    permiso: 'programacion:listar' },
  { nombre: 'GET /api/programacion/:id/solicitud',          permiso: 'programacion:listar' },
  // Clientes
  { nombre: 'GET /api/clientes/:id',                        permiso: 'clientes:listar'     },
  { nombre: 'GET /api/clientes/:id/alias',                  permiso: 'clientes:listar'     },
  { nombre: 'GET /api/clientes/:id/merge-preview',          permiso: 'clientes:listar'     },
];

// ─── Tests parametrizados ─────────────────────────────────────────────────────

for (const { nombre, permiso } of RUTAS_OLA3) {

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
    const sbFetch = almacenConPermiso('user-con-permiso', permiso);
    const mw  = requirePermiso(permiso, { sbFetch });
    // 'user-otro' existe en profiles pero no tiene el rol del permiso
    const req = { erpUserId: 'user-otro' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403, 'debe responder 403');
    assert.equal(nextLlamado, false, 'next() no debe llamarse');
    assert.equal(res.body?.permiso, permiso);
  });

  test(`[${nombre}] master → next() (acceso total)`, async () => {
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
    const sbFetch = almacenInactivo('user-inactivo', permiso);
    const mw  = requirePermiso(permiso, { sbFetch });
    const req = { erpUserId: 'user-inactivo' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextLlamado, false);
  });

  test(`[${nombre}] sin req.erpUserId (sin JWT) → 403 (decisión G1)`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-ok', permiso);
    const mw  = requirePermiso(permiso, { sbFetch });
    const req = { erpUserId: null };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextLlamado, false);
    assert.equal(sbFetch.llamadas.length, 0,
      'no debe consultar RBAC sin identidad verificada (decisión G1)');
  });
}
