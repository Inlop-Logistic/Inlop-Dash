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
    createCodigoSolicitud: async () => "SOL-TEST-00001",
    mapTipoVehiculo: (value) => value === "NHR 2.5 toneladas" ? "NHR" : null,
    now: () => "2026-10-25T12:00:00.000Z",
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

test("rechaza solicitudes sin la clave del CRM", async () => {
  await withServer({
    insertIfAbsent: async () => { throw new Error("no debe insertar"); },
    findByCrmSolicitudId: async () => null,
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(fixture),
    });
    assert.equal(response.status, 401);
  });
});

test("rechaza payload inválido antes de acceder a persistencia", async () => {
  await withServer({
    insertIfAbsent: async () => { throw new Error("no debe insertar"); },
    findByCrmSolicitudId: async () => null,
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-crm-api-key": "test-only-secret" },
      body: JSON.stringify({ ...fixture, canal: "APP" }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Contrato CRM inválido/);
  });
});

test("crea solicitud sin crear cliente maestro y preserva nombre externo", async () => {
  let row;
  await withServer({
    findByCrmSolicitudId: async () => null,
    insertIfAbsent: async (value) => { row = value; return { id: "sol-1", codigo_solicitud: value.codigo_solicitud }; },
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-crm-api-key": "test-only-secret" },
      body: JSON.stringify(fixture),
    });
    assert.equal(response.status, 201);
    assert.equal(row.empresa_cliente_id, null);
    assert.equal(row.creado_por, null);
    assert.equal(row.cliente_nombre_externo, fixture.cliente_nombre);
    assert.equal(row.canal, "CRM");
    assert.equal(row.crm_solicitud_id, fixture.crm_solicitud_id);
    assert.equal(row.estado, "pendiente");
  });
});

test("reintento devuelve la solicitud existente sin insertar otra", async () => {
  let inserts = 0;
  await withServer({
    findByCrmSolicitudId: async () => ({ id: "sol-existing", codigo_solicitud: "SOL-00001" }),
    insertIfAbsent: async () => { inserts++; return null; },
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-crm-api-key": "test-only-secret" },
      body: JSON.stringify(fixture),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).duplicada, true);
    assert.equal(inserts, 0);
  });
});

test("rechaza un vehículo sin mapeo aprobado", async () => {
  await withServer({
    mapTipoVehiculo: () => null,
    findByCrmSolicitudId: async () => null,
    insertIfAbsent: async () => { throw new Error("no debe insertar"); },
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-crm-api-key": "test-only-secret" },
      body: JSON.stringify(fixture),
    });
    assert.equal(response.status, 422);
  });
});
