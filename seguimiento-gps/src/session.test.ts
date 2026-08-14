/**
 * Unit tests for src/session.ts
 * Run: node --experimental-strip-types --test src/session.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guardarSesion, leerSesion, limpiarSesion, sesionVigente, leerSesionParaEnlace,
  type AlmacenSesion,
} from "./session.ts";
import type { SesionActiva } from "./types.ts";

function almacenFalso(): AlmacenSesion & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => { datos.set(k, v); },
    removeItem: (k) => { datos.delete(k); },
  };
}

const sesionEjemplo: SesionActiva = {
  enlaceToken: "enlace_abc",
  sesionToken: "tok_abc123",
  expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
  correo: "cliente@externo.com",
};

test("guardarSesion + leerSesion: round-trip exacto", () => {
  const almacen = almacenFalso();
  guardarSesion(sesionEjemplo, almacen);
  assert.deepEqual(leerSesion(almacen), sesionEjemplo);
});

test("leerSesion: sin nada guardado devuelve null", () => {
  assert.equal(leerSesion(almacenFalso()), null);
});

test("leerSesion: valor corrupto (no-JSON) devuelve null sin lanzar", () => {
  const almacen = almacenFalso();
  almacen.setItem("inlop-seguimiento-gps:sesion", "{esto no es json");
  assert.doesNotThrow(() => leerSesion(almacen));
  assert.equal(leerSesion(almacen), null);
});

test("leerSesion: JSON válido pero sin forma de sesión devuelve null", () => {
  const almacen = almacenFalso();
  almacen.setItem("inlop-seguimiento-gps:sesion", JSON.stringify({ foo: "bar" }));
  assert.equal(leerSesion(almacen), null);
});

test("limpiarSesion: borra lo guardado", () => {
  const almacen = almacenFalso();
  guardarSesion(sesionEjemplo, almacen);
  limpiarSesion(almacen);
  assert.equal(leerSesion(almacen), null);
});

test("sesionVigente: true antes de expirar, false después", () => {
  const referencia = new Date("2026-08-12T12:00:00-05:00");
  const sesion: SesionActiva = { ...sesionEjemplo, expiraEn: "2026-08-12T13:00:00-05:00" };
  assert.equal(sesionVigente(sesion, referencia), true);
  assert.equal(sesionVigente(sesion, new Date("2026-08-12T13:00:01-05:00")), false);
});

test("sesionVigente: null → false", () => {
  assert.equal(sesionVigente(null), false);
});

test("sesionVigente: expiraEn no parseable → false, sin lanzar", () => {
  const sesion: SesionActiva = { ...sesionEjemplo, expiraEn: "no-es-una-fecha" };
  assert.doesNotThrow(() => sesionVigente(sesion));
  assert.equal(sesionVigente(sesion), false);
});

// ── leerSesionParaEnlace ──────────────────────────────────────────────────────

test("leerSesionParaEnlace: devuelve la sesión si coincide el enlaceToken y está vigente", () => {
  const almacen = almacenFalso();
  guardarSesion(sesionEjemplo, almacen);
  assert.deepEqual(leerSesionParaEnlace("enlace_abc", almacen), sesionEjemplo);
});

test("leerSesionParaEnlace: null si la sesión guardada es de OTRO enlace (mismo origen, distinto reporte)", () => {
  const almacen = almacenFalso();
  guardarSesion(sesionEjemplo, almacen);
  assert.equal(leerSesionParaEnlace("enlace_totalmente_distinto", almacen), null);
});

test("leerSesionParaEnlace: null si coincide el enlace pero ya expiró", () => {
  const almacen = almacenFalso();
  guardarSesion({ ...sesionEjemplo, expiraEn: new Date(Date.now() - 1000).toISOString() }, almacen);
  assert.equal(leerSesionParaEnlace("enlace_abc", almacen), null);
});
