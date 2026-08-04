import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ControltSoapError,
  AuthError,
  SoapFaultError,
  NetworkError,
  TimeoutError,
  ViajeNotFoundError,
  MappingError,
  ServiceUnavailableError,
} from './errors.js';

// ── Herencia ──────────────────────────────────────────────────────────────

test('AuthError es instancia de ControltSoapError y de Error', () => {
  const err = new AuthError();
  assert.ok(err instanceof AuthError);
  assert.ok(err instanceof ControltSoapError);
  assert.ok(err instanceof Error);
});

test('todas las clases son instancias de ControltSoapError', () => {
  const errors = [
    new AuthError(),
    new SoapFaultError('fault'),
    new NetworkError(),
    new TimeoutError(10_000),
    new ViajeNotFoundError('IN018108'),
    new MappingError('campo'),
    new ServiceUnavailableError({ message: 'err' }),
  ];
  for (const e of errors) {
    assert.ok(e instanceof ControltSoapError, `${e.constructor.name} debe ser ControltSoapError`);
  }
});

// ── Propiedades de cada clase ─────────────────────────────────────────────

test('AuthError — code y statusCode correctos', () => {
  const err = new AuthError();
  assert.equal(err.code, 'AUTH_FAILED');
  assert.equal(err.statusCode, 503);
  assert.equal(err.name, 'AuthError');
});

test('AuthError — acepta mensaje personalizado', () => {
  const err = new AuthError('credenciales incorrectas');
  assert.equal(err.message, 'credenciales incorrectas');
});

test('SoapFaultError — code, statusCode y faultstring correctos', () => {
  const err = new SoapFaultError('No autorizado', 'detalle del fallo');
  assert.equal(err.code, 'SOAP_FAULT');
  assert.equal(err.statusCode, 502);
  assert.equal(err.faultstring, 'No autorizado');
  assert.equal(err.detail, 'detalle del fallo');
  assert.ok(err.message.includes('No autorizado'));
});

test('SoapFaultError — detail es null por defecto', () => {
  const err = new SoapFaultError('fault');
  assert.equal(err.detail, null);
});

test('NetworkError — code y statusCode correctos', () => {
  const err = new NetworkError();
  assert.equal(err.code, 'NETWORK_ERROR');
  assert.equal(err.statusCode, 503);
});

test('TimeoutError — code, statusCode y timeoutMs correctos', () => {
  const err = new TimeoutError(10_000);
  assert.equal(err.code, 'TIMEOUT');
  assert.equal(err.statusCode, 504);
  assert.equal(err.timeoutMs, 10_000);
  assert.ok(err.message.includes('10000'));
});

test('ViajeNotFoundError — code, statusCode y codigoViaje correctos', () => {
  const err = new ViajeNotFoundError('IN018108');
  assert.equal(err.code, 'VIAJE_NOT_FOUND');
  assert.equal(err.statusCode, 404);
  assert.equal(err.codigoViaje, 'IN018108');
  assert.ok(err.message.includes('IN018108'));
});

test('MappingError — code, statusCode, field y detail correctos', () => {
  const err = new MappingError('conductor_cedula', 'valor nulo inesperado');
  assert.equal(err.code, 'MAPPING_ERROR');
  assert.equal(err.statusCode, 500);
  assert.equal(err.field, 'conductor_cedula');
  assert.equal(err.detail, 'valor nulo inesperado');
  assert.ok(err.message.includes('conductor_cedula'));
});

test('MappingError — detail es null por defecto', () => {
  const err = new MappingError('campo');
  assert.equal(err.detail, null);
});

test('ServiceUnavailableError — hasCache siempre false', () => {
  const err = new ServiceUnavailableError({ message: 'sin datos' });
  assert.equal(err.hasCache, false);
  assert.equal(err.code, 'SERVICE_UNAVAILABLE');
  assert.equal(err.statusCode, 503);
});

test('ServiceUnavailableError — acepta code y statusCode personalizados', () => {
  const err = new ServiceUnavailableError({
    message: 'timeout sin cache',
    code: 'TIMEOUT',
    statusCode: 504,
  });
  assert.equal(err.code, 'TIMEOUT');
  assert.equal(err.statusCode, 504);
});

test('ServiceUnavailableError — adjunta cause si se proporciona', () => {
  const original = new Error('conexión rechazada');
  const err = new ServiceUnavailableError({
    message: 'sin datos',
    cause: original,
  });
  assert.strictEqual(err.cause, original);
});

// ── Stack trace ───────────────────────────────────────────────────────────

test('todos los errores tienen stack trace', () => {
  const errors = [
    new AuthError(),
    new SoapFaultError('f'),
    new NetworkError(),
    new TimeoutError(5000),
    new ViajeNotFoundError('X'),
    new MappingError('f'),
    new ServiceUnavailableError({ message: 'e' }),
  ];
  for (const e of errors) {
    assert.ok(typeof e.stack === 'string', `${e.constructor.name} debe tener stack`);
    assert.ok(e.stack.length > 0);
  }
});
