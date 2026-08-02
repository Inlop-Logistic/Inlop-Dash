/**
 * Unit tests for tripService.js
 * Run: node --test services/controlt-soap/tripService.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTripDetail, makeSbFetchAdapter } from './tripService.js';
import { SoapFaultError, AuthError, NetworkError, ViajeNotFoundError } from './errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SOAP_RESULT = { GetDetailMonitoringOrderResult: { Paradas: {} } };

function makeViajeRow(sincronizadoEn = new Date().toISOString()) {
  return {
    codigo_controlt:       'IN018108',
    estado_viaje:          'EN_TRANSITO',
    conductor_cedula:      null,
    conductor_nombre:      null,
    tipo_operacion_codigo: null,
    tipo_viaje_codigo:     null,
    tipo_carga_codigo:     null,
    valor_mercancia:       null,
    moneda:                null,
    valor_flete:           null,
    peso_total_ton:        null,
    volumen_total:         null,
    temperatura_min:       null,
    temperatura_max:       null,
    instrucciones:         null,
    paradas:               [],
    fecha_evento:          null,
    soap_sincronizado_en:  sincronizadoEn,
  };
}

/**
 * Build the full deps object with sensible defaults.
 * All SOAP-level deps default to mocks so tests never hit the network.
 */
function makeDeps(overrides = {}) {
  return {
    sbFetch:        async () => ({ data: null, error: null, status: 200 }),
    config:         { endpoint: 'http://mock', user: 'u', pass: 'p', timeoutMs: 5000, namespace: '' },
    cacheTtlMs:     300_000,
    _fetchViaje:    async () => null,
    _upsertViaje:   async () => {},
    _soapGetDetail: async () => MOCK_SOAP_RESULT,
    _mapper:        ()       => makeViajeRow(),
    _now:           ()       => Date.now(),
    ...overrides,
  };
}

// ── getTripDetail — cache policy ──────────────────────────────────────────────

describe('getTripDetail — cache policy', () => {
  it('returns cached row immediately when cache is fresh (no SOAP call)', async () => {
    const freshRow = makeViajeRow(new Date().toISOString());
    let soapCalled = false;

    const result = await getTripDetail('IN018108', makeDeps({
      _fetchViaje:    async () => freshRow,
      _soapGetDetail: async () => { soapCalled = true; return MOCK_SOAP_RESULT; },
    }));

    assert.equal(soapCalled, false, 'SOAP must not be called on cache hit');
    assert.deepEqual(result, freshRow);
  });

  it('calls SOAP when fetchViaje returns null (no row in cumplidos)', async () => {
    let soapCalled = false;

    const result = await getTripDetail('IN018108', makeDeps({
      _fetchViaje:    async () => null,
      _soapGetDetail: async () => { soapCalled = true; return MOCK_SOAP_RESULT; },
    }));

    assert.equal(soapCalled, true, 'SOAP must be called on cache miss');
    assert.equal(result.codigo_controlt, 'IN018108');
  });

  it('calls SOAP when cached soap_sincronizado_en is older than cacheTtlMs', async () => {
    const staleTs  = new Date(Date.now() - 400_000).toISOString(); // 400 s ago
    const staleRow = makeViajeRow(staleTs);
    let soapCalled = false;

    await getTripDetail('IN018108', makeDeps({
      cacheTtlMs:     300_000,  // 5 min TTL
      _fetchViaje:    async () => staleRow,
      _soapGetDetail: async () => { soapCalled = true; return MOCK_SOAP_RESULT; },
    }));

    assert.equal(soapCalled, true, 'SOAP must be called when cache is stale');
  });

  it('does NOT call SOAP when cached soap_sincronizado_en is within cacheTtlMs', async () => {
    const freshTs  = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    const freshRow = makeViajeRow(freshTs);
    let soapCalled = false;

    await getTripDetail('IN018108', makeDeps({
      cacheTtlMs:     300_000, // 5 min TTL — 1 min old is fresh
      _fetchViaje:    async () => freshRow,
      _soapGetDetail: async () => { soapCalled = true; return MOCK_SOAP_RESULT; },
    }));

    assert.equal(soapCalled, false, 'SOAP must not be called when cache is fresh');
  });

  it('uses _now hook to control freshness in tests', async () => {
    const ts = new Date(1_000_000).toISOString(); // epoch + 1 s
    const row = makeViajeRow(ts);
    let soapCalled = false;

    // _now returns 1_000_000 + 299_000 ms → age = 299 s → within 300 s TTL → fresh
    await getTripDetail('IN018108', makeDeps({
      _fetchViaje:    async () => row,
      _soapGetDetail: async () => { soapCalled = true; return MOCK_SOAP_RESULT; },
      cacheTtlMs:     300_000,
      _now:           () => 1_000_000 + 299_000,
    }));

    assert.equal(soapCalled, false, 'cache should be considered fresh');
  });

  it('considers cache stale when _now is just past the TTL boundary', async () => {
    const ts = new Date(1_000_000).toISOString();
    const row = makeViajeRow(ts);
    let soapCalled = false;

    // _now returns 1_000_000 + 300_001 ms → age = 300.001 s → stale
    await getTripDetail('IN018108', makeDeps({
      _fetchViaje:    async () => row,
      _soapGetDetail: async () => { soapCalled = true; return MOCK_SOAP_RESULT; },
      cacheTtlMs:     300_000,
      _now:           () => 1_000_000 + 300_001,
    }));

    assert.equal(soapCalled, true, 'cache should be considered stale');
  });
});

// ── getTripDetail — SOAP flow ─────────────────────────────────────────────────

describe('getTripDetail — SOAP flow', () => {
  it('passes codigoViaje and config to soapGetDetail', async () => {
    let capturedCode, capturedConfig;

    await getTripDetail('IN018108', makeDeps({
      _soapGetDetail: async (code, cfg) => {
        capturedCode   = code;
        capturedConfig = cfg;
        return MOCK_SOAP_RESULT;
      },
    }));

    assert.equal(capturedCode, 'IN018108');
    assert.equal(capturedConfig.user, 'u');
  });

  it('passes soapResult and codigoViaje to mapper', async () => {
    let capturedResult, capturedCode;

    await getTripDetail('IN018108', makeDeps({
      _mapper: (result, code) => {
        capturedResult = result;
        capturedCode   = code;
        return makeViajeRow();
      },
    }));

    assert.deepEqual(capturedResult, MOCK_SOAP_RESULT);
    assert.equal(capturedCode, 'IN018108');
  });

  it('upserts the mapped ViajeRow after a SOAP call', async () => {
    let upsertedRow;
    const expectedRow = makeViajeRow();

    await getTripDetail('IN018108', makeDeps({
      _mapper:      () => expectedRow,
      _upsertViaje: async (row) => { upsertedRow = row; },
    }));

    assert.deepEqual(upsertedRow, expectedRow);
  });

  it('returns the mapped ViajeRow from SOAP call', async () => {
    const expectedRow = makeViajeRow();

    const result = await getTripDetail('IN018108', makeDeps({
      _mapper: () => expectedRow,
    }));

    assert.deepEqual(result, expectedRow);
  });
});

// ── getTripDetail — auth fault retry ──────────────────────────────────────────

describe('getTripDetail — auth fault retry', () => {
  it('retries SOAP once on auth SoapFaultError and returns result', async () => {
    let callCount = 0;
    const authFault = new SoapFaultError('Invalid authentication token');

    const result = await getTripDetail('IN018108', makeDeps({
      _soapGetDetail: async () => {
        callCount++;
        if (callCount === 1) throw authFault;
        return MOCK_SOAP_RESULT;
      },
    }));

    assert.equal(callCount, 2, 'must have called SOAP exactly twice');
    assert.equal(result.codigo_controlt, 'IN018108');
  });

  it('propagates error when both auth-fault retries fail', async () => {
    const authFault = new SoapFaultError('session expired — please authenticate');

    await assert.rejects(
      () => getTripDetail('IN018108', makeDeps({
        _soapGetDetail: async () => { throw authFault; },
      })),
      (err) => err === authFault
    );
  });

  it('does NOT retry on non-auth SoapFaultError', async () => {
    let callCount = 0;
    const nonAuthFault = new SoapFaultError('Internal server error');

    await assert.rejects(
      () => getTripDetail('IN018108', makeDeps({
        _soapGetDetail: async () => {
          callCount++;
          throw nonAuthFault;
        },
      })),
      (err) => err === nonAuthFault
    );

    assert.equal(callCount, 1, 'must not retry on non-auth fault');
  });

  it('does NOT retry on AuthError (different from SoapFaultError)', async () => {
    let callCount = 0;
    const authError = new AuthError('Login failed');

    await assert.rejects(
      () => getTripDetail('IN018108', makeDeps({
        _soapGetDetail: async () => {
          callCount++;
          throw authError;
        },
      })),
      (err) => err === authError
    );

    assert.equal(callCount, 1, 'AuthError must propagate without retry');
  });

  it('does NOT retry on NetworkError', async () => {
    let callCount = 0;

    await assert.rejects(
      () => getTripDetail('IN018108', makeDeps({
        _soapGetDetail: async () => {
          callCount++;
          throw new NetworkError('ECONNRESET');
        },
      })),
      (err) => err instanceof NetworkError
    );

    assert.equal(callCount, 1, 'NetworkError must propagate without retry');
  });

  it('does NOT retry on ViajeNotFoundError', async () => {
    let callCount = 0;

    await assert.rejects(
      () => getTripDetail('IN018108', makeDeps({
        _soapGetDetail: async () => {
          callCount++;
          throw new ViajeNotFoundError('IN018108');
        },
      })),
      (err) => err instanceof ViajeNotFoundError
    );

    assert.equal(callCount, 1, 'ViajeNotFoundError must propagate without retry');
  });
});

// ── getTripDetail — best-effort persistence ────────────────────────────────────

describe('getTripDetail — best-effort persistence', () => {
  it('returns ViajeRow from SOAP even when upsert throws', async () => {
    const expectedRow = makeViajeRow();

    const result = await getTripDetail('IN018108', makeDeps({
      _mapper:      () => expectedRow,
      _upsertViaje: async () => { throw new Error('Supabase unavailable'); },
    }));

    assert.deepEqual(result, expectedRow, 'caller must still get the SOAP data');
  });

  it('does not call upsert on cache hit', async () => {
    let upsertCalled = false;
    const freshRow = makeViajeRow(new Date().toISOString());

    await getTripDetail('IN018108', makeDeps({
      _fetchViaje:  async () => freshRow,
      _upsertViaje: async () => { upsertCalled = true; },
    }));

    assert.equal(upsertCalled, false, 'upsert must not be called on cache hit');
  });
});

// ── getTripDetail — input validation ─────────────────────────────────────────

describe('getTripDetail — input validation', () => {
  it('throws TypeError for empty string codigoViaje', async () => {
    await assert.rejects(
      () => getTripDetail('', makeDeps()),
      (err) => err instanceof TypeError
    );
  });

  it('throws TypeError for whitespace-only codigoViaje', async () => {
    await assert.rejects(
      () => getTripDetail('   ', makeDeps()),
      (err) => err instanceof TypeError
    );
  });

  it('throws TypeError for null codigoViaje', async () => {
    await assert.rejects(
      () => getTripDetail(null, makeDeps()),
      (err) => err instanceof TypeError
    );
  });

  it('throws TypeError for undefined codigoViaje', async () => {
    await assert.rejects(
      () => getTripDetail(undefined, makeDeps()),
      (err) => err instanceof TypeError
    );
  });

  it('trims whitespace from codigoViaje before passing to downstream calls', async () => {
    let capturedFetchCode, capturedSoapCode, capturedUpsertRow;

    await getTripDetail('  IN018108  ', makeDeps({
      _fetchViaje:    async (code) => { capturedFetchCode = code; return null; },
      _soapGetDetail: async (code) => { capturedSoapCode  = code; return MOCK_SOAP_RESULT; },
      _upsertViaje:   async (row)  => { capturedUpsertRow = row; },
    }));

    assert.equal(capturedFetchCode, 'IN018108');
    assert.equal(capturedSoapCode,  'IN018108');
    assert.equal(capturedUpsertRow.codigo_controlt, 'IN018108');
  });
});

// ── makeSbFetchAdapter ────────────────────────────────────────────────────────

describe('makeSbFetchAdapter', () => {
  const BASE_URL = 'https://test.supabase.co/rest/v1';
  const KEY      = 'test-service-key';

  function makeResponse({ ok = true, status = 200, body = 'null' } = {}) {
    return { ok, status, statusText: ok ? 'OK' : 'Bad Request', text: async () => body };
  }

  it('sets apikey and Authorization headers on every request', async () => {
    let capturedHeaders;
    const mockFetch = async (_url, opts) => {
      capturedHeaders = opts.headers;
      return makeResponse();
    };

    const sbFetch = makeSbFetchAdapter(BASE_URL, KEY, mockFetch);
    await sbFetch('/cumplidos', { method: 'GET' });

    assert.equal(capturedHeaders['apikey'],        KEY);
    assert.equal(capturedHeaders['Authorization'], `Bearer ${KEY}`);
  });

  it('builds the full URL from baseUrl + path', async () => {
    let capturedUrl;
    const mockFetch = async (url, _opts) => {
      capturedUrl = url;
      return makeResponse();
    };

    const sbFetch = makeSbFetchAdapter(BASE_URL, KEY, mockFetch);
    await sbFetch('/cumplidos?id=eq.IN018108', { method: 'GET' });

    assert.equal(capturedUrl, `${BASE_URL}/cumplidos?id=eq.IN018108`);
  });

  it('caller headers override base headers (e.g. Prefer: return=minimal)', async () => {
    let capturedHeaders;
    const mockFetch = async (_url, opts) => {
      capturedHeaders = opts.headers;
      return makeResponse({ body: '' });
    };

    const sbFetch = makeSbFetchAdapter(BASE_URL, KEY, mockFetch);
    await sbFetch('/cumplidos', {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal', 'Content-Type': 'application/json' },
      body:    JSON.stringify({ soap_estado_viaje: 'EN_TRANSITO' }),
    });

    assert.equal(capturedHeaders['Prefer'],       'return=minimal');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');
  });

  it('returns { data, error: null, status } on HTTP success', async () => {
    const payload = [{ id: 'IN018108', soap_estado_viaje: 'EN_TRANSITO' }];
    const mockFetch = async () => makeResponse({ body: JSON.stringify(payload) });

    const sbFetch = makeSbFetchAdapter(BASE_URL, KEY, mockFetch);
    const result = await sbFetch('/cumplidos', { method: 'GET' });

    assert.deepEqual(result.data,   payload);
    assert.equal(result.error,      null);
    assert.equal(result.status,     200);
  });

  it('returns { data: null, error, status } on HTTP error with JSON body', async () => {
    const errorBody = { code: '23514', message: 'check constraint violation' };
    const mockFetch = async () =>
      makeResponse({ ok: false, status: 400, body: JSON.stringify(errorBody) });

    const sbFetch = makeSbFetchAdapter(BASE_URL, KEY, mockFetch);
    const result = await sbFetch('/cumplidos', { method: 'PATCH' });

    assert.equal(result.data,            null);
    assert.equal(result.error.code,      '23514');
    assert.equal(result.error.message,   'check constraint violation');
    assert.equal(result.status,          400);
  });

  it('returns generic error object on HTTP error with non-JSON body', async () => {
    const mockFetch = async () =>
      makeResponse({ ok: false, status: 500, body: 'Internal Server Error' });

    const sbFetch = makeSbFetchAdapter(BASE_URL, KEY, mockFetch);
    const result = await sbFetch('/cumplidos', { method: 'POST' });

    assert.equal(result.data,  null);
    assert.equal(result.error.code, '500');
    assert.ok(result.error.message);
    assert.equal(result.status, 500);
  });

  it('returns { data: null, error: null } for empty 204 body', async () => {
    const mockFetch = async () => makeResponse({ status: 204, body: '' });

    const sbFetch = makeSbFetchAdapter(BASE_URL, KEY, mockFetch);
    const result = await sbFetch('/cumplidos', { method: 'PATCH' });

    assert.equal(result.data,  null);
    assert.equal(result.error, null);
    assert.equal(result.status, 204);
  });

  it('propagates network errors so persistenceLayer can wrap them', async () => {
    const networkErr = new Error('ECONNRESET');
    const mockFetch  = async () => { throw networkErr; };

    const sbFetch = makeSbFetchAdapter(BASE_URL, KEY, mockFetch);
    await assert.rejects(
      () => sbFetch('/cumplidos', { method: 'GET' }),
      (err) => err === networkErr
    );
  });
});
