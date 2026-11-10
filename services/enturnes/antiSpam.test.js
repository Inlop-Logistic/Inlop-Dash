/**
 * Unit tests for antiSpam.js (Enturne de Vehículos)
 * Run: node --test services/enturnes/antiSpam.test.js
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { excedeLimiteTasa, pareceSpam, _resetParaTests } from './antiSpam.js';

beforeEach(() => { _resetParaTests(); });

test('pareceSpam: honeypot vacío no es spam', () => {
  assert.equal(pareceSpam({ nombre: 'Juan', _hp: '' }), false);
  assert.equal(pareceSpam({ nombre: 'Juan' }), false); // campo ausente también es válido
});

test('pareceSpam: honeypot con contenido se marca como spam', () => {
  assert.equal(pareceSpam({ nombre: 'Juan', _hp: 'http://spam.example' }), true);
});

test('pareceSpam: honeypot con solo espacios no cuenta (trim)', () => {
  assert.equal(pareceSpam({ _hp: '   ' }), false);
});

test('excedeLimiteTasa: primeras 5 solicitudes de una IP pasan, la 6ª se bloquea', () => {
  const ip = '10.0.0.1';
  for (let i = 0; i < 5; i++) {
    assert.equal(excedeLimiteTasa(ip), false, `solicitud ${i + 1} no debería exceder el límite`);
  }
  assert.equal(excedeLimiteTasa(ip), true, 'la 6ª solicitud en la misma ventana debe bloquearse');
});

test('excedeLimiteTasa: IPs distintas no comparten contador', () => {
  for (let i = 0; i < 5; i++) excedeLimiteTasa('10.0.0.2');
  assert.equal(excedeLimiteTasa('10.0.0.3'), false, 'una IP distinta empieza su propio contador');
});
