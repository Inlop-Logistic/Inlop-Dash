import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createCrmSolicitudesRouter } from "../services/crmSolicitudesRouter.js";
import { readFile } from "node:fs/promises";

const fixture = JSON.parse(await readFile(
  new URL("./fixtures/crm-solicitud-prueba.json", import.meta.url), "utf8"
));

async function withServer(deps, run) {
  const app = express();
  app.use(express.json());
  app.use("/crm", createCrmSolicitudesRouter({
    apiKey: "test-only-secret",
    receiveCrmSolicitud: async () => ({
      ok: true, duplicada: false, solicitud_id: "sol-1",
      codigo_solicitud: "SOL-TEST-00001", empresa_cliente_id: "empresa-1",
      empresa_creada: true,
    }),
    mapTipoVehiculo: (value) => value === "NHR 2.5 toneladas" ? "NHR" : null,
    ...deps,
  }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}/crm/solicitudes`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

async function post(url, payload = fixture, apiKey = "test-only-secret") {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(apiKey ? { "x-crm-api-key": apiKey } : {}) },
    body: JSON.stringify(payload),
  });
}

test("rechaza solicitudes sin la clave del CRM", async () => {
  await withServer({}, async (url) => {
    const response = await post(url, fixture, null);
    assert.equal(response.status, 401);
  });
});

test("rechaza payload inválido antes de invocar la RPC", async () => {
  let calls = 0;
  await withServer({ receiveCrmSolicitud: async () => { calls++; } }, async (url) => {
    const response = await post(url, { ...fixture, canal: "APP" });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Contrato CRM inválido/);
    assert.equal(calls, 0);
  });
});

test("envía ID CRM y correo normalizado a la operación transaccional", async () => {
  let received;
  await withServer({ receiveCrmSolicitud: async (payload) => {
    received = payload;
    return {
      ok: true, duplicada: false, solicitud_id: "sol-1",
      codigo_solicitud: "SOL-TEST-00001", empresa_cliente_id: "empresa-1",
      empresa_creada: true,
    };
  } }, async (url) => {
    const response = await post(url, { ...fixture, creador_email: " Pruebas@InlopLogistica.com " });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.empresa_cliente_id, "empresa-1");
    assert.equal(body.empresa_creada, true);
    assert.equal(received.crm_cliente_id, fixture.crm_cliente_id);
    assert.equal(received.creador_email, "pruebas@inloplogistica.com");
    assert.equal(received.empresa_cliente_id, undefined);
    assert.equal(received.creado_por, undefined);
  });
});

test("reintento devuelve la solicitud existente sin duplicarla", async () => {
  let inserts = 0;
  await withServer({ receiveCrmSolicitud: async () => {
    inserts++;
    return {
      ok: true, duplicada: true, solicitud_id: "sol-existing",
      codigo_solicitud: "SOL-00001", empresa_cliente_id: "empresa-existing",
    };
  } }, async (url) => {
    const response = await post(url);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).duplicada, true);
    assert.equal(inserts, 1);
  });
});

test("responde con error claro si el correo no corresponde a un usuario ERP", async () => {
  await withServer({ receiveCrmSolicitud: async () => ({
    ok: false, error_code: "creator_not_found",
  }) }, async (url) => {
    const response = await post(url);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).codigo, "creator_not_found");
  });
});

test("rechaza un vehículo sin mapeo aprobado", async () => {
  let calls = 0;
  await withServer({
    mapTipoVehiculo: () => null,
    receiveCrmSolicitud: async () => { calls++; },
  }, async (url) => {
    const response = await post(url);
    assert.equal(response.status, 422);
    assert.equal(calls, 0);
  });
});

test("rechaza solicitud sin agencia antes de invocar la RPC", async () => {
  let calls = 0;
  await withServer({ receiveCrmSolicitud: async () => { calls++; } }, async (url) => {
    const response = await post(url, { ...fixture, agencia: { id: "", nombre: "Cartagena" } });
    assert.equal(response.status, 400);
    assert.match((await response.json()).detalles.join(" "), /agencia.id/);
    assert.equal(calls, 0);
  });
});

test("convierte agencia no resuelta en error 422 sin confirmar persistencia", async () => {
  await withServer({ receiveCrmSolicitud: async () => {
    throw new Error("agency_not_found");
  } }, async (url) => {
    const response = await post(url);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).codigo, "agency_not_found");
  });
});
