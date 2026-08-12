/**
 * Unit tests for src/fecha.ts — Hotfix de despliegue.
 *
 * Blindan el comportamiento EXACTO que tenía este módulo cuando reexportaba
 * desde erp/src/utils/parseFecha.ts (mismos formatos TMS, mismo offset fijo
 * −05:00, mismos umbrales de freshness GPS) — demuestran que la copia local
 * es equivalente, no una reimplementación con reglas nuevas.
 *
 * Run: node --experimental-strip-types --test src/fecha.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFechaTMS, gpsRelativo } from "./fecha.ts";

// ── parseFechaTMS — MDY (MM/DD/YYYY HH:MM:SS [AM|PM]) ───────────────────────

test("parseFechaTMS MDY: fecha/hora básica, offset fijo -05:00", () => {
  const d = parseFechaTMS("08/12/2026 09:30:15", "MDY");
  assert.ok(d);
  assert.equal(d.toISOString(), "2026-08-12T14:30:15.000Z"); // 09:30:15 -05:00 → 14:30:15Z
});

test("parseFechaTMS MDY: tolera mes/día de un solo dígito", () => {
  const d = parseFechaTMS("8/2/2026 9:05:00", "MDY");
  assert.ok(d);
  assert.equal(d.toISOString(), "2026-08-02T14:05:00.000Z");
});

test("parseFechaTMS MDY: AM/PM — 12:00 AM es medianoche (hour=0)", () => {
  const d = parseFechaTMS("08/12/2026 12:00:00 AM", "MDY");
  assert.equal(d?.toISOString(), "2026-08-12T05:00:00.000Z"); // 00:00 -05:00
});

test("parseFechaTMS MDY: AM/PM — 12:00 PM es mediodía (hour=12, no 24)", () => {
  const d = parseFechaTMS("08/12/2026 12:00:00 PM", "MDY");
  assert.equal(d?.toISOString(), "2026-08-12T17:00:00.000Z"); // 12:00 -05:00
});

test("parseFechaTMS MDY: AM/PM — 01:30:45 PM suma 12 horas", () => {
  const d = parseFechaTMS("08/12/2026 01:30:45 PM", "MDY");
  assert.equal(d?.toISOString(), "2026-08-12T18:30:45.000Z"); // 13:30:45 -05:00
});

test("parseFechaTMS MDY: AM/PM case-insensitive (am/pm en minúsculas)", () => {
  const d = parseFechaTMS("08/12/2026 09:00:00 am", "MDY");
  assert.equal(d?.toISOString(), "2026-08-12T14:00:00.000Z");
});

test("parseFechaTMS MDY: sin AM/PM se interpreta en formato 24h", () => {
  const d = parseFechaTMS("08/12/2026 23:15:00", "MDY");
  assert.equal(d?.toISOString(), "2026-08-13T04:15:00.000Z");
});

// ── parseFechaTMS — DMY (DD/MM/YYYY HH:MM[:SS]) ─────────────────────────────

test("parseFechaTMS DMY: fecha/hora básica, offset fijo -05:00", () => {
  const d = parseFechaTMS("12/08/2026 09:30:15", "DMY");
  assert.ok(d);
  assert.equal(d.toISOString(), "2026-08-12T14:30:15.000Z");
});

test("parseFechaTMS DMY: segundos opcionales — default 00", () => {
  const d = parseFechaTMS("12/08/2026 09:30", "DMY");
  assert.equal(d?.toISOString(), "2026-08-12T14:30:00.000Z");
});

test("parseFechaTMS DMY: día/mes de un solo dígito", () => {
  const d = parseFechaTMS("2/8/2026 09:00", "DMY");
  assert.equal(d?.toISOString(), "2026-08-02T14:00:00.000Z");
});

// ── parseFechaTMS — casos nulos / inválidos (idénticos en MDY y DMY) ────────

test("parseFechaTMS: null/undefined/vacío → null", () => {
  assert.equal(parseFechaTMS(null, "MDY"), null);
  assert.equal(parseFechaTMS(undefined, "MDY"), null);
  assert.equal(parseFechaTMS("", "MDY"), null);
  assert.equal(parseFechaTMS(null, "DMY"), null);
});

test("parseFechaTMS: string no reconocible → null (nunca lanza)", () => {
  assert.equal(parseFechaTMS("no es una fecha", "MDY"), null);
  assert.equal(parseFechaTMS("2026-08-12T09:00:00Z", "MDY"), null); // ISO no es el formato TMS
  assert.equal(parseFechaTMS("12/08/2026", "DMY"), null); // sin hora
});

test("parseFechaTMS: espacios al inicio/fin se recortan", () => {
  const d = parseFechaTMS("  08/12/2026 09:00:00  ", "MDY");
  assert.equal(d?.toISOString(), "2026-08-12T14:00:00.000Z");
});

// ── gpsRelativo — casos sin señal ────────────────────────────────────────────

test("gpsRelativo: null/undefined → 'Sin señal', stale, gris", () => {
  for (const v of [null, undefined, "", "basura"]) {
    const r = gpsRelativo(v);
    assert.equal(r.label, "Sin señal");
    assert.equal(r.level, "stale");
    assert.equal(r.color, "var(--gray-400)");
  }
});

// ── gpsRelativo — umbrales de antigüedad (formato MDY, hora Bogotá) ─────────

/** Formatea `d` como MM/DD/YYYY HH:mm:ss en hora Bogotá — mismo formato que produce el TMS real. */
function comoMdyBogota(d: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => partes.find(p => p.type === t)!.value;
  return `${get("month")}/${get("day")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

test("gpsRelativo: hace unos segundos → 'hace 0 min', ok, verde", () => {
  const r = gpsRelativo(comoMdyBogota(new Date()));
  assert.equal(r.label, "hace 0 min");
  assert.equal(r.level, "ok");
  assert.equal(r.color, "#059669");
});

test("gpsRelativo: hace 90 minutos (<2h) → minutos exactos, ok, verde", () => {
  const hace90 = new Date(Date.now() - 90 * 60_000);
  const r = gpsRelativo(comoMdyBogota(hace90));
  assert.equal(r.label, "hace 90 min");
  assert.equal(r.level, "ok");
});

test("gpsRelativo: hace 3 horas (2h–6h) → horas con un decimal, warn, ámbar", () => {
  const hace3h = new Date(Date.now() - 3 * 3_600_000);
  const r = gpsRelativo(comoMdyBogota(hace3h));
  assert.match(r.label, /^hace 3\.0 h$/);
  assert.equal(r.level, "warn");
  assert.equal(r.color, "#D97706");
});

test("gpsRelativo: hace 8 horas (>6h) → horas enteras truncadas, stale, rojo", () => {
  const hace8h = new Date(Date.now() - 8 * 3_600_000);
  const r = gpsRelativo(comoMdyBogota(hace8h));
  assert.equal(r.label, "hace 8 h");
  assert.equal(r.level, "stale");
  assert.equal(r.color, "#DC2626");
});

test("gpsRelativo: exactamente en el límite de 2h todavía cuenta como warn (< estricto)", () => {
  const hace2h = new Date(Date.now() - 2 * 3_600_000 - 1000); // 1s después del límite
  const r = gpsRelativo(comoMdyBogota(hace2h));
  assert.equal(r.level, "warn");
});
