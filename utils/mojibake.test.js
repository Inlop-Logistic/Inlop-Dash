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

// ── Recuperación parcial por tramos (certificación Fase 6, Objetivo 4) ────
//
// Evidencia real (auditoría Fase 6, doc_ref1 de IN018153): ControlT entrega
// "... 3214640439 Â? 3014847549 ..." — el "Â?" es un byte ya irrecuperable
// en el propio sistema de ControlT (un carácter reemplazado por "?" antes
// de llegar a nosotros), pero el resto del texto sí es mojibake corregible.
// Antes, un solo byte roto en cualquier parte de la cadena descartaba TODA
// la corrección (el decode de la cadena completa fallaba y se retornaba sin
// tocar). Ahora la recuperación es por tramos: lo corregible se corrige, lo
// irrecuperable se conserva tal cual — sin inventar ni reemplazar contenido.

test('corrige el resto de la cadena aunque contenga un byte irrecuperable en medio (evidencia real IN018153)', () => {
  const input = 'TransportaciÃ³n Â? mercancÃ­a';
  const result = fixMojibake(input);

  assert.ok(result.includes('Transportación'), 'el tramo antes del byte roto debe corregirse');
  assert.ok(result.includes('mercancía'), 'el tramo después del byte roto debe corregirse');
  assert.ok(result.includes('Â?'), 'el byte irrecuperable se conserva tal cual — no se inventa contenido');
});

test('conserva "Â?" sin cambios cuando aparece aislado (dato ya perdido en ControlT, no inventamos reemplazo)', () => {
  const input = 'COMUNICARSE A LOS NUMEROS 3214640439 Â? 3014847549';
  assert.equal(fixMojibake(input), input);
});

test('corrige múltiples tramos mojibake independientes en la misma cadena', () => {
  const input = 'CargaciÃ³n normal, sin bytes rotos, con Ã±apa al final';
  assert.equal(fixMojibake(input), 'Cargación normal, sin bytes rotos, con ñapa al final');
});
