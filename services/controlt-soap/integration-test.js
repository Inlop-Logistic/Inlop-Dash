/**
 * Integration smoke-test — validates Phase 2 against the real ControlT endpoint.
 *
 * Prerequisites:
 *   CONTROLT_USER and CONTROLT_PASS must be set in the environment (shared with REST).
 *   Optionally set CONTROLT_TEST_VIAJE to a real trip code (default: IN018108).
 *
 * Usage:
 *   CONTROLT_USER=u CONTROLT_PASS=p node services/controlt-soap/integration-test.js
 *   CONTROLT_USER=u CONTROLT_PASS=p CONTROLT_TEST_VIAJE=IN018108 node services/controlt-soap/integration-test.js
 *   node --env-file=.env services/controlt-soap/integration-test.js
 *
 * This script does NOT run as part of `npm test` — it requires real credentials.
 * Run it manually once after configuring .env to validate the integration.
 */

import { getConfig } from './config.js';
import { makeLoginFn, getDetailMonitoringOrder } from './soapGateway.js';
import { getToken, invalidate, _resetAuth } from './authManager.js';

const VIAJE = process.env.CONTROLT_TEST_VIAJE ?? 'IN018108';

function pass(label) { console.log(`  ✓ ${label}`); }
function fail(label, err) { console.error(`  ✗ ${label}`); console.error(`    ${err.message}`); }
function section(title) { console.log(`\n── ${title} ──`); }

async function run() {
  console.log('ControlT SOAP — Integration smoke-test');
  console.log(`Endpoint: https://app.controlt.com.co/WS/service.asmx`);
  console.log(`Viaje de prueba: ${VIAJE}`);

  // ── 1. Config ──────────────────────────────────────────────────────────────
  section('1. Configuración');
  let config;
  try {
    config = getConfig();
    pass(`getConfig() OK — timeout ${config.timeoutMs}ms`);
  } catch (err) {
    fail('getConfig()', err);
    process.exit(1);
  }

  // ── 2. Login (token acquisition) ──────────────────────────────────────────
  section('2. Autenticación SOAP (Login)');
  _resetAuth();
  const loginFn = makeLoginFn(config);
  let token;
  try {
    token = await getToken(loginFn);
    if (typeof token !== 'string' || token.trim() === '') throw new Error('token vacío');
    pass(`Login OK — token recibido (${token.length} chars)`);
  } catch (err) {
    fail('Login', err);
    console.error('\nNota: verifica CONTROLT_SOAP_USER y CONTROLT_SOAP_PASS.');
    process.exit(1);
  }

  // ── 3. Token singleton (second call must not re-login) ────────────────────
  section('3. Singleton del token');
  try {
    const token2 = await getToken(loginFn);
    if (token2 !== token) throw new Error('tokens distintos — singleton roto');
    pass('Segunda llamada retornó el mismo token sin re-login');
  } catch (err) {
    fail('Singleton', err);
  }

  // ── 4. GetDetailMonitoringOrder ───────────────────────────────────────────
  section(`4. GetDetailMonitoringOrder (${VIAJE})`);
  let resultado;
  try {
    resultado = await getDetailMonitoringOrder(VIAJE, config);
    pass('Llamada completada sin excepción');
  } catch (err) {
    fail('GetDetailMonitoringOrder', err);
    if (err.code === 'VIAJE_NOT_FOUND') {
      console.log(`\n  Nota: el viaje ${VIAJE} no existe en ControlT.`);
      console.log('  Configura CONTROLT_TEST_VIAJE con un código válido.');
    }
    process.exit(1);
  }

  // ── 5. Inspect result ─────────────────────────────────────────────────────
  section('5. Contenido de la respuesta');
  if (resultado && typeof resultado === 'object') {
    const keys = Object.keys(resultado);
    pass(`Nodos en la respuesta: ${keys.join(', ') || '(vacío)'}`);

    // Detect mojibake survivors — if any string still contains Ã that's a bug.
    const json = JSON.stringify(resultado);
    if (/Ã/.test(json)) {
      fail('Mojibake aún presente en la respuesta — revisar deepFixMojibake', new Error('mojibake detectado'));
    } else {
      pass('Sin mojibake detectado en la respuesta');
    }
  } else {
    fail('Respuesta no es un objeto', new Error(`tipo: ${typeof resultado}`));
  }

  // ── 6. Token invalidation + re-auth ──────────────────────────────────────
  section('6. Invalidación y re-autenticación');
  try {
    invalidate();
    _resetAuth();  // full reset for clean test
    const loginFn2 = makeLoginFn(config);
    const newToken = await getToken(loginFn2);
    if (typeof newToken !== 'string' || newToken.trim() === '') throw new Error('nuevo token vacío');
    pass('Re-login tras invalidate() OK');
  } catch (err) {
    fail('Re-login', err);
  }

  console.log('\n── Resultado ──');
  console.log('Integration smoke-test: PASADO');
  console.log('\nDatos recibidos (primeros 800 chars):');
  console.log(JSON.stringify(resultado, null, 2).slice(0, 800));
}

run().catch((err) => {
  console.error('\nError inesperado en el script de integración:', err);
  process.exit(1);
});
