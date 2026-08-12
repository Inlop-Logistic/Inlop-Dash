/**
 * Unit tests for src/hojaInferior.ts
 * Run: node --experimental-strip-types --test src/hojaInferior.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alturaPxDe, siguienteEstado, estadoMasCercano, alMenosA, alturaCssDe, clampArrastrePx,
  ORDEN_ALTURAS,
} from "./hojaInferior.ts";

const VH = 900; // viewport de referencia para los cálculos de vh

// ── alturaPxDe ────────────────────────────────────────────────────────────

test("alturaPxDe: 'peek' es un px fijo, no depende del viewport", () => {
  assert.equal(alturaPxDe("peek", 600), alturaPxDe("peek", 1200));
});

test("alturaPxDe: 'medio' y 'lleno' escalan con el viewport (vh)", () => {
  assert.equal(alturaPxDe("medio", VH), VH * 0.58);
  assert.equal(alturaPxDe("lleno", VH), VH * 0.88);
  assert.equal(alturaPxDe("medio", VH) * 2, alturaPxDe("medio", VH * 2));
});

test("alturaPxDe: orden ascendente peek < medio < lleno para cualquier viewport razonable", () => {
  for (const vh of [500, 667, 844, 932, 1080]) {
    assert.ok(alturaPxDe("peek", vh) < alturaPxDe("medio", vh));
    assert.ok(alturaPxDe("medio", vh) < alturaPxDe("lleno", vh));
  }
});

// ── siguienteEstado — ciclo del tap ─────────────────────────────────────────
// Blinda exactamente el bug de Fase 10F: un solo tap debía avanzar UN paso,
// no dos (el handle tenía onClick Y onPointerUp cicladno a la vez).

test("siguienteEstado: cicla peek → medio → lleno → peek, un paso por llamada", () => {
  assert.equal(siguienteEstado("peek"), "medio");
  assert.equal(siguienteEstado("medio"), "lleno");
  assert.equal(siguienteEstado("lleno"), "peek");
});

test("siguienteEstado: aplicado 3 veces vuelve al estado original (ciclo cerrado)", () => {
  for (const inicio of ORDEN_ALTURAS) {
    const final = siguienteEstado(siguienteEstado(siguienteEstado(inicio)));
    assert.equal(final, inicio);
  }
});

// ── estadoMasCercano — encaje al soltar un arrastre ─────────────────────────

test("estadoMasCercano: un px exactamente sobre un estado encaja en ese estado", () => {
  assert.equal(estadoMasCercano(alturaPxDe("peek", VH), VH), "peek");
  assert.equal(estadoMasCercano(alturaPxDe("medio", VH), VH), "medio");
  assert.equal(estadoMasCercano(alturaPxDe("lleno", VH), VH), "lleno");
});

test("estadoMasCercano: a mitad de camino entre dos estados, encaja en el más próximo", () => {
  const medioPx = alturaPxDe("medio", VH);
  const llenoPx = alturaPxDe("lleno", VH);
  assert.equal(estadoMasCercano(medioPx + 5, VH), "medio");
  assert.equal(estadoMasCercano(llenoPx - 5, VH), "lleno");
});

test("estadoMasCercano: por debajo de 'peek' o por encima de 'lleno' sigue encajando en el extremo más cercano", () => {
  assert.equal(estadoMasCercano(0, VH), "peek");
  assert.equal(estadoMasCercano(VH * 2, VH), "lleno");
});

// ── alMenosA — expandir sin nunca contraer ──────────────────────────────────

test("alMenosA: sube si el actual está por debajo del mínimo pedido", () => {
  assert.equal(alMenosA("peek", "medio"), "medio");
  assert.equal(alMenosA("peek", "lleno"), "lleno");
  assert.equal(alMenosA("medio", "lleno"), "lleno");
});

test("alMenosA: nunca baja un estado ya igual o más alto que el mínimo pedido", () => {
  assert.equal(alMenosA("lleno", "medio"), "lleno");
  assert.equal(alMenosA("lleno", "peek"), "lleno");
  assert.equal(alMenosA("medio", "medio"), "medio");
});

// ── alturaCssDe ──────────────────────────────────────────────────────────────

test("alturaCssDe: durante un arrastre en vivo, sigue exactamente el px dado (ignora el estado)", () => {
  assert.equal(alturaCssDe("peek", 500), "500px");
  assert.equal(alturaCssDe("lleno", 200), "200px");
});

test("alturaCssDe: en reposo, 'peek' es px fijo y 'medio'/'lleno' son vh", () => {
  assert.match(alturaCssDe("peek", null), /^\d+px$/);
  assert.match(alturaCssDe("medio", null), /^58vh$/);
  assert.match(alturaCssDe("lleno", null), /^88vh$/);
});

// ── clampArrastrePx ──────────────────────────────────────────────────────────

test("clampArrastrePx: nunca baja del alto de 'peek'", () => {
  assert.equal(clampArrastrePx(-500, VH), alturaPxDe("peek", VH));
});

test("clampArrastrePx: nunca sube del techo de 94vh", () => {
  assert.equal(clampArrastrePx(VH * 10, VH), VH * 0.94);
});

test("clampArrastrePx: un valor intermedio pasa sin cambios", () => {
  const valor = VH * 0.7;
  assert.equal(clampArrastrePx(valor, VH), valor);
});
