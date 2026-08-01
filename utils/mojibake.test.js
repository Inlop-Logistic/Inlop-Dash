import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixMojibake } from './mojibake.js';

// ── Casos de mojibake reales de ControlT ──────────────────────────────────

test('corrige acento agudo (ó → ó)', () => {
  // "Petróleo crudo" llega como "PetrÃ³leo crudo" desde el SOAP
  assert.equal(fixMojibake('PetrÃ³leo crudo'), 'Petróleo crudo');
});

test('corrige eñe (ñ → ñ)', () => {
  assert.equal(fixMojibake('TransportaciÃ³n'), 'Transportación');
});

test('corrige múltiples acentos en la misma cadena', () => {
  assert.equal(
    fixMojibake('CargaciÃ³n y descargaciÃ³n en BogotÃ¡'),
    'Cargación y descargación en Bogotá'
  );
});

test('corrige ü y otros caracteres Latin-1 extendidos', () => {
  assert.equal(fixMojibake('MÃ¼nchen'), 'München');
});

// ── Sin mojibake — la cadena no debe modificarse ──────────────────────────

test('no modifica cadenas ASCII puras', () => {
  const input = 'Carga general seca';
  assert.equal(fixMojibake(input), input);
});

test('no modifica string vacío', () => {
  assert.equal(fixMojibake(''), '');
});

test('no modifica strings ya correctamente codificados en JS (Unicode)', () => {
  // Si el string ya llegó bien (Unicode code-point correcto), no debe cambiar.
  const input = 'Petróleo crudo';
  assert.equal(fixMojibake(input), input);
});

// ── Valores no-string — deben regresar sin cambios ────────────────────────

test('retorna null sin modificar', () => {
  assert.equal(fixMojibake(null), null);
});

test('retorna undefined sin modificar', () => {
  assert.equal(fixMojibake(undefined), undefined);
});

test('retorna número sin modificar', () => {
  assert.equal(fixMojibake(42), 42);
});

test('retorna objeto sin modificar', () => {
  const obj = { a: 1 };
  assert.strictEqual(fixMojibake(obj), obj);
});

// ── Secuencia inválida — no debe lanzar excepción ────────────────────────

test('retorna original ante secuencia de bytes inválida en UTF-8', () => {
  // 0xFF solitario no es UTF-8 válido; la función debe devolver la cadena tal cual.
  const broken = '\xFF';
  assert.equal(fixMojibake(broken), broken);
});

test('retorna original ante secuencia de inicio sin continuación', () => {
  // Byte de inicio de secuencia 3-bytes (0xE0) sin continuación
  const broken = String.fromCharCode(0xE0) + 'A';
  assert.equal(fixMojibake(broken), broken);
});
