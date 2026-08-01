import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepFixMojibake } from './soapGateway.js';

// ── deepFixMojibake ───────────────────────────────────────────────────────────

test('corrige mojibake en string de primer nivel', () => {
  assert.equal(deepFixMojibake('PetrÃ³leo'), 'Petróleo');
});

test('no modifica string ASCII limpio', () => {
  assert.equal(deepFixMojibake('Carga general seca'), 'Carga general seca');
});

test('corrige mojibake en valores de un objeto plano', () => {
  const input = {
    conductor: 'JosÃ© GÃ³mez',
    vehiculo: 'ABC123',
    estado: 'EN_TRÁNSITO',
  };
  const result = deepFixMojibake(input);
  assert.equal(result.conductor, 'José Gómez');
  assert.equal(result.vehiculo, 'ABC123');
});

test('corrige recursivamente en objetos anidados', () => {
  const input = {
    viaje: {
      origen: 'BogotÃ¡',
      destino: 'MedellÃ­n',
      paradas: [
        { ciudad: 'ManzÃ¡nales' },
        { ciudad: 'Cali' },
      ],
    },
  };
  const result = deepFixMojibake(input);
  assert.equal(result.viaje.origen, 'Bogotá');
  assert.equal(result.viaje.destino, 'Medellín');
  assert.equal(result.viaje.paradas[0].ciudad, 'Manzánales');
  assert.equal(result.viaje.paradas[1].ciudad, 'Cali');
});

test('corrige mojibake dentro de arrays de strings', () => {
  const input = ['BogotÃ¡', 'MedellÃ­n', 'Cali'];
  const result = deepFixMojibake(input);
  assert.deepEqual(result, ['Bogotá', 'Medellín', 'Cali']);
});

test('no muta el objeto original', () => {
  const input = { ciudad: 'BogotÃ¡' };
  deepFixMojibake(input);
  assert.equal(input.ciudad, 'BogotÃ¡');
});

test('retorna primitivos no-string sin cambios', () => {
  assert.equal(deepFixMojibake(42), 42);
  assert.equal(deepFixMojibake(true), true);
  assert.equal(deepFixMojibake(null), null);
});

test('maneja objeto vacío', () => {
  assert.deepEqual(deepFixMojibake({}), {});
});

test('maneja array vacío', () => {
  assert.deepEqual(deepFixMojibake([]), []);
});

test('maneja string con múltiples acentos', () => {
  const result = deepFixMojibake('CargaciÃ³n y descargaciÃ³n en BogotÃ¡');
  assert.equal(result, 'Cargación y descargación en Bogotá');
});

test('retorna string original ante secuencia de bytes inválida en UTF-8', () => {
  const broken = '\xFF\xFE';
  // deepFixMojibake must not throw — fixMojibake returns the original
  assert.doesNotThrow(() => deepFixMojibake(broken));
  assert.equal(deepFixMojibake(broken), broken);
});

test('maneja array con tipos mixtos', () => {
  const input = [42, 'BogotÃ¡', null, { ok: true }];
  const result = deepFixMojibake(input);
  assert.equal(result[0], 42);
  assert.equal(result[1], 'Bogotá');
  assert.equal(result[2], null);
  assert.deepEqual(result[3], { ok: true });
});
