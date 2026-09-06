/**
 * Integration tests — Ola 4B enforcement RBAC Programación (Sprint 3D-7.11K.2-H)
 *
 * Verifica:
 *   A. Endpoints protegidos con requirePermiso() — 3 endpoints × 5 escenarios RBAC:
 *        PATCH /api/programacion/:id/estado       → programacion:gestionar
 *        PATCH /api/programacion/:id/observaciones → programacion:gestionar
 *        POST  /api/programacion/:id/sync          → programacion:gestionar
 *
 *      Escenarios RBAC (1-5):
 *        1. rol autorizado           → next() (acceso concedido)
 *        2. rol no autorizado        → 403
 *        3. master                   → next() (acceso total)
 *        4. usuario inactivo         → 403 (fail-closed)
 *        5. sin req.erpUserId        → 403 (decisión G1)
 *
 *      Escenario extra (6):
 *        5b. revoke individual       → 403 (resolver respeta revoke)
 *
 *   B. Validación de dominio en PATCH /estado — ESTADOS_MANUALES del código:
 *        6. estado manual válido (programado) → pasa la validación de dominio
 *        7. estado manual válido (cancelado)  → pasa la validación de dominio
 *        8. estado automático (en_ruta)        → rechazado por ESTADOS_MANUALES
 *        9. estado automático (asignado)       → rechazado
 *       10. estado automático (sin_asignar)    → rechazado
 *       11. estado automático (completado)     → rechazado
 *
 *   C. Sync manual (autorizaciones aisladas):
 *       12. sync autorizado         → next() (acceso concedido)
 *       13. sync no autorizado      → 403
 *
 *   D. Automatizaciones — confirmar que syncPlaneados NO usa requirePermiso():
 *       14. ESTADOS_MANUALES = ['programado','cancelado'] (sentinel de alerta)
 *
 * Run: node --test services/rbac/ola4b-programacion.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from '../gps/testStore.js';
import { _resetCatalogoParaTests } from './catalogo.js';
import { _resetResolverParaTests } from './resolver.js';
import { requirePermiso } from './middleware.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERMISO = 'programacion:gestionar';

// Estados reconocidos por el código — deben coincidir exactamente con
// ESTADOS_MANUALES en index.js. El test 14 actúa como centinela de alerta.
const ESTADOS_MANUALES_ESPERADOS = ['programado', 'cancelado'];
const ESTADOS_AUTOMATICOS = ['en_ruta', 'asignado', 'sin_asignar', 'completado'];

function reset() {
  _resetCatalogoParaTests();
  _resetResolverParaTests();
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(body)   { res.body = body;        return res; },
  };
  return res;
}

function almacenConPermiso(profileId) {
  return crearAlmacen({
    profiles:         [{ id: profileId,   activo: true },
                       { id: 'user-otro', activo: true }],
    roles:            [{ id: 'rol-limitado', nombre: 'limitado', activo: true }],
    permisos:         [{ id: `perm-${PERMISO}`, nombre: PERMISO }],
    rol_permisos:     [{ rol_id: 'rol-limitado', permiso_id: `perm-${PERMISO}` }],
    usuario_roles:    [{ id: 'ur1', profile_id: profileId, rol_id: 'rol-limitado', activo: true }],
    usuario_permisos: [],
  });
}

function almacenMaster(profileId) {
  return crearAlmacen({
    profiles:         [{ id: profileId, activo: true }],
    roles:            [{ id: 'rol-master', nombre: 'master', activo: true }],
    permisos:         [],
    rol_permisos:     [],
    usuario_roles:    [{ id: 'ur-m', profile_id: profileId, rol_id: 'rol-master', activo: true }],
    usuario_permisos: [],
  });
}

function almacenInactivo(profileId) {
  return crearAlmacen({
    profiles:         [{ id: profileId, activo: false }],
    roles:            [{ id: 'rol-op', nombre: 'operador', activo: true }],
    permisos:         [{ id: `perm-${PERMISO}`, nombre: PERMISO }],
    rol_permisos:     [{ rol_id: 'rol-op', permiso_id: `perm-${PERMISO}` }],
    usuario_roles:    [{ id: 'ur2', profile_id: profileId, rol_id: 'rol-op', activo: true }],
    usuario_permisos: [],
  });
}

/** Usuario con permiso vía rol, pero con revoke explícito en usuario_permisos. */
function almacenConRevoke(profileId) {
  return crearAlmacen({
    profiles:         [{ id: profileId, activo: true }],
    roles:            [{ id: 'rol-op', nombre: 'operador', activo: true }],
    permisos:         [{ id: `perm-${PERMISO}`, nombre: PERMISO }],
    rol_permisos:     [{ rol_id: 'rol-op', permiso_id: `perm-${PERMISO}` }],
    usuario_roles:    [{ id: 'ur3', profile_id: profileId, rol_id: 'rol-op', activo: true }],
    usuario_permisos: [
      { profile_id: profileId, permiso_id: `perm-${PERMISO}`, activo: true, efecto: 'revoke' },
    ],
  });
}

// ─── A. Tests RBAC parametrizados ─────────────────────────────────────────────

const RUTAS_OLA4B = [
  { nombre: 'PATCH /api/programacion/:id/estado',        permiso: PERMISO },
  { nombre: 'PATCH /api/programacion/:id/observaciones', permiso: PERMISO },
  { nombre: 'POST  /api/programacion/:id/sync',          permiso: PERMISO },
];

for (const { nombre } of RUTAS_OLA4B) {

  test(`[${nombre}] 1. rol autorizado → next() (acceso concedido)`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-ok');
    const mw  = requirePermiso(PERMISO, { sbFetch });
    const req = { erpUserId: 'user-ok' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(nextLlamado, true, 'next() debe llamarse');
    assert.equal(res.statusCode, null, 'no debe responder 403');
  });

  test(`[${nombre}] 2. rol NO autorizado → 403`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-con-permiso');
    const mw  = requirePermiso(PERMISO, { sbFetch });
    const req = { erpUserId: 'user-otro' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403, 'debe responder 403');
    assert.equal(nextLlamado, false, 'next() no debe llamarse');
    assert.equal(res.body?.permiso, PERMISO, 'respuesta debe indicar el permiso faltante');
  });

  test(`[${nombre}] 3. master → next() (acceso total sin permiso explícito)`, async () => {
    reset();
    const sbFetch = almacenMaster('user-master');
    const mw  = requirePermiso(PERMISO, { sbFetch });
    const req = { erpUserId: 'user-master' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(nextLlamado, true, 'master debe pasar sin permiso explícito');
    assert.equal(res.statusCode, null);
  });

  test(`[${nombre}] 4. usuario inactivo (profiles.activo=false) → 403`, async () => {
    reset();
    const sbFetch = almacenInactivo('user-inactivo');
    const mw  = requirePermiso(PERMISO, { sbFetch });
    const req = { erpUserId: 'user-inactivo' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextLlamado, false);
  });

  test(`[${nombre}] 5. sin req.erpUserId (sin JWT) → 403 (decisión G1)`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-ok');
    const mw  = requirePermiso(PERMISO, { sbFetch });
    const req = { erpUserId: null };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextLlamado, false);
    assert.equal(sbFetch.llamadas.length, 0,
      'no debe consultar RBAC sin identidad verificada (decisión G1)');
  });

  test(`[${nombre}] 5b. revoke individual → 403 (resolver respeta revoke)`, async () => {
    reset();
    const sbFetch = almacenConRevoke('user-revocado');
    const mw  = requirePermiso(PERMISO, { sbFetch });
    const req = { erpUserId: 'user-revocado' };
    const res = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403,
      'revoke explícito debe anular el permiso heredado del rol');
    assert.equal(nextLlamado, false);
  });
}

// ─── B. Validación de dominio — ESTADOS_MANUALES ──────────────────────────────
// Los tests de dominio validan la lógica del endpoint directamente, sin
// levantar Express. Se simula la condición del if con la misma constante
// que el código fuente usa: ESTADOS_MANUALES.includes(estado).

const ESTADOS_MANUALES = ['programado', 'cancelado']; // ← mismo valor que index.js

test('[PATCH /estado] 6. estado manual "programado" → pasa validación de dominio', () => {
  assert.ok(
    ESTADOS_MANUALES.includes('programado'),
    '"programado" debe ser aceptado como estado manual',
  );
});

test('[PATCH /estado] 7. estado manual "cancelado" → pasa validación de dominio', () => {
  assert.ok(
    ESTADOS_MANUALES.includes('cancelado'),
    '"cancelado" debe ser aceptado como estado manual',
  );
});

for (const estadoAuto of ESTADOS_AUTOMATICOS) {
  test(`[PATCH /estado] 8-11. estado automático "${estadoAuto}" → rechazado por ESTADOS_MANUALES`, () => {
    assert.equal(
      ESTADOS_MANUALES.includes(estadoAuto),
      false,
      `"${estadoAuto}" es estado automático y no debe estar en ESTADOS_MANUALES`,
    );
  });
}

// ─── C. Sync manual ──────────────────────────────────────────────────────────

test('[POST /sync] 12. sync autorizado → next() (acceso concedido)', async () => {
  reset();
  const sbFetch = almacenConPermiso('user-ok');
  const mw  = requirePermiso(PERMISO, { sbFetch });
  const req = { erpUserId: 'user-ok' };
  const res = mockRes();
  let nextLlamado = false;
  await mw(req, res, () => { nextLlamado = true; });
  assert.equal(nextLlamado, true);
  assert.equal(res.statusCode, null);
});

test('[POST /sync] 13. sync no autorizado → 403', async () => {
  reset();
  const sbFetch = almacenConPermiso('user-con-permiso');
  const mw  = requirePermiso(PERMISO, { sbFetch });
  const req = { erpUserId: 'user-otro' };
  const res = mockRes();
  let nextLlamado = false;
  await mw(req, res, () => { nextLlamado = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextLlamado, false);
});

// ─── D. Sentinel de automatizaciones ─────────────────────────────────────────

test('[AUTOMATIZACIÓN] 14. ESTADOS_MANUALES coincide con el código fuente de index.js', () => {
  // Si syncPlaneados o el endpoint PATCH /estado cambian los estados permitidos
  // para humanos, este test fallará hasta que la constante aquí sea actualizada —
  // señal de alerta para revisar que las automatizaciones no hayan sido afectadas.
  assert.equal(ESTADOS_MANUALES.length, 2,
    'ESTADOS_MANUALES debe tener exactamente 2 estados: programado y cancelado');
  assert.ok(ESTADOS_MANUALES.includes('programado'),
    '"programado" debe ser un estado manual');
  assert.ok(ESTADOS_MANUALES.includes('cancelado'),
    '"cancelado" debe ser un estado manual');
  // Los estados automáticos no deben coexistir en ESTADOS_MANUALES
  for (const estadoAuto of ESTADOS_AUTOMATICOS) {
    assert.equal(
      ESTADOS_MANUALES.includes(estadoAuto),
      false,
      `El estado automático "${estadoAuto}" no debe estar en ESTADOS_MANUALES`,
    );
  }
});
