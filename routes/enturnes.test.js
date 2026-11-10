/**
 * Unit tests for routes/enturnes.js (Enturne de Vehículos)
 * Run: node --test routes/enturnes.test.js
 *
 * No se levanta Express ni se abre ningún socket: se toma el handler real
 * del router (router.stack) y se invoca directamente con un req/res de
 * prueba, inyectando un fetchConTimeout simulado en lugar de red real. Así
 * se prueba exactamente la lógica de interpretación de la respuesta de
 * PostgREST (201/204 éxito, 409/23505 ya-enturnado, otros → 500) que no
 * tiene cobertura en normalizar.test.js/antiSpam.test.js — esas piezas ya
 * están probadas por separado y aquí se usan tal cual (sin mocks).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crearRouterEnturnes, { ipClienteEnturne } from './enturnes.js';
import { _resetParaTests } from '../services/enturnes/antiSpam.js';

beforeEach(() => { _resetParaTests(); });

function obtenerHandler(router) {
  const capa = router.stack.find((l) => l.route && l.route.path === '/');
  return capa.route.stack[0].handle;
}

function crearResMock() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

function crearReqMock({ body = {}, ip = '10.0.0.1' } = {}) {
  return { body, headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip } };
}

function crearRouterConFetch(fetchImpl, overrides = {}) {
  return crearRouterEnturnes({
    fetchConTimeout: fetchImpl,
    SB_URL: 'https://fake.supabase.co/rest/v1',
    SB_HEADERS: { apikey: 'fake', Authorization: 'Bearer fake' },
    serviceKeyConfigurado: true,
    ...overrides,
  });
}

function solicitudValida(overrides = {}) {
  return {
    nombre: 'Juan Pérez',
    placa: 'ABC 123',
    tipo_vehiculo: 'Turbo',
    tipo_carroceria: 'Estaca',
    capacidad_toneladas: 5,
    ruta_frecuente: 'Cartagena-Barranquilla',
    ...overrides,
  };
}

// ── helper ipClienteEnturne ─────────────────────────────────────────────────

test('ipClienteEnturne: con un solo valor en x-forwarded-for, lo usa', () => {
  const req = { headers: { 'x-forwarded-for': '203.0.113.5' }, socket: { remoteAddress: '10.0.0.1' } };
  assert.equal(ipClienteEnturne(req), '203.0.113.5');
});

test('ipClienteEnturne: con varios valores, usa el ÚLTIMO (el que agrega el proxy confiable), no el primero', () => {
  // El primer valor es lo que el propio cliente envió (no confiable — un
  // atacante puede poner cualquier cosa ahí para evadir el límite de tasa).
  // Railway agrega la IP real como último valor de la lista.
  const req = { headers: { 'x-forwarded-for': '1.2.3.4-FALSO-DEL-CLIENTE, 203.0.113.5' }, socket: { remoteAddress: '10.0.0.1' } };
  assert.equal(ipClienteEnturne(req), '203.0.113.5');
});

test('ipClienteEnturne: ignora espacios y valores vacíos al tomar el último', () => {
  const req = { headers: { 'x-forwarded-for': '198.51.100.1,  203.0.113.5  ' }, socket: { remoteAddress: '10.0.0.1' } };
  assert.equal(ipClienteEnturne(req), '203.0.113.5');
});

test('ipClienteEnturne: cae a socket.remoteAddress sin x-forwarded-for', () => {
  const req = { headers: {}, socket: { remoteAddress: '10.0.0.9' } };
  assert.equal(ipClienteEnturne(req), '10.0.0.9');
});

// ── fail-closed: SUPABASE_SERVICE_KEY no configurada ────────────────────────

test('serviceKeyConfigurado=false: responde 503 sin llamar a fetch (nunca intenta con la anon key)', async () => {
  let llamadoFetch = false;
  const router = crearRouterConFetch(async () => { llamadoFetch = true; }, { serviceKeyConfigurado: false });
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida() }), res);

  assert.equal(llamadoFetch, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
});

test('serviceKeyConfigurado=false: se corta ANTES del honeypot/rate-limit (ni siquiera los evalúa)', async () => {
  // No debe consumirse el contador de tasa cuando el servicio está
  // deshabilitado por falta de service key — evita que una ventana de
  // mala configuración "gaste" el límite de tasa real de los usuarios.
  let llamadoFetch = false;
  const router = crearRouterConFetch(async () => { llamadoFetch = true; }, { serviceKeyConfigurado: false });
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: { ...solicitudValida(), _hp: 'spam' } }), res);

  assert.equal(llamadoFetch, false);
  assert.equal(res.statusCode, 503);
});

// ── POST / (handler) ────────────────────────────────────────────────────────

test('honeypot con contenido: responde éxito falso sin llamar a fetch', async () => {
  let llamadoFetch = false;
  const router = crearRouterConFetch(async () => { llamadoFetch = true; });
  const handler = obtenerHandler(router);

  const req = crearReqMock({ body: { ...solicitudValida(), _hp: 'spam' } });
  const res = crearResMock();
  await handler(req, res);

  assert.equal(llamadoFetch, false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, enturnado: true });
});

test('límite de tasa excedido: responde 429 sin llamar a fetch en la solicitud bloqueada', async () => {
  let llamadasFetch = 0;
  const router = crearRouterConFetch(async () => { llamadasFetch++; return { status: 201, text: async () => '' }; });
  const handler = obtenerHandler(router);

  const ip = '10.0.0.5';
  // Primeras 5 solicitudes pasan el límite de tasa (y sí llegan a fetch).
  for (let i = 0; i < 5; i++) {
    await handler(crearReqMock({ body: solicitudValida(), ip }), crearResMock());
  }
  assert.equal(llamadasFetch, 5);

  // La 6ª, en la misma ventana, debe bloquearse ANTES de llamar a fetch.
  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida(), ip }), res);

  assert.equal(llamadasFetch, 5, 'la solicitud bloqueada no debe llegar a fetch');
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.ok, false);
});

test('validación falla: responde 400 con los errores, sin llamar a fetch', async () => {
  let llamadoFetch = false;
  const router = crearRouterConFetch(async () => { llamadoFetch = true; });
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida({ placa: '' }) }), res);

  assert.equal(llamadoFetch, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.ok(res.body.error.includes('placa'));
});

test('Supabase responde 201: éxito, enturnado:true', async () => {
  const router = crearRouterConFetch(async () => ({ status: 201, text: async () => '' }));
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida() }), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, enturnado: true });
});

test('Supabase responde 204: éxito, enturnado:true', async () => {
  const router = crearRouterConFetch(async () => ({ status: 204, text: async () => '' }));
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida() }), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, enturnado: true });
});

test('Supabase responde 409 (violación UNIQUE): ya enturnado, no es error', async () => {
  const router = crearRouterConFetch(async () => ({ status: 409, text: async () => 'duplicate key value violates unique constraint' }));
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida() }), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, enturnado: false, yaEnturnado: true });
});

test('Supabase responde 400 con código 23505 en el cuerpo: también se trata como ya enturnado', () => {
  return (async () => {
    const router = crearRouterConFetch(async () => ({ status: 400, text: async () => '{"code":"23505","message":"..."}' }));
    const handler = obtenerHandler(router);

    const res = crearResMock();
    await handler(crearReqMock({ body: solicitudValida() }), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, enturnado: false, yaEnturnado: true });
  })();
});

test('Supabase responde 500: se traduce a error genérico 500, sin filtrar detalles internos', async () => {
  const router = crearRouterConFetch(async () => ({ status: 500, text: async () => 'internal supabase error detail' }));
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida() }), res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.ok, false);
  assert.ok(!res.body.error.includes('internal supabase error detail'));
});

test('fetchConTimeout lanza (timeout/red caída): responde 500 sin reventar', async () => {
  const router = crearRouterConFetch(async () => { throw new Error('fetch failed: timeout'); });
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida() }), res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.ok, false);
});

test('solicitud válida con volumen_m3: se envía fecha_operativa y los datos saneados a Supabase', async () => {
  let cuerpoEnviado = null;
  const router = crearRouterConFetch(async (url, opts) => {
    cuerpoEnviado = JSON.parse(opts.body);
    return { status: 201, text: async () => '' };
  });
  const handler = obtenerHandler(router);

  const res = crearResMock();
  await handler(crearReqMock({ body: solicitudValida({ volumen_m3: '12.5' }) }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(cuerpoEnviado.placa_normalizada, 'ABC123');
  assert.equal(cuerpoEnviado.volumen_m3, 12.5);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(cuerpoEnviado.fecha_operativa));
});
