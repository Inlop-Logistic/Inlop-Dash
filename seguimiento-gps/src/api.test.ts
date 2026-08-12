/**
 * Unit tests for src/api.ts
 * Run: node --experimental-strip-types --test src/api.test.ts
 *
 * Reemplaza globalThis.fetch temporalmente — no hay servidor real en estas
 * pruebas, solo se verifica que este cliente interpreta correctamente las
 * formas de respuesta ya definidas por 10B (éxito, error HTTP, falla de red).
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ApiError, validarEnlace, iniciarAcceso, solicitarOtp, obtenerVehiculos } from "./api.ts";

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

function mockFetch(status: number, cuerpo: unknown) {
  globalThis.fetch = (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  })) as unknown as typeof fetch;
}

test("validarEnlace: respuesta 200 se devuelve tal cual", async () => {
  mockFetch(200, { ok: true, vehiculos: 3 });
  const out = await validarEnlace("tok");
  assert.deepEqual(out, { ok: true, vehiculos: 3 });
});

test("validarEnlace: 404 lanza ApiError con el mensaje del backend", async () => {
  mockFetch(404, { error: "Enlace no válido o expirado" });
  await assert.rejects(
    () => validarEnlace("tok-invalido"),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 404);
      assert.equal(err.message, "Enlace no válido o expirado");
      return true;
    },
  );
});

test("iniciarAcceso: modo interno se devuelve tal cual (Fase 11B)", async () => {
  mockFetch(200, { ok: true, modo: "interno", sesion: "tok-sesion", expiraEn: "2026-08-13T00:00:00.000Z" });
  const out = await iniciarAcceso("tok", "interno@inlop.com.co");
  assert.deepEqual(out, { ok: true, modo: "interno", sesion: "tok-sesion", expiraEn: "2026-08-13T00:00:00.000Z" });
});

test("iniciarAcceso: modo externo se devuelve tal cual (mismo mensaje anti-enumeración que solicitarOtp)", async () => {
  mockFetch(200, { ok: true, modo: "externo", mensaje: "Si el correo está autorizado, recibirás un código de verificación." });
  const out = await iniciarAcceso("tok", "externo@x.com");
  assert.equal(out.modo, "externo");
});

test("solicitarOtp: 429 (rate limit) lanza ApiError con status 429", async () => {
  mockFetch(429, { error: "Demasiados intentos. Vuelve a intentarlo más tarde." });
  await assert.rejects(
    () => solicitarOtp("tok", "a@x.com"),
    (err: unknown) => { assert.ok(err instanceof ApiError); assert.equal((err as ApiError).status, 429); return true; },
  );
});

test("obtenerVehiculos: 401 (sesión inválida) lanza ApiError con status 401", async () => {
  mockFetch(401, { error: "Sesión inválida o expirada" });
  await assert.rejects(
    () => obtenerVehiculos("sesion-vencida"),
    (err: unknown) => { assert.ok(err instanceof ApiError); assert.equal((err as ApiError).status, 401); return true; },
  );
});

test("fallo de red real (fetch rechaza) se traduce a ApiError con status 0", async () => {
  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
  await assert.rejects(
    () => validarEnlace("tok"),
    (err: unknown) => { assert.ok(err instanceof ApiError); assert.equal((err as ApiError).status, 0); return true; },
  );
});

test("respuesta sin JSON parseable no revienta el cliente — cae a mensaje genérico", async () => {
  globalThis.fetch = (async () => ({
    ok: false, status: 500,
    json: async () => { throw new Error("no es JSON"); },
  })) as unknown as typeof fetch;
  await assert.rejects(
    () => validarEnlace("tok"),
    (err: unknown) => { assert.ok(err instanceof ApiError); assert.equal((err as ApiError).status, 500); return true; },
  );
});
