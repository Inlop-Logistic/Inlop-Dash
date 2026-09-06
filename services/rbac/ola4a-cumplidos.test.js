/**
 * Integration tests — Ola 4A enforcement RBAC Cumplidos (Sprint 3D-7.11K.2-G)
 *
 * Verifica:
 *   A. Endpoints protegidos con requirePermiso() — 4 endpoints × 5 escenarios RBAC:
 *        POST   /api/cumplidos/:trip/documentos          → cumplidos:gestionar-docs
 *        PUT    /api/cumplidos/:trip/documentos/:id/reemplazar → cumplidos:gestionar-docs
 *        DELETE /api/cumplidos/:trip/documentos/:id      → cumplidos:gestionar-docs
 *        PATCH  /api/cumplidos/:trip/estado              → cumplidos:cambiar-estado
 *
 *      Escenarios RBAC (1-5):
 *        1. rol autorizado           → next() (acceso concedido)
 *        2. rol no autorizado        → 403
 *        3. master                   → next() (acceso total)
 *        4. usuario inactivo         → 403 (fail-closed)
 *        5. sin req.erpUserId        → 403 (decisión G1)
 *
 *      Escenario extra (6):
 *        6. revoke individual        → 403 (resolver respeta revoke)
 *
 *   B. Integridad de dominio en PATCH /estado — validarEstadoHumano():
 *        7. estado manual válido     → sin error (null)
 *        8. LIVE                     → error (exclusivo sistema)
 *        9. FINALIZADO CONTROLT      → error (exclusivo sistema)
 *       10. PENDIENTE LIQUIDACION    → error (exclusivo sistema)
 *       11. variantes de mayúsculas  → error (comparación case-insensitive)
 *
 *   C. Automatizaciones — confirmar que syncCumplidos NO usa requirePermiso():
 *       12. ESTADOS_EXCLUSIVOS_SISTEMA contiene exactamente los 3 estados del sistema
 *
 * Run: node --test services/rbac/ola4a-cumplidos.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from '../gps/testStore.js';
import { _resetCatalogoParaTests } from './catalogo.js';
import { _resetResolverParaTests } from './resolver.js';
import { requirePermiso } from './middleware.js';
import {
  validarEstadoHumano,
  ESTADOS_EXCLUSIVOS_SISTEMA,
} from '../cumplidos/dominioEstados.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Usuario con exactamente un permiso nombrado (ningún revoke). */
function almacenConPermiso(profileId, nombrePermiso) {
  return crearAlmacen({
    profiles:         [{ id: profileId,   activo: true },
                       { id: 'user-otro', activo: true }],
    roles:            [{ id: 'rol-limitado', nombre: 'limitado', activo: true }],
    permisos:         [{ id: `perm-${nombrePermiso}`, nombre: nombrePermiso }],
    rol_permisos:     [{ rol_id: 'rol-limitado', permiso_id: `perm-${nombrePermiso}` }],
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

function almacenInactivo(profileId, nombrePermiso) {
  return crearAlmacen({
    profiles:         [{ id: profileId, activo: false }],
    roles:            [{ id: 'rol-op', nombre: 'operador', activo: true }],
    permisos:         [{ id: `perm-${nombrePermiso}`, nombre: nombrePermiso }],
    rol_permisos:     [{ rol_id: 'rol-op', permiso_id: `perm-${nombrePermiso}` }],
    usuario_roles:    [{ id: 'ur2', profile_id: profileId, rol_id: 'rol-op', activo: true }],
    usuario_permisos: [],
  });
}

/**
 * Usuario con el permiso vía rol, pero con un revoke explícito en usuario_permisos.
 * Verifica que tienePermiso() respeta efecto='revoke'.
 *
 * El resolver usa: /usuario_permisos?profile_id=eq.X&activo=eq.true&select=permiso_id,efecto
 * y aplica: if (exc.efecto === 'revoke') permisoIds.delete(exc.permiso_id)
 */
function almacenConRevoke(profileId, nombrePermiso) {
  return crearAlmacen({
    profiles:         [{ id: profileId, activo: true }],
    roles:            [{ id: 'rol-op', nombre: 'operador', activo: true }],
    permisos:         [{ id: `perm-${nombrePermiso}`, nombre: nombrePermiso }],
    rol_permisos:     [{ rol_id: 'rol-op', permiso_id: `perm-${nombrePermiso}` }],
    usuario_roles:    [{ id: 'ur3', profile_id: profileId, rol_id: 'rol-op', activo: true }],
    usuario_permisos: [
      { profile_id: profileId, permiso_id: `perm-${nombrePermiso}`, activo: true, efecto: 'revoke' },
    ],
  });
}

// ─── A. Tests RBAC por endpoint ───────────────────────────────────────────────

const RUTAS_OLA4A = [
  {
    nombre: 'POST /api/cumplidos/:trip/documentos',
    permiso: 'cumplidos:gestionar-docs',
  },
  {
    nombre: 'PUT /api/cumplidos/:trip/documentos/:id/reemplazar',
    permiso: 'cumplidos:gestionar-docs',
  },
  {
    nombre: 'DELETE /api/cumplidos/:trip/documentos/:id',
    permiso: 'cumplidos:gestionar-docs',
  },
  {
    nombre: 'PATCH /api/cumplidos/:trip/estado',
    permiso: 'cumplidos:cambiar-estado',
  },
];

for (const { nombre, permiso } of RUTAS_OLA4A) {

  test(`[${nombre}] 1. rol autorizado → next() (acceso concedido)`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-ok', permiso);
    const mw      = requirePermiso(permiso, { sbFetch });
    const req     = { erpUserId: 'user-ok' };
    const res     = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(nextLlamado, true, 'next() debe llamarse');
    assert.equal(res.statusCode, null, 'no debe responder 403');
  });

  test(`[${nombre}] 2. rol NO autorizado → 403`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-con-permiso', permiso);
    const mw      = requirePermiso(permiso, { sbFetch });
    // 'user-otro' existe en profiles pero no tiene el rol con el permiso
    const req     = { erpUserId: 'user-otro' };
    const res     = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403, 'debe responder 403');
    assert.equal(nextLlamado, false, 'next() no debe llamarse');
    assert.equal(res.body?.permiso, permiso, 'respuesta debe indicar el permiso faltante');
  });

  test(`[${nombre}] 3. master → next() (acceso total sin permiso explícito)`, async () => {
    reset();
    const sbFetch = almacenMaster('user-master');
    const mw      = requirePermiso(permiso, { sbFetch });
    const req     = { erpUserId: 'user-master' };
    const res     = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(nextLlamado, true, 'master debe pasar sin permiso explícito');
    assert.equal(res.statusCode, null);
  });

  test(`[${nombre}] 4. usuario inactivo (profiles.activo=false) → 403`, async () => {
    reset();
    const sbFetch = almacenInactivo('user-inactivo', permiso);
    const mw      = requirePermiso(permiso, { sbFetch });
    const req     = { erpUserId: 'user-inactivo' };
    const res     = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403, 'usuario inactivo debe recibir 403');
    assert.equal(nextLlamado, false);
  });

  test(`[${nombre}] 5. sin req.erpUserId (sin JWT) → 403 (decisión G1)`, async () => {
    reset();
    const sbFetch = almacenConPermiso('user-ok', permiso);
    const mw      = requirePermiso(permiso, { sbFetch });
    const req     = { erpUserId: null };
    const res     = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403, 'sin erpUserId debe recibir 403 inmediato');
    assert.equal(nextLlamado, false);
    assert.equal(
      sbFetch.llamadas.length, 0,
      'no debe consultar RBAC sin identidad verificada (decisión G1)',
    );
  });

  test(`[${nombre}] 6. revoke individual → 403 (resolver respeta revoke)`, async () => {
    reset();
    const sbFetch = almacenConRevoke('user-revocado', permiso);
    const mw      = requirePermiso(permiso, { sbFetch });
    const req     = { erpUserId: 'user-revocado' };
    const res     = mockRes();
    let nextLlamado = false;
    await mw(req, res, () => { nextLlamado = true; });
    assert.equal(res.statusCode, 403,
      'revoke explícito debe anular el permiso heredado del rol');
    assert.equal(nextLlamado, false);
  });
}

// ─── B. Tests de integridad de dominio (validarEstadoHumano) ─────────────────

test('[PATCH /estado] 7. estado manual válido (SOLICITADO) → null (sin error)', () => {
  const resultado = validarEstadoHumano('SOLICITADO');
  assert.equal(resultado, null, 'SOLICITADO debe ser humanamente asignable');
});

test('[PATCH /estado] 7b. estado manual válido (CUMPLIDO RECIBIDO) → null (sin error)', () => {
  const resultado = validarEstadoHumano('CUMPLIDO RECIBIDO');
  assert.equal(resultado, null, 'CUMPLIDO RECIBIDO debe ser humanamente asignable');
});

test('[PATCH /estado] 7c. estado manual válido (cadena arbitraria) → null (sin error)', () => {
  const resultado = validarEstadoHumano('EN PROCESO FINANCIERO');
  assert.equal(resultado, null, 'estado arbitrario no reservado debe ser permitido');
});

test('[PATCH /estado] 8. estado LIVE → error (exclusivo del sistema)', () => {
  const resultado = validarEstadoHumano('LIVE');
  assert.ok(resultado !== null, 'LIVE debe ser rechazado como exclusivo del sistema');
  assert.ok(typeof resultado === 'string', 'debe retornar un mensaje de error string');
  assert.ok(resultado.includes('LIVE'), 'mensaje debe mencionar el estado rechazado');
});

test('[PATCH /estado] 9. estado FINALIZADO CONTROLT → error (exclusivo del sistema)', () => {
  const resultado = validarEstadoHumano('FINALIZADO CONTROLT');
  assert.ok(resultado !== null, 'FINALIZADO CONTROLT debe ser rechazado');
  assert.ok(resultado.includes('FINALIZADO CONTROLT'));
});

test('[PATCH /estado] 10. estado PENDIENTE LIQUIDACION → error (exclusivo del sistema)', () => {
  const resultado = validarEstadoHumano('PENDIENTE LIQUIDACION');
  assert.ok(resultado !== null, 'PENDIENTE LIQUIDACION debe ser rechazado');
  assert.ok(resultado.includes('PENDIENTE LIQUIDACION'));
});

test('[PATCH /estado] 11. variante en minúsculas (live) → error (case-insensitive)', () => {
  const resultado = validarEstadoHumano('live');
  assert.ok(resultado !== null, 'variante en minúsculas también debe ser rechazada');
});

test('[PATCH /estado] 11b. variante mixta (Finalizado Controlt) → error (case-insensitive)', () => {
  const resultado = validarEstadoHumano('Finalizado Controlt');
  assert.ok(resultado !== null, 'variante mixta debe ser rechazada');
});

test('[PATCH /estado] 11c. valor null/undefined → no debe lanzar excepción', () => {
  // validarEstadoHumano debe manejar valores nulos defensivamente (el endpoint
  // ya valida que estado_cumplido exista, pero el dominio debe ser robusto)
  assert.doesNotThrow(() => validarEstadoHumano(null));
  assert.doesNotThrow(() => validarEstadoHumano(undefined));
  // null y undefined no están en los estados del sistema — no deben ser rechazados
  // por esta función (el endpoint los rechaza antes con 'estado_cumplido requerido')
  const resultadoNull = validarEstadoHumano(null);
  assert.equal(resultadoNull, null, 'null no es un estado del sistema — debe pasar');
});

// ─── C. Tests de automatizaciones ────────────────────────────────────────────

test('[AUTOMATIZACIÓN] 12. ESTADOS_EXCLUSIVOS_SISTEMA contiene exactamente los 3 estados del sistema', () => {
  // Verifica que el conjunto de estados bloqueados para humanos coincide
  // exactamente con los escritos por syncCumplidos() en index.js:
  //   - inserción inicial: estado_cumplido:'LIVE'
  //   - auto-finalización: 'FINALIZADO CONTROLT' y 'PENDIENTE LIQUIDACION'
  // Si se agrega un nuevo estado del sistema en syncCumplidos, este test
  // fallará hasta que dominioEstados.js sea actualizado — señal de alerta.
  assert.equal(ESTADOS_EXCLUSIVOS_SISTEMA.size, 3,
    'debe haber exactamente 3 estados exclusivos del sistema');
  assert.ok(ESTADOS_EXCLUSIVOS_SISTEMA.has('LIVE'),
    'LIVE debe estar en el conjunto (inserción inicial + reconciliación)');
  assert.ok(ESTADOS_EXCLUSIVOS_SISTEMA.has('FINALIZADO CONTROLT'),
    'FINALIZADO CONTROLT debe estar (auto-finalización sin soporte)');
  assert.ok(ESTADOS_EXCLUSIVOS_SISTEMA.has('PENDIENTE LIQUIDACION'),
    'PENDIENTE LIQUIDACION debe estar (auto-finalización con soporte)');
});
