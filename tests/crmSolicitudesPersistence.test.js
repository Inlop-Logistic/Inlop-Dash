import test from "node:test";
import assert from "node:assert/strict";
import { createCrmSolicitudesPersistence } from "../services/crmSolicitudesPersistence.js";

test("usa la RPC transaccional para crear/resolver empresa y solicitud", async () => {
  const calls = [];
  const persistence = createCrmSolicitudesPersistence({
    sbFetch: async (...args) => {
      calls.push(args);
      return {
        ok: true, duplicada: false, solicitud_id: "sol-1",
        codigo_solicitud: "SOL-00001", empresa_cliente_id: "empresa-1",
      };
    },
  });
  const payload = { crm_solicitud_id: "crm-sol-1", crm_cliente_id: "crm-cli-1" };
  const result = await persistence.receiveCrmSolicitud(payload);
  assert.equal(result.solicitud_id, "sol-1");
  assert.equal(calls[0][0], "/rpc/recibir_solicitud_crm");
  assert.equal(calls[0][1], "POST");
  assert.deepEqual(calls[0][2], { p_payload: payload });
});

test("falla si la RPC no confirma la operación", async () => {
  const persistence = createCrmSolicitudesPersistence({ sbFetch: async () => null });
  await assert.rejects(
    () => persistence.receiveCrmSolicitud({ crm_solicitud_id: "crm-sol-1" }),
    /no confirmó la operación/,
  );
});
