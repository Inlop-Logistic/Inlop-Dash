/**
 * Unit tests for services/rbac/middleware.js
 * Run: node --test services/rbac/middleware.test.js
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

// Mock mínimo de Express — solo lo que requirePermiso() usa.
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(body) { res.body = body; return res; },
  };
  return res;
}

function almacenConOperador(profileId) {
  return crearAlmacen({
    profiles:    [{ id: profileId, activo: true }],
    roles:       [{ id: 'rol-operador', nombre: 'operador', activo: true }],
    permisos:    [{ id: 'perm-viajes-listar', nombre: 'viajes:listar' }],
    rol_permisos: [{ rol_id: 'rol-operador', permiso_id: 'perm-viajes-listar' }],
    usuario_roles: [{ id: 'ur1', profile_id: profileId, rol_id: 'rol-operador', activo: true }],
    usuario_permisos: [],
  });
}

test('requirePermiso: sin req.erpUserId (sin JWT) → 403, no llama a Supabase (decisión G1)', async () => {
  reset();
  const sbFetch = almacenConOperador('user-1');
  const middleware = requirePermiso('viajes:listar', { sbFetch });

  const req = { erpUserId: null };
  const res = mockRes();
  let nextLlamado = false;
  await middleware(req, res, () => { nextLlamado = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(nextLlamado, false);
  assert.equal(sbFetch.llamadas.length, 0, 'no debe consultar RBAC sin identidad verificada');
});

test('requirePermiso: req.erpUserId presente + permiso concedido → next()', async () => {
  reset();
  const sbFetch = almacenConOperador('user-1');
  const middleware = requirePermiso('viajes:listar', { sbFetch });

  const req = { erpUserId: 'user-1' };
  const res = mockRes();
  let nextLlamado = false;
  await middleware(req, res, () => { nextLlamado = true; });

  assert.equal(nextLlamado, true);
  assert.equal(res.statusCode, null, 'no debe responder si concede el paso');
});

test('requirePermiso: req.erpUserId presente + permiso NO concedido → 403', async () => {
  reset();
  const sbFetch = almacenConOperador('user-1');
  const middleware = requirePermiso('rbac:gestionar', { sbFetch });

  const req = { erpUserId: 'user-1' };
  const res = mockRes();
  let nextLlamado = false;
  await middleware(req, res, () => { nextLlamado = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(nextLlamado, false);
  assert.deepEqual(res.body, { error: 'Permiso insuficiente', permiso: 'rbac:gestionar' });
});

test('requirePermiso: X-Internal-Api-Key (erpUserId null) nunca obtiene bypass, incluso con deps válidas', async () => {
  reset();
  // Simula exactamente la ruta 2 de requireErpAuth: erpUserId null, email presente.
  const sbFetch = almacenConOperador('user-1');
  const middleware = requirePermiso('viajes:listar', { sbFetch });

  const req = { erpUserId: null, erpUserEmail: 'alguien@inlop.com.co' };
  const res = mockRes();
  let nextLlamado = false;
  await middleware(req, res, () => { nextLlamado = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(nextLlamado, false);
});
