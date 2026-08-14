/**
 * Unit tests for src/vehiculos.ts
 * Run: node --experimental-strip-types --test src/vehiculos.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tieneGpsActivo, coincidePlaca, filtrarPorPlaca, ordenarVehiculos } from "./vehiculos.ts";
import type { VehiculoPublico } from "./types.ts";

function v(overrides: Partial<VehiculoPublico> = {}): VehiculoPublico {
  return {
    placa: "ABC123", conductor: "Juan", estado: "activo", estadoViaje: "En tránsito",
    lat: 4.6, lon: -74.1, ultimaActualizacion: "08/12/2026 09:00:00",
    ubicacion: "Bogotá", origen: "Bogotá", destino: "Cali", alarma: null, manifiesto: "T1",
    ...overrides,
  };
}

// ── tieneGpsActivo ────────────────────────────────────────────────────────────

test("tieneGpsActivo: true con lat/lon numéricos", () => {
  assert.equal(tieneGpsActivo(v({ lat: 4.6, lon: -74.1 })), true);
});

test("tieneGpsActivo: false si lat o lon son null", () => {
  assert.equal(tieneGpsActivo(v({ lat: null, lon: -74.1 })), false);
  assert.equal(tieneGpsActivo(v({ lat: 4.6, lon: null })), false);
  assert.equal(tieneGpsActivo(v({ lat: null, lon: null })), false);
});

test("tieneGpsActivo: false ante NaN/Infinity (defensivo)", () => {
  assert.equal(tieneGpsActivo(v({ lat: NaN, lon: -74.1 })), false);
  assert.equal(tieneGpsActivo(v({ lat: Infinity, lon: -74.1 })), false);
});

// ── coincidePlaca / filtrarPorPlaca ──────────────────────────────────────────

test("coincidePlaca: substring insensible a mayúsculas", () => {
  assert.equal(coincidePlaca(v({ placa: "ABC123" }), "abc"), true);
  assert.equal(coincidePlaca(v({ placa: "ABC123" }), "XYZ"), false);
});

test("coincidePlaca: término vacío siempre coincide", () => {
  assert.equal(coincidePlaca(v({ placa: "ABC123" }), ""), true);
  assert.equal(coincidePlaca(v({ placa: "ABC123" }), "   "), true);
});

test("coincidePlaca: placa null no coincide con término no vacío, sin lanzar", () => {
  assert.equal(coincidePlaca(v({ placa: null }), "abc"), false);
});

test("filtrarPorPlaca: filtra el array completo", () => {
  const vehiculos = [v({ placa: "ABC123" }), v({ placa: "XYZ789" }), v({ placa: "ABX000" })];
  assert.deepEqual(filtrarPorPlaca(vehiculos, "AB").map(x => x.placa), ["ABC123", "ABX000"]);
});

// ── ordenarVehiculos ──────────────────────────────────────────────────────────

test("ordenarVehiculos: vehículos con GPS activo siempre antes que los que no tienen", () => {
  const vehiculos = [
    v({ placa: "SIN-GPS", lat: null, lon: null }),
    v({ placa: "CON-GPS", lat: 4.6, lon: -74.1 }),
  ];
  const out = ordenarVehiculos(vehiculos);
  assert.deepEqual(out.map(x => x.placa), ["CON-GPS", "SIN-GPS"]);
});

test("ordenarVehiculos: dentro de los que tienen GPS, pánico/alarma antes que activo/detenido", () => {
  const vehiculos = [
    v({ placa: "NORMAL", estado: "activo" }),
    v({ placa: "PANICO", estado: "panico" }),
    v({ placa: "DETENIDO", estado: "detenido" }),
    v({ placa: "ALARMA", estado: "con_alarma" }),
  ];
  const out = ordenarVehiculos(vehiculos).map(x => x.placa);
  assert.deepEqual(out, ["PANICO", "ALARMA", "NORMAL", "DETENIDO"]);
});

test("ordenarVehiculos: dentro del mismo estado, ordena alfabéticamente por placa", () => {
  const vehiculos = [v({ placa: "ZZZ" }), v({ placa: "AAA" }), v({ placa: "MMM" })];
  assert.deepEqual(ordenarVehiculos(vehiculos).map(x => x.placa), ["AAA", "MMM", "ZZZ"]);
});

test("ordenarVehiculos: no muta el array original", () => {
  const vehiculos = [v({ placa: "ZZZ" }), v({ placa: "AAA" })];
  const copia = [...vehiculos];
  ordenarVehiculos(vehiculos);
  assert.deepEqual(vehiculos, copia);
});
