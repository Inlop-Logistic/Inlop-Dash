import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validarSolicitudCrm } from '../services/crmSolicitudContract.js';

const fixtureUrl = new URL('./fixtures/crm-solicitud-prueba.json', import.meta.url);
const payload = JSON.parse(await readFile(fixtureUrl, 'utf8'));

test('acepta el payload ficticio CRM de contrato', () => {
  const result = validarSolicitudCrm(payload);
  assert.equal(result.ok, true, JSON.stringify(result.errores));
  assert.equal(result.solicitud.canal, 'CRM');
  assert.equal(result.solicitud.cliente_nombre, 'Empresa de Prueba S.A.S.');
  assert.equal(result.solicitud.external_ref, 'CRM:crm-sol-001');
});

test('rechaza canal APP u otro distinto de CRM', () => {
  const result = validarSolicitudCrm({ ...payload, canal: 'APP' });
  assert.equal(result.ok, false);
  assert.ok(result.errores.some(e => e.includes('"canal"')));
});

test('rechaza fecha sin zona horaria explícita', () => {
  const result = validarSolicitudCrm({ ...payload, fecha_requerida: '2026-10-26T09:00:00' });
  assert.equal(result.ok, false);
  assert.ok(result.errores.some(e => e.includes('desplazamiento horario')));
});

test('rechaza discrepancia entre ID de solicitud y external_ref', () => {
  const result = validarSolicitudCrm({ ...payload, external_ref: 'CRM:otra-solicitud' });
  assert.equal(result.ok, false);
  assert.ok(result.errores.some(e => e.includes('"external_ref"')));
});

test('rechaza discrepancia entre metadata y el ID principal', () => {
  const result = validarSolicitudCrm({
    ...payload,
    metadata: { ...payload.metadata, crm_solicitud_id: 'otro-id' },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errores.some(e => e.includes('metadata.crm_solicitud_id')));
});

test('rechaza payload sin identidad CRM', () => {
  const { crm_solicitud_id, ...sinId } = payload;
  const result = validarSolicitudCrm(sinId);
  assert.equal(result.ok, false);
  assert.ok(result.errores.some(e => e.includes('"crm_solicitud_id"')));
});
