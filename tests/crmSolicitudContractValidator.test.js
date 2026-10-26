import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCrmSolicitud } from "../services/crmSolicitudContractValidator.js";

const fixture = JSON.parse(await readFile(
  new URL("./fixtures/crm-solicitud-prueba.json", import.meta.url), "utf8"
));

test("acepta el JSON ficticio de CRM", () => {
  assert.deepEqual(validateCrmSolicitud(fixture), { ok: true, errors: [] });
});

test("rechaza canal distinto de CRM", () => {
  const result = validateCrmSolicitud({ ...fixture, canal: "APP" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("'canal'")));
});

test("rechaza solicitud sin identificador de origen", () => {
  const result = validateCrmSolicitud({ ...fixture, crm_solicitud_id: "" });
  assert.equal(result.ok, false);
});

test("rechaza referencia externa que no corresponde a la solicitud", () => {
  const result = validateCrmSolicitud({ ...fixture, external_ref: "CRM:otra-solicitud" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("external_ref")));
});

test("rechaza fechas no válidas", () => {
  const result = validateCrmSolicitud({ ...fixture, fecha_requerida: "no-es-fecha" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("fecha_requerida")));
});

test("rechaza cuerpo que no sea objeto", () => {
  assert.equal(validateCrmSolicitud(null).ok, false);
});
