import test from "node:test";
import assert from "node:assert/strict";
import { createCrmSolicitudesPersistence } from "../services/crmSolicitudesPersistence.js";

test("consulta por ID estable de solicitud CRM", async () => {
  const calls = [];
  const persistence = createCrmSolicitudesPersistence({
    sbFetch: async (...args) => {
      calls.push(args);
      return [{ id: "sol-1", codigo_solicitud: "SOL-00001", crm_solicitud_id: "crm-1" }];
    },
    createCodigoSolicitud: async () => "SOL-00002",
  });
  const row = await persistence.findByCrmSolicitudId("crm-1");
  assert.equal(row.id, "sol-1");
  assert.match(calls[0][0], /crm_solicitud_id=eq.crm-1/);
});

test("inserción usa conflicto atómico y no crea segunda fila", async () => {
  const calls = [];
  const persistence = createCrmSolicitudesPersistence({
    sbFetch: async (...args) => {
      calls.push(args);
      // PostgREST devuelve lista vacía con resolution=ignore-duplicates si
      // la clave única ya existe y no se insertó una fila nueva.
      return [];
    },
    createCodigoSolicitud: async () => "SOL-00002",
  });
  const result = await persistence.insertIfAbsent({
    crm_solicitud_id: "crm-1", canal: "CRM",
  });
  assert.equal(result, null);
  assert.equal(calls[0][1], "POST");
  assert.match(calls[0][0], /on_conflict=crm_solicitud_id/);
  assert.equal(calls[0][3].Prefer, "resolution=ignore-duplicates,return=representation");
});

test("falla de forma explícita si PostgREST no confirma la inserción", async () => {
  const persistence = createCrmSolicitudesPersistence({
    sbFetch: async () => null,
    createCodigoSolicitud: async () => "SOL-00002",
  });
  await assert.rejects(
    () => persistence.insertIfAbsent({ crm_solicitud_id: "crm-1" }),
    /No se pudo confirmar la inserción CRM/,
  );
});
