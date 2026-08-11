/**
 * Unit tests for recurrencia.js
 * Run: node --test services/reportes/recurrencia.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProximaEjecucion, esFechaValida } from './recurrencia.js';

/** Helper: instante Colombia (UTC-5) como string comparable en los asserts. */
function iso(fecha, hora) {
  const [hh, mm] = hora.split(':');
  return new Date(`${fecha}T${hh}:${mm}:00-05:00`).toISOString();
}

// ── Diaria ────────────────────────────────────────────────────────────────────

test('diaria: primera ejecución cae en fecha_inicio a la hora configurada', () => {
  const rec = { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11', fin: { modo: 'nunca' } };
  const out = calcularProximaEjecucion(rec, null);
  assert.equal(out.toISOString(), iso('2026-08-11', '08:00'));
});

test('diaria: tras ejecutar, la siguiente es el día siguiente a la misma hora', () => {
  const rec = { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11', fin: { modo: 'nunca' } };
  const primera = calcularProximaEjecucion(rec, null);
  const siguiente = calcularProximaEjecucion(rec, primera);
  assert.equal(siguiente.toISOString(), iso('2026-08-12', '08:00'));
});

test('diaria: esFechaValida es verdadera para cualquier día >= fecha_inicio', () => {
  const rec = { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11', fin: { modo: 'nunca' } };
  assert.equal(esFechaValida('2026-08-11', rec), true);
  assert.equal(esFechaValida('2026-09-01', rec), true);
  assert.equal(esFechaValida('2026-08-10', rec), false); // antes de fecha_inicio
});

// ── Semanal ───────────────────────────────────────────────────────────────────

test('semanal: solo cae en los días de dias_semana configurados', () => {
  // 2026-08-11 es martes (2). dias_semana = [1,3,5] = lun/mié/vie.
  const rec = {
    tipo: 'semanal', horas: ['09:00'], fecha_inicio: '2026-08-11',
    dias_semana: [1, 3, 5], fin: { modo: 'nunca' },
  };
  const out = calcularProximaEjecucion(rec, null);
  // El primer miércoles >= 2026-08-11 (martes) es 2026-08-12.
  assert.equal(out.toISOString(), iso('2026-08-12', '09:00'));
});

test('semanal: tras el viernes, la siguiente es el lunes de la semana siguiente', () => {
  const rec = {
    tipo: 'semanal', horas: ['09:00'], fecha_inicio: '2026-08-11',
    dias_semana: [1, 3, 5], fin: { modo: 'nunca' },
  };
  const viernes = new Date(iso('2026-08-14', '09:00')); // viernes 14 ago 2026
  const out = calcularProximaEjecucion(rec, viernes);
  assert.equal(out.toISOString(), iso('2026-08-17', '09:00')); // lunes siguiente
});

test('semanal: sin dias_semana configurados nunca encuentra un día válido', () => {
  const rec = { tipo: 'semanal', horas: ['09:00'], fecha_inicio: '2026-08-11', dias_semana: [], fin: { modo: 'nunca' } };
  assert.equal(calcularProximaEjecucion(rec, null), null);
});

// ── Mensual ───────────────────────────────────────────────────────────────────

test('mensual: cae en dia_mes del primer mes válido', () => {
  const rec = { tipo: 'mensual', horas: ['07:00'], fecha_inicio: '2026-08-01', dia_mes: 15, fin: { modo: 'nunca' } };
  const out = calcularProximaEjecucion(rec, null);
  assert.equal(out.toISOString(), iso('2026-08-15', '07:00'));
});

test('mensual: si fecha_inicio ya pasó el dia_mes de ese mes, salta al mes siguiente', () => {
  const rec = { tipo: 'mensual', horas: ['07:00'], fecha_inicio: '2026-08-20', dia_mes: 15, fin: { modo: 'nunca' } };
  const out = calcularProximaEjecucion(rec, null);
  assert.equal(out.toISOString(), iso('2026-09-15', '07:00'));
});

test('mensual: dia_mes=31 se ajusta al último día en meses más cortos (febrero)', () => {
  const rec = { tipo: 'mensual', horas: ['07:00'], fecha_inicio: '2027-01-31', dia_mes: 31, fin: { modo: 'nunca' } };
  const primera = calcularProximaEjecucion(rec, null);
  assert.equal(primera.toISOString(), iso('2027-01-31', '07:00'));
  const siguiente = calcularProximaEjecucion(rec, primera);
  // 2027 no es bisiesto — febrero tiene 28 días.
  assert.equal(siguiente.toISOString(), iso('2027-02-28', '07:00'));
});

// ── Múltiples horas ───────────────────────────────────────────────────────────

test('múltiples horas: cada una es una ejecución independiente el mismo día', () => {
  const rec = { tipo: 'diaria', horas: ['14:00', '08:00'], fecha_inicio: '2026-08-11', fin: { modo: 'nunca' } }; // sin ordenar
  const primera = calcularProximaEjecucion(rec, null);
  assert.equal(primera.toISOString(), iso('2026-08-11', '08:00')); // la más temprana, aunque venga después en el array

  const segunda = calcularProximaEjecucion(rec, primera);
  assert.equal(segunda.toISOString(), iso('2026-08-11', '14:00')); // misma fecha, segunda hora

  const tercera = calcularProximaEjecucion(rec, segunda);
  assert.equal(tercera.toISOString(), iso('2026-08-12', '08:00')); // día siguiente, primera hora otra vez
});

// ── Fecha de inicio ───────────────────────────────────────────────────────────

test('fecha_inicio: una referencia anterior no adelanta la primera ejecución', () => {
  const rec = { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11', fin: { modo: 'nunca' } };
  const referenciaAntes = new Date(iso('2026-08-01', '00:00'));
  const out = calcularProximaEjecucion(rec, referenciaAntes);
  assert.equal(out.toISOString(), iso('2026-08-11', '08:00'));
});

test('fecha_inicio: una referencia posterior avanza correctamente sin retroceder', () => {
  const rec = { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11', fin: { modo: 'nunca' } };
  const referenciaDespues = new Date(iso('2026-08-20', '10:00')); // ya pasó la hora de ese día
  const out = calcularProximaEjecucion(rec, referenciaDespues);
  assert.equal(out.toISOString(), iso('2026-08-21', '08:00'));
});

// ── Fecha de finalización ────────────────────────────────────────────────────

test('fin.fecha: el propio día límite es válido (inclusive)', () => {
  const rec = {
    tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11',
    fin: { modo: 'fecha', fecha: '2026-08-13' },
  };
  const d11 = calcularProximaEjecucion(rec, null);
  const d12 = calcularProximaEjecucion(rec, d11);
  const d13 = calcularProximaEjecucion(rec, d12);
  assert.equal(d13.toISOString(), iso('2026-08-13', '08:00'));
});

test('fin.fecha: no hay ejecución después del día límite', () => {
  const rec = {
    tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11',
    fin: { modo: 'fecha', fecha: '2026-08-13' },
  };
  const d13 = new Date(iso('2026-08-13', '08:00'));
  const out = calcularProximaEjecucion(rec, d13);
  assert.equal(out, null);
});

// ── Sin fin ───────────────────────────────────────────────────────────────────

test('fin: "nunca" sigue generando ejecuciones indefinidamente', () => {
  const rec = { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11', fin: { modo: 'nunca' } };
  const lejos = new Date(iso('2030-01-01', '08:00'));
  const out = calcularProximaEjecucion(rec, lejos);
  assert.equal(out.toISOString(), iso('2030-01-02', '08:00'));
});

// ── Fin por repeticiones (sin contador persistido — cálculo determinista) ──

test('fin.repeticiones: se detiene exactamente tras la cantidad configurada', () => {
  const rec = {
    tipo: 'diaria', horas: ['08:00', '14:00'], fecha_inicio: '2026-08-11',
    fin: { modo: 'repeticiones', cantidad: 3 },
  };
  const s1 = calcularProximaEjecucion(rec, null);
  assert.equal(s1.toISOString(), iso('2026-08-11', '08:00')); // ordinal 1

  const s2 = calcularProximaEjecucion(rec, s1);
  assert.equal(s2.toISOString(), iso('2026-08-11', '14:00')); // ordinal 2

  const s3 = calcularProximaEjecucion(rec, s2);
  assert.equal(s3.toISOString(), iso('2026-08-12', '08:00')); // ordinal 3

  const s4 = calcularProximaEjecucion(rec, s3);
  assert.equal(s4, null); // ordinal 4 excede cantidad=3
});

test('fin.repeticiones=1: una sola ejecución posible', () => {
  const rec = { tipo: 'diaria', horas: ['08:00'], fecha_inicio: '2026-08-11', fin: { modo: 'repeticiones', cantidad: 1 } };
  const s1 = calcularProximaEjecucion(rec, null);
  assert.ok(s1);
  const s2 = calcularProximaEjecucion(rec, s1);
  assert.equal(s2, null);
});

// ── Recurrencia mal formada ───────────────────────────────────────────────────

test('recurrencia incompleta (sin horas, sin fecha_inicio, sin tipo) devuelve null sin lanzar', () => {
  assert.equal(calcularProximaEjecucion({ tipo: 'diaria', horas: [], fecha_inicio: '2026-08-11', fin: { modo: 'nunca' } }, null), null);
  assert.equal(calcularProximaEjecucion({ tipo: 'diaria', horas: ['08:00'], fecha_inicio: '', fin: { modo: 'nunca' } }, null), null);
  assert.equal(calcularProximaEjecucion(null, null), null);
  assert.equal(calcularProximaEjecucion({}, null), null);
});
