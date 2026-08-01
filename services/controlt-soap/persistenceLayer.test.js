/**
 * Unit tests for persistenceLayer.js
 * Run: node --test services/controlt-soap/persistenceLayer.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { upsertViaje, fetchViaje } from './persistenceLayer.js';
import { MappingError, ServiceUnavailableError } from './errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRow(overrides = {}) {
  return {
    codigo_controlt:      'IN018108',
    estado_viaje:         'EN_TRANSITO',
    conductor_cedula:     '12345678',
    conductor_nombre:     'Juan Pérez',
    tipo_operacion_codigo: 2,
    tipo_viaje_codigo:    1,
    tipo_carga_codigo:    3,
    valor_mercancia:      50000000,
    moneda:               'COP',
    valor_flete:          3500000,
    peso_total_ton:       12.5,
    volumen_total:        8.0,
    temperatura_min:      null,
    temperatura_max:      null,
    instrucciones:        'Manejo cuidadoso',
    paradas:              [],
    fecha_evento:         '2026-07-15T08:30:00',
    ...overrides,
  };
}

/** sbFetch that returns success */
function okFetch() {
  return async (_path, _opts) => ({ data: null, error: null, status: 200 });
}

/** sbFetch that returns a Supabase-style error */
function errorFetch(code, message, status = 400) {
  return async (_path, _opts) => ({
    data: null,
    error: { code, message },
    status,
  });
}

/** sbFetch that throws a network error */
function networkErrorFetch(msg = 'ECONNRESET') {
  return async (_path, _opts) => { throw new Error(msg); };
}

// ── upsertViaje ───────────────────────────────────────────────────────────────

describe('upsertViaje', () => {
  it('calls sbFetch with POST to /rest/v1/controlt_viajes', async () => {
    let capturedPath, capturedOpts;
    const sbFetch = async (path, opts) => {
      capturedPath = path;
      capturedOpts = opts;
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow(), { sbFetch });

    assert.equal(capturedPath, '/rest/v1/controlt_viajes');
    assert.equal(capturedOpts.method, 'POST');
    assert.match(capturedOpts.headers['Prefer'], /merge-duplicates/);
  });

  it('sends the row JSON in the body', async () => {
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow(), { sbFetch });

    assert.equal(bodyParsed.codigo_controlt, 'IN018108');
    assert.equal(bodyParsed.estado_viaje, 'EN_TRANSITO');
  });

  it('overrides sincronizado_en with current ISO timestamp', async () => {
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    const before = new Date().toISOString();
    await upsertViaje(makeRow({ sincronizado_en: '2020-01-01T00:00:00Z' }), { sbFetch });
    const after = new Date().toISOString();

    assert.ok(bodyParsed.sincronizado_en >= before);
    assert.ok(bodyParsed.sincronizado_en <= after);
  });

  it('resolves without error on success', async () => {
    await assert.doesNotReject(() => upsertViaje(makeRow(), { sbFetch: okFetch() }));
  });

  it('throws ServiceUnavailableError on network failure', async () => {
    await assert.rejects(
      () => upsertViaje(makeRow(), { sbFetch: networkErrorFetch() }),
      (err) => err instanceof ServiceUnavailableError
    );
  });

  it('throws MappingError on check constraint violation (23514)', async () => {
    await assert.rejects(
      () => upsertViaje(makeRow(), { sbFetch: errorFetch('23514', 'check constraint') }),
      (err) => err instanceof MappingError
    );
  });

  it('throws MappingError on not-null violation (23502)', async () => {
    await assert.rejects(
      () => upsertViaje(makeRow(), { sbFetch: errorFetch('23502', 'null violation') }),
      (err) => err instanceof MappingError
    );
  });

  it('throws MappingError on other Supabase errors', async () => {
    await assert.rejects(
      () => upsertViaje(makeRow(), { sbFetch: errorFetch('42P01', 'table not found') }),
      (err) => err instanceof MappingError
    );
  });

  it('throws MappingError when viajeRow is null', async () => {
    await assert.rejects(
      () => upsertViaje(null, { sbFetch: okFetch() }),
      (err) => err instanceof MappingError
    );
  });

  it('throws MappingError when codigo_controlt is missing', async () => {
    await assert.rejects(
      () => upsertViaje({ estado_viaje: 'PENDIENTE', paradas: [] }, { sbFetch: okFetch() }),
      (err) => err instanceof MappingError
    );
  });

  it('includes paradas JSONB in the request body', async () => {
    const paradas = [{ orden: 1, nombre: 'Origen', hora_real: null, productos: [] }];
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow({ paradas }), { sbFetch });

    assert.deepEqual(bodyParsed.paradas, paradas);
  });
});

// ── fetchViaje ────────────────────────────────────────────────────────────────

describe('fetchViaje', () => {
  it('queries the correct path with codigo filter', async () => {
    let capturedPath;
    const sbFetch = async (path, _opts) => {
      capturedPath = path;
      return { data: [], error: null, status: 200 };
    };

    await fetchViaje('IN018108', { sbFetch });

    assert.ok(capturedPath.includes('/rest/v1/controlt_viajes'));
    assert.ok(capturedPath.includes('codigo_controlt=eq.IN018108'));
  });

  it('returns the row when found', async () => {
    const stored = makeRow();
    const sbFetch = async () => ({ data: [stored], error: null, status: 200 });

    const result = await fetchViaje('IN018108', { sbFetch });
    assert.deepEqual(result, stored);
  });

  it('returns null when row not found', async () => {
    const sbFetch = async () => ({ data: [], error: null, status: 200 });
    const result = await fetchViaje('INEXISTENTE', { sbFetch });
    assert.equal(result, null);
  });

  it('returns null when data is null', async () => {
    const sbFetch = async () => ({ data: null, error: null, status: 200 });
    const result = await fetchViaje('IN018108', { sbFetch });
    assert.equal(result, null);
  });

  it('throws ServiceUnavailableError on network failure', async () => {
    await assert.rejects(
      () => fetchViaje('IN018108', { sbFetch: networkErrorFetch() }),
      (err) => err instanceof ServiceUnavailableError
    );
  });

  it('throws MappingError on Supabase error', async () => {
    await assert.rejects(
      () => fetchViaje('IN018108', { sbFetch: errorFetch('42P01', 'table not found') }),
      (err) => err instanceof MappingError
    );
  });

  it('throws MappingError when codigoViaje is empty', async () => {
    await assert.rejects(
      () => fetchViaje('', { sbFetch: okFetch() }),
      (err) => err instanceof MappingError
    );
  });

  it('URL-encodes special characters in codigoViaje', async () => {
    let capturedPath;
    const sbFetch = async (path, _opts) => {
      capturedPath = path;
      return { data: [], error: null, status: 200 };
    };

    await fetchViaje('IN 018 108', { sbFetch });
    assert.ok(capturedPath.includes('IN%20018%20108'));
  });
});
