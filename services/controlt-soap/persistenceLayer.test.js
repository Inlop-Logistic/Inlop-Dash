/**
 * Unit tests for persistenceLayer.js
 * Run: node --test services/controlt-soap/persistenceLayer.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { upsertViaje, fetchViaje } from './persistenceLayer.js';
import { MappingError, ServiceUnavailableError } from './errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A valid ViajeRow as produced by tripMapper.mapToViajeRow() */
function makeRow(overrides = {}) {
  return {
    codigo_controlt:               'IN018108',
    estado_viaje:                  'EN_TRANSITO',
    conductor_cedula:              '12345678',
    conductor_nombre:              'Juan Pérez',
    tipo_operacion_codigo:          2,
    tipo_viaje_codigo:              1,
    tipo_carga_codigo:              3,
    valor_mercancia:                50000000,
    moneda:                        'COP',
    valor_flete:                    3500000,
    peso_total_ton:                 12.5,
    volumen_total:                  8.0,
    temperatura_min:                null,
    temperatura_max:                null,
    instrucciones:                 'Manejo cuidadoso',
    paradas:                       [],
    fecha_evento:                  '2026-07-15T08:30:00',
    codigo_controlt_secundario:    'SEC-001',
    codigo_empresa:                '57INLOP',
    planificado_por:               { username: '1007986227', fullname: 'Carlos Lopez' },
    codigo_ruta:                   'RUTA-BOG-MED',
    observaciones:                 'Carga refrigerada',
    referencia_doc1:               'REF-DOC-001',
    referencia_doc2:               'REF-DOC-002',
    campos_auxiliares:             'aux1=val1',
    rastreo_nueva_ui:              true,
    ...overrides,
  };
}

/**
 * A valid soap_* row as returned by Supabase on a SELECT.
 * Mirrors the column mapping in fromSoapRow().
 */
function makeSoapDbRow(overrides = {}) {
  return {
    soap_estado_viaje:                  'EN_TRANSITO',
    soap_conductor_cedula:              '12345678',
    soap_conductor_nombre:              'Juan Pérez',
    soap_tipo_operacion_codigo:          2,
    soap_tipo_viaje_codigo:              1,
    soap_tipo_carga_codigo:              3,
    soap_valor_mercancia:                50000000,
    soap_moneda:                        'COP',
    soap_valor_flete:                    3500000,
    soap_peso_total_ton:                 12.5,
    soap_volumen_total:                  8.0,
    soap_temperatura_min:                null,
    soap_temperatura_max:                null,
    soap_instrucciones:                 'Manejo cuidadoso',
    soap_paradas:                       [],
    soap_fecha_evento:                  '2026-07-15T08:30:00.000Z',
    soap_sincronizado_en:               '2026-08-01T10:00:00.000Z',
    soap_codigo_controlt_secundario:    'SEC-001',
    soap_codigo_empresa:                '57INLOP',
    soap_planificado_por:               { username: '1007986227', fullname: 'Carlos Lopez' },
    soap_codigo_ruta:                   'RUTA-BOG-MED',
    soap_observaciones:                 'Carga refrigerada',
    soap_referencia_doc1:               'REF-DOC-001',
    soap_referencia_doc2:               'REF-DOC-002',
    soap_campos_auxiliares:             'aux1=val1',
    soap_rastreo_nueva_ui:              true,
    ...overrides,
  };
}

/** sbFetch that returns success with no data body (minimal return) */
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
  it('calls sbFetch with PATCH to /rest/v1/cumplidos?id=eq.{trip}', async () => {
    let capturedPath, capturedOpts;
    const sbFetch = async (path, opts) => {
      capturedPath = path;
      capturedOpts = opts;
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow(), { sbFetch });

    assert.ok(capturedPath.startsWith('/rest/v1/cumplidos'));
    assert.ok(capturedPath.includes('id=eq.IN018108'));
    assert.equal(capturedOpts.method, 'PATCH');
  });

  it('does NOT include merge-duplicates in Prefer header (PATCH, not upsert)', async () => {
    let capturedOpts;
    const sbFetch = async (_path, opts) => {
      capturedOpts = opts;
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow(), { sbFetch });

    assert.ok(!capturedOpts.headers['Prefer'].includes('merge-duplicates'));
  });

  it('sends soap_* column names in the body — not the original ViajeRow names', async () => {
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow(), { sbFetch });

    assert.equal(bodyParsed.soap_estado_viaje, 'EN_TRANSITO');
    assert.equal(bodyParsed.soap_conductor_cedula, '12345678');
    assert.equal(bodyParsed.soap_conductor_nombre, 'Juan Pérez');
    assert.equal(bodyParsed.soap_valor_mercancia, 50000000);
    assert.equal(bodyParsed.soap_moneda, 'COP');
    // Original ViajeRow field names must NOT appear in the body
    assert.equal(bodyParsed.estado_viaje,    undefined);
    assert.equal(bodyParsed.codigo_controlt, undefined);
    assert.equal(bodyParsed.conductor_cedula, undefined);
  });

  it('maps paradas to soap_paradas in the body', async () => {
    const paradas = [{ orden: 1, nombre: 'Origen', hora_real: null, productos: [] }];
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow({ paradas }), { sbFetch });

    assert.deepEqual(bodyParsed.soap_paradas, paradas);
    assert.equal(bodyParsed.paradas, undefined);
  });

  it('sets soap_sincronizado_en to current ISO timestamp (overrides any caller value)', async () => {
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    const before = new Date().toISOString();
    await upsertViaje(makeRow(), { sbFetch });
    const after = new Date().toISOString();

    assert.ok(bodyParsed.soap_sincronizado_en >= before);
    assert.ok(bodyParsed.soap_sincronizado_en <= after);
    assert.equal(bodyParsed.sincronizado_en, undefined);
  });

  it('converts fecha_evento string to ISO 8601 in soap_fecha_evento', async () => {
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow({ fecha_evento: '2026-07-15T08:30:00' }), { sbFetch });

    assert.equal(bodyParsed.soap_fecha_evento, '2026-07-15T08:30:00.000Z');
    assert.equal(bodyParsed.fecha_evento, undefined);
  });

  it('stores null in soap_fecha_evento when fecha_evento is unparseable', async () => {
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow({ fecha_evento: 'not-a-date' }), { sbFetch });

    assert.equal(bodyParsed.soap_fecha_evento, null);
  });

  it('resolves without error on success', async () => {
    await assert.doesNotReject(() => upsertViaje(makeRow(), { sbFetch: okFetch() }));
  });

  it('resolves without error when no cumplidos row matches (silent no-op)', async () => {
    // PostgREST PATCH with no matching rows returns 204/200 with no error.
    const noRowFetch = async () => ({ data: null, error: null, status: 204 });
    await assert.doesNotReject(() => upsertViaje(makeRow(), { sbFetch: noRowFetch }));
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

  it('URL-encodes special characters in codigo_controlt for the PATCH path', async () => {
    let capturedPath;
    const sbFetch = async (path, _opts) => {
      capturedPath = path;
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow({ codigo_controlt: 'IN 018 108' }), { sbFetch });
    assert.ok(capturedPath.includes('IN%20018%20108'));
  });
});

// ── fetchViaje ────────────────────────────────────────────────────────────────

describe('fetchViaje', () => {
  it('queries /rest/v1/cumplidos with id=eq.{trip} filter', async () => {
    let capturedPath;
    const sbFetch = async (path, _opts) => {
      capturedPath = path;
      return { data: [], error: null, status: 200 };
    };

    await fetchViaje('IN018108', { sbFetch });

    assert.ok(capturedPath.startsWith('/rest/v1/cumplidos'));
    assert.ok(capturedPath.includes('id=eq.IN018108'));
  });

  it('selects only soap_* columns — no cumplidos business columns', async () => {
    let capturedPath;
    const sbFetch = async (path, _opts) => {
      capturedPath = path;
      return { data: [], error: null, status: 200 };
    };

    await fetchViaje('IN018108', { sbFetch });

    assert.ok(capturedPath.includes('select=soap_'), 'must have select=soap_ in path');
    assert.ok(!capturedPath.includes('placa'), 'must not select cumplidos.placa');
    assert.ok(!capturedPath.includes('estado_cumplido'), 'must not select estado_cumplido');
  });

  it('returns ViajeRow shape with remapped fields when soap data exists', async () => {
    const dbRow = makeSoapDbRow();
    const sbFetch = async () => ({ data: [dbRow], error: null, status: 200 });

    const result = await fetchViaje('IN018108', { sbFetch });

    assert.equal(result.codigo_controlt, 'IN018108');
    assert.equal(result.estado_viaje,    'EN_TRANSITO');
    assert.equal(result.conductor_cedula,'12345678');
    assert.equal(result.conductor_nombre,'Juan Pérez');
    assert.equal(result.moneda,          'COP');
    assert.deepEqual(result.paradas,     []);
    // soap_sincronizado_en should be present as a bonus field for cache checks
    assert.equal(result.soap_sincronizado_en, '2026-08-01T10:00:00.000Z');
  });

  it('remaps soap_* db names — original soap_ prefix must not appear in domain fields', async () => {
    const dbRow = makeSoapDbRow();
    const sbFetch = async () => ({ data: [dbRow], error: null, status: 200 });

    const result = await fetchViaje('IN018108', { sbFetch });

    // Domain field names (no soap_ prefix, except the bonus field)
    assert.ok('estado_viaje' in result);
    assert.ok('conductor_cedula' in result);
    assert.ok(!('soap_estado_viaje' in result), 'remapped result must not expose soap_estado_viaje');
    assert.ok(!('soap_conductor_cedula' in result), 'remapped result must not expose soap_conductor_cedula');
  });

  it('returns null when no cumplidos row exists', async () => {
    const sbFetch = async () => ({ data: [], error: null, status: 200 });
    const result = await fetchViaje('INEXISTENTE', { sbFetch });
    assert.equal(result, null);
  });

  it('returns null when row exists but soap_sincronizado_en is null (never enriched)', async () => {
    const unenrichedRow = makeSoapDbRow({ soap_sincronizado_en: null });
    const sbFetch = async () => ({ data: [unenrichedRow], error: null, status: 200 });

    const result = await fetchViaje('IN018108', { sbFetch });
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

// ── New ViajeRow fields — contract parity (Fase 6) ───────────────────────────

describe('upsertViaje — new fields (Fase 6)', () => {
  it('sends all 9 new soap_* columns in the PATCH body', async () => {
    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(makeRow(), { sbFetch });

    assert.equal(bodyParsed.soap_codigo_controlt_secundario, 'SEC-001');
    assert.equal(bodyParsed.soap_codigo_empresa,             '57INLOP');
    assert.deepEqual(bodyParsed.soap_planificado_por, { username: '1007986227', fullname: 'Carlos Lopez' });
    assert.equal(bodyParsed.soap_codigo_ruta,                'RUTA-BOG-MED');
    assert.equal(bodyParsed.soap_observaciones,              'Carga refrigerada');
    assert.equal(bodyParsed.soap_referencia_doc1,            'REF-DOC-001');
    assert.equal(bodyParsed.soap_referencia_doc2,            'REF-DOC-002');
    assert.equal(bodyParsed.soap_campos_auxiliares,          'aux1=val1');
    assert.equal(bodyParsed.soap_rastreo_nueva_ui,           true);
  });

  it('sends null for new fields when absent from viajeRow', async () => {
    const minimalRow = makeRow({
      codigo_controlt_secundario: undefined,
      codigo_empresa:             undefined,
      planificado_por:            undefined,
      codigo_ruta:                undefined,
      observaciones:              undefined,
      referencia_doc1:            undefined,
      referencia_doc2:            undefined,
      campos_auxiliares:          undefined,
      rastreo_nueva_ui:           undefined,
    });

    let bodyParsed;
    const sbFetch = async (_path, opts) => {
      bodyParsed = JSON.parse(opts.body);
      return { data: null, error: null, status: 200 };
    };

    await upsertViaje(minimalRow, { sbFetch });

    assert.equal(bodyParsed.soap_codigo_controlt_secundario, null);
    assert.equal(bodyParsed.soap_codigo_empresa,             null);
    assert.equal(bodyParsed.soap_planificado_por,            null);
    assert.equal(bodyParsed.soap_codigo_ruta,                null);
    assert.equal(bodyParsed.soap_observaciones,              null);
    assert.equal(bodyParsed.soap_referencia_doc1,            null);
    assert.equal(bodyParsed.soap_referencia_doc2,            null);
    assert.equal(bodyParsed.soap_campos_auxiliares,          null);
    assert.equal(bodyParsed.soap_rastreo_nueva_ui,           null);
  });

  it('SOAP_SELECT includes all 9 new column names', async () => {
    let capturedPath;
    const sbFetch = async (path, _opts) => {
      capturedPath = path;
      return { data: [], error: null, status: 200 };
    };

    await fetchViaje('IN018108', { sbFetch });

    const selectParam = capturedPath.split('select=')[1]?.split('&')[0] ?? '';
    const cols = selectParam.split(',');

    for (const col of [
      'soap_codigo_controlt_secundario',
      'soap_codigo_empresa',
      'soap_planificado_por',
      'soap_codigo_ruta',
      'soap_observaciones',
      'soap_referencia_doc1',
      'soap_referencia_doc2',
      'soap_campos_auxiliares',
      'soap_rastreo_nueva_ui',
    ]) {
      assert.ok(cols.includes(col), `SOAP_SELECT must include ${col}`);
    }
  });
});

describe('fetchViaje — new fields (Fase 6)', () => {
  it('remaps all 9 new soap_* columns to domain ViajeRow fields', async () => {
    const dbRow = makeSoapDbRow();
    const sbFetch = async () => ({ data: [dbRow], error: null, status: 200 });

    const result = await fetchViaje('IN018108', { sbFetch });

    assert.equal(result.codigo_controlt_secundario, 'SEC-001');
    assert.equal(result.codigo_empresa,             '57INLOP');
    assert.deepEqual(result.planificado_por, { username: '1007986227', fullname: 'Carlos Lopez' });
    assert.equal(result.codigo_ruta,                'RUTA-BOG-MED');
    assert.equal(result.observaciones,              'Carga refrigerada');
    assert.equal(result.referencia_doc1,            'REF-DOC-001');
    assert.equal(result.referencia_doc2,            'REF-DOC-002');
    assert.equal(result.campos_auxiliares,          'aux1=val1');
    assert.equal(result.rastreo_nueva_ui,           true);
  });

  it('new domain fields must not expose their soap_ prefixed names', async () => {
    const dbRow = makeSoapDbRow();
    const sbFetch = async () => ({ data: [dbRow], error: null, status: 200 });

    const result = await fetchViaje('IN018108', { sbFetch });

    assert.ok(!('soap_codigo_controlt_secundario' in result));
    assert.ok(!('soap_codigo_empresa'             in result));
    assert.ok(!('soap_planificado_por'            in result));
    assert.ok(!('soap_codigo_ruta'                in result));
    assert.ok(!('soap_observaciones'              in result));
    assert.ok(!('soap_referencia_doc1'            in result));
    assert.ok(!('soap_referencia_doc2'            in result));
    assert.ok(!('soap_campos_auxiliares'          in result));
    assert.ok(!('soap_rastreo_nueva_ui'           in result));
  });

  it('returns null for new fields when database columns are null', async () => {
    const dbRow = makeSoapDbRow({
      soap_codigo_controlt_secundario: null,
      soap_codigo_empresa:             null,
      soap_planificado_por:            null,
      soap_codigo_ruta:                null,
      soap_observaciones:              null,
      soap_referencia_doc1:            null,
      soap_referencia_doc2:            null,
      soap_campos_auxiliares:          null,
      soap_rastreo_nueva_ui:           null,
    });
    const sbFetch = async () => ({ data: [dbRow], error: null, status: 200 });

    const result = await fetchViaje('IN018108', { sbFetch });

    assert.equal(result.codigo_controlt_secundario, null);
    assert.equal(result.codigo_empresa,             null);
    assert.equal(result.planificado_por,            null);
    assert.equal(result.codigo_ruta,                null);
    assert.equal(result.observaciones,              null);
    assert.equal(result.referencia_doc1,            null);
    assert.equal(result.referencia_doc2,            null);
    assert.equal(result.campos_auxiliares,          null);
    assert.equal(result.rastreo_nueva_ui,           null);
  });
});
