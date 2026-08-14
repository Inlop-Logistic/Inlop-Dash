/**
 * Unit tests for services/gps/accesos.js
 * Run: node --test services/gps/accesos.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen } from './testStore.js';
import { registrarAcceso } from './accesos.js';

test('registrarAcceso inserta una fila con los campos esperados', async () => {
  const sbFetch = crearAlmacen({});
  await registrarAcceso({
    enlaceId: 'E1', correo: 'a@x.com', evento: 'otp_solicitado', exitoso: true,
    detalle: { foo: 'bar' }, ip: '1.2.3.4', userAgent: 'test-agent',
  }, { sbFetch });

  const filas = sbFetch.tablas.reportes_gps_enlaces_accesos;
  assert.equal(filas.length, 1);
  assert.equal(filas[0].enlace_id, 'E1');
  assert.equal(filas[0].correo, 'a@x.com');
  assert.equal(filas[0].evento, 'otp_solicitado');
  assert.equal(filas[0].exitoso, true);
  assert.deepEqual(filas[0].detalle, { foo: 'bar' });
});

test('registrarAcceso no lanza si falta sbFetch (nunca debe romper el flujo real)', async () => {
  await assert.doesNotReject(() => registrarAcceso({ evento: 'algo' }, {}));
});

test('registrarAcceso no lanza si falta el evento — no registra nada', async () => {
  const sbFetch = crearAlmacen({});
  await registrarAcceso({}, { sbFetch });
  assert.equal(sbFetch.tablas.reportes_gps_enlaces_accesos?.length ?? 0, 0);
});

test('registrarAcceso no lanza si sbFetch falla', async () => {
  const sbFetchFalla = async () => { throw new Error('red caída'); };
  await assert.doesNotReject(() => registrarAcceso({ evento: 'x' }, { sbFetch: sbFetchFalla }));
});
