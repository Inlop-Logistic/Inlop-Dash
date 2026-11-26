/**
 * Unit tests for normalizar.js (Enturne de Vehículos)
 * Run: node --test services/enturnes/normalizar.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarPlaca, validarSolicitudEnturne, TIPOS_VEHICULO, TIPOS_CARROCERIA } from './normalizar.js';

// ── normalizarPlaca ─────────────────────────────────────────────────────────

test('normalizarPlaca: mayúsculas y sin espacios', () => {
  assert.equal(normalizarPlaca('abc 123'), 'ABC123');
});

test('normalizarPlaca: colapsa guiones y puntuación', () => {
  assert.equal(normalizarPlaca('ABC-123'), 'ABC123');
  assert.equal(normalizarPlaca('abc.123'), 'ABC123');
});

test('normalizarPlaca: variantes equivalentes producen la misma clave', () => {
  const variantes = ['abc 123', 'ABC-123', ' ABC123 ', 'AbC123'];
  const normalizadas = new Set(variantes.map(normalizarPlaca));
  assert.equal(normalizadas.size, 1);
  assert.equal([...normalizadas][0], 'ABC123');
});

test('normalizarPlaca: entrada vacía o no-string → cadena vacía', () => {
  assert.equal(normalizarPlaca(''), '');
  assert.equal(normalizarPlaca(null), '');
  assert.equal(normalizarPlaca(undefined), '');
  assert.equal(normalizarPlaca(123), '');
});

// ── validarSolicitudEnturne ──────────────────────────────────────────────────

function solicitudValida(overrides = {}) {
  return {
    nombre: 'Juan Pérez',
    telefono: '300 123 4567',
    placa: 'abc 123',
    ciudad: 'Cartagena',
    tipo_vehiculo: 'Turbo',
    tipo_carroceria: 'Estaca',
    capacidad_toneladas: 5,
    ruta_frecuente: 'Cartagena-Barranquilla',
    ...overrides,
  };
}

test('validarSolicitudEnturne: solicitud completa y válida pasa', () => {
  const r = validarSolicitudEnturne(solicitudValida());
  assert.equal(r.ok, true);
  assert.deepEqual(r.errores, []);
  assert.equal(r.datos.placa_normalizada, 'ABC123');
  assert.equal(r.datos.volumen_m3, null);
  assert.equal(r.datos.telefono, '300 123 4567');
  assert.equal(r.datos.ciudad, 'Cartagena');
});

// ── telefono ─────────────────────────────────────────────────────────────────

test('validarSolicitudEnturne: telefono vacío falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ telefono: '' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('telefono')));
});

test('validarSolicitudEnturne: telefono con muy pocos dígitos falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ telefono: '123' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('telefono')));
});

test('validarSolicitudEnturne: telefono con separadores visuales se acepta tal cual (no se normaliza)', () => {
  const r = validarSolicitudEnturne(solicitudValida({ telefono: '+57 300 123 4567' }));
  assert.equal(r.ok, true);
  assert.equal(r.datos.telefono, '+57 300 123 4567');
});

test('validarSolicitudEnturne: telefono con demasiados dígitos falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ telefono: '1234567890123456' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('telefono')));
});

// ── ciudad ───────────────────────────────────────────────────────────────────

test('validarSolicitudEnturne: ciudad vacía falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ ciudad: '' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('ciudad')));
});

test('validarSolicitudEnturne: ciudad se guarda tal como la escribe el transportador, sin normalizar', () => {
  const r = validarSolicitudEnturne(solicitudValida({ ciudad: '  cartagena de Indias  ' }));
  assert.equal(r.ok, true);
  assert.equal(r.datos.ciudad, 'cartagena de Indias');
});

test('validarSolicitudEnturne: volumen_m3 opcional, se parsea si viene', () => {
  const r = validarSolicitudEnturne(solicitudValida({ volumen_m3: '12.5' }));
  assert.equal(r.ok, true);
  assert.equal(r.datos.volumen_m3, 12.5);
});

test('validarSolicitudEnturne: nombre vacío falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ nombre: '  ' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('nombre')));
});

test('validarSolicitudEnturne: placa vacía falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ placa: '' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('placa')));
});

test('validarSolicitudEnturne: tipo_vehiculo fuera de la lista falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ tipo_vehiculo: 'Camioneta' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('tipo_vehiculo')));
});

test('validarSolicitudEnturne: tipo_carroceria fuera de la lista falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ tipo_carroceria: 'Volco' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('tipo_carroceria')));
});

test('validarSolicitudEnturne: capacidad_toneladas <= 0 falla', () => {
  assert.equal(validarSolicitudEnturne(solicitudValida({ capacidad_toneladas: 0 })).ok, false);
  assert.equal(validarSolicitudEnturne(solicitudValida({ capacidad_toneladas: -3 })).ok, false);
  assert.equal(validarSolicitudEnturne(solicitudValida({ capacidad_toneladas: 'abc' })).ok, false);
});

test('validarSolicitudEnturne: volumen_m3 inválido falla solo si viene', () => {
  assert.equal(validarSolicitudEnturne(solicitudValida({ volumen_m3: -1 })).ok, false);
  assert.equal(validarSolicitudEnturne(solicitudValida({ volumen_m3: 'x' })).ok, false);
});

test('validarSolicitudEnturne: ruta_frecuente vacía falla', () => {
  const r = validarSolicitudEnturne(solicitudValida({ ruta_frecuente: '' }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('ruta_frecuente')));
});

test('validarSolicitudEnturne: body no-objeto no revienta, solo acumula errores', () => {
  const r = validarSolicitudEnturne(null);
  assert.equal(r.ok, false);
  assert.ok(r.errores.length > 0);
});

test('catálogos exportados coinciden con el brief', () => {
  assert.deepEqual(TIPOS_VEHICULO, ['NHR', 'Turbo', 'Sencillo', 'Dobletroque', 'Patineta', 'Tractomula']);
  assert.deepEqual(TIPOS_CARROCERIA, ['Estaca', 'Furgón', 'Plancha', 'Cisterna']);
});

// ── Límites de longitud (control de seguridad pendiente de la auditoría) ───
// No cambian campos, reglas comerciales ni datos existentes — solo acotan
// cuánto puede medir cada texto. Cada caso usa EXACTAMENTE el límite +1
// para aislar el límite de longitud de cualquier otra validación del mismo
// campo (ej. el rango de dígitos del teléfono).

test('validarSolicitudEnturne: nombre de hasta 120 caracteres pasa; 121 falla', () => {
  assert.equal(validarSolicitudEnturne(solicitudValida({ nombre: 'a'.repeat(120) })).ok, true);
  const r = validarSolicitudEnturne(solicitudValida({ nombre: 'a'.repeat(121) }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('nombre') && e.includes('120')));
});

test('validarSolicitudEnturne: telefono de hasta 20 caracteres pasa; 21 falla por longitud', () => {
  // 10 dígitos reales (dentro del rango 7–15) + relleno de guiones EN EL
  // MEDIO (nunca al borde, para que trim() no se los coma) — así se aísla
  // el límite de longitud del límite de cantidad de dígitos.
  const telefono20 = '30012' + '-'.repeat(10) + '34567'; // 20 caracteres, 10 dígitos
  const telefono21 = '30012' + '-'.repeat(11) + '34567'; // 21 caracteres, 10 dígitos
  assert.equal(telefono20.length, 20);
  assert.equal(telefono21.length, 21);
  assert.equal(validarSolicitudEnturne(solicitudValida({ telefono: telefono20 })).ok, true);
  const r = validarSolicitudEnturne(solicitudValida({ telefono: telefono21 }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('telefono') && e.includes('20')));
});

test('validarSolicitudEnturne: placa de hasta 20 caracteres pasa; 21 falla', () => {
  assert.equal(validarSolicitudEnturne(solicitudValida({ placa: 'A'.repeat(20) })).ok, true);
  const r = validarSolicitudEnturne(solicitudValida({ placa: 'A'.repeat(21) }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('placa') && e.includes('20')));
});

test('validarSolicitudEnturne: ciudad de hasta 100 caracteres pasa; 101 falla', () => {
  assert.equal(validarSolicitudEnturne(solicitudValida({ ciudad: 'a'.repeat(100) })).ok, true);
  const r = validarSolicitudEnturne(solicitudValida({ ciudad: 'a'.repeat(101) }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('ciudad') && e.includes('100')));
});

test('validarSolicitudEnturne: ruta_frecuente de hasta 160 caracteres pasa; 161 falla', () => {
  assert.equal(validarSolicitudEnturne(solicitudValida({ ruta_frecuente: 'a'.repeat(160) })).ok, true);
  const r = validarSolicitudEnturne(solicitudValida({ ruta_frecuente: 'a'.repeat(161) }));
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('ruta_frecuente') && e.includes('160')));
});
