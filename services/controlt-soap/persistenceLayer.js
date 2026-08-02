/**
 * PersistenceLayer — persists SOAP-enriched data into the `cumplidos` table.
 *
 * Design rules:
 *   - Receives an sbFetch dependency (injected) — fully unit-testable without
 *     a real Supabase connection.
 *   - upsertViaje: PATCHes soap_* columns onto the existing cumplidos row
 *     identified by id = viajeRow.codigo_controlt.
 *     Does NOT insert — cumplidos rows are owned by syncCumplidos (Resume API).
 *     If no cumplidos row exists yet, the PATCH is a silent no-op; the caller
 *     (tripService) retries enrichment after syncCumplidos creates the row.
 *   - fetchViaje: fetches soap_* columns from cumplidos and returns them
 *     remapped to ViajeRow shape. Returns null when no row exists OR when
 *     the row exists but has never been SOAP-enriched (soap_sincronizado_en IS NULL).
 *   - Throws ServiceUnavailableError on network/timeout failures.
 *   - Throws MappingError on unexpected Supabase error codes.
 *
 * Architecture decision (2026-08-01 — Alternativa B, certified):
 *   SOAP enrichment data is persisted as soap_* columns on cumplidos.
 *   The cancelled table controlt_viajes must NOT be used.
 *   Ref: docs/integraciones/controlt/AUDITORIA_IMPACTO_MODELO_VIAJE.md
 *
 * sbFetch contract:
 *   sbFetch(path, options) → Promise<{ data, error, status }>
 *   where path is a Supabase REST path (e.g. '/rest/v1/cumplidos')
 *   and options follows the fetch init shape.
 *   This is NOT the same as the global sbFetch in index.js — tripService
 *   provides an adapter that normalises the two contracts.
 */

import { MappingError, ServiceUnavailableError } from './errors.js';

const TABLE = 'cumplidos';
const PATH  = `/rest/v1/${TABLE}`;

// Columns to SELECT on fetch — soap_* only, plus id for the filter.
// No cumplidos business columns are read; this module is soap-scoped.
const SOAP_SELECT = [
  'soap_estado_viaje',
  'soap_conductor_cedula',
  'soap_conductor_nombre',
  'soap_tipo_operacion_codigo',
  'soap_tipo_viaje_codigo',
  'soap_tipo_carga_codigo',
  'soap_valor_mercancia',
  'soap_moneda',
  'soap_valor_flete',
  'soap_peso_total_ton',
  'soap_volumen_total',
  'soap_temperatura_min',
  'soap_temperatura_max',
  'soap_instrucciones',
  'soap_paradas',
  'soap_fecha_evento',
  'soap_sincronizado_en',
].join(',');

// ── Mapping helpers ───────────────────────────────────────────────────────────

/**
 * Convert a ViajeRow (tripMapper output) to a soap_* PATCH body.
 * The cumplidos PK (`id`) is used in the URL filter — not in the body.
 *
 * @param {import('./tripMapper.js').ViajeRow} viajeRow
 * @param {string} sincronizadoEn — ISO timestamp set by the caller
 * @returns {object}
 */
function toSoapPatch(viajeRow, sincronizadoEn) {
  return {
    soap_estado_viaje:          viajeRow.estado_viaje          ?? null,
    soap_conductor_cedula:      viajeRow.conductor_cedula       ?? null,
    soap_conductor_nombre:      viajeRow.conductor_nombre       ?? null,
    soap_tipo_operacion_codigo: viajeRow.tipo_operacion_codigo  ?? null,
    soap_tipo_viaje_codigo:     viajeRow.tipo_viaje_codigo      ?? null,
    soap_tipo_carga_codigo:     viajeRow.tipo_carga_codigo      ?? null,
    soap_valor_mercancia:       viajeRow.valor_mercancia        ?? null,
    soap_moneda:                viajeRow.moneda                 ?? null,
    soap_valor_flete:           viajeRow.valor_flete            ?? null,
    soap_peso_total_ton:        viajeRow.peso_total_ton         ?? null,
    soap_volumen_total:         viajeRow.volumen_total          ?? null,
    soap_temperatura_min:       viajeRow.temperatura_min        ?? null,
    soap_temperatura_max:       viajeRow.temperatura_max        ?? null,
    soap_instrucciones:         viajeRow.instrucciones          ?? null,
    soap_paradas:               viajeRow.paradas                ?? null,
    soap_fecha_evento:          toTimestamptz(viajeRow.fecha_evento),
    soap_sincronizado_en:       sincronizadoEn,
  };
}

/**
 * Remap a cumplidos soap_* database row back to ViajeRow shape.
 * Includes soap_sincronizado_en so callers can check cache freshness.
 *
 * @param {object} row — raw cumplidos row from Supabase
 * @param {string} codigoViaje
 * @returns {import('./tripMapper.js').ViajeRow & { soap_sincronizado_en: string|null }}
 */
function fromSoapRow(row, codigoViaje) {
  return {
    codigo_controlt:       codigoViaje,
    estado_viaje:          row.soap_estado_viaje          ?? null,
    conductor_cedula:      row.soap_conductor_cedula       ?? null,
    conductor_nombre:      row.soap_conductor_nombre       ?? null,
    tipo_operacion_codigo: row.soap_tipo_operacion_codigo  ?? null,
    tipo_viaje_codigo:     row.soap_tipo_viaje_codigo      ?? null,
    tipo_carga_codigo:     row.soap_tipo_carga_codigo      ?? null,
    valor_mercancia:       row.soap_valor_mercancia        ?? null,
    moneda:                row.soap_moneda                 ?? null,
    valor_flete:           row.soap_valor_flete            ?? null,
    peso_total_ton:        row.soap_peso_total_ton         ?? null,
    volumen_total:         row.soap_volumen_total          ?? null,
    temperatura_min:       row.soap_temperatura_min        ?? null,
    temperatura_max:       row.soap_temperatura_max        ?? null,
    instrucciones:         row.soap_instrucciones          ?? null,
    paradas:               row.soap_paradas                ?? null,
    fecha_evento:          row.soap_fecha_evento           ?? null,
    // Bonus field (not in ViajeRow typedef) — tripService uses this to
    // determine whether a fresh SOAP call is needed.
    soap_sincronizado_en:  row.soap_sincronizado_en        ?? null,
  };
}

/**
 * Safely convert a string from the SOAP response to an ISO 8601 timestamp.
 * Returns null instead of throwing on unparseable values.
 *
 * @param {string|null} value
 * @returns {string|null}
 */
function toTimestamptz(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persist SOAP enrichment onto the cumplidos row for this trip.
 *
 * Strategy: PATCH (not upsert) — cumplidos rows are created by syncCumplidos.
 * If no matching row exists, the PATCH is a silent no-op; no error is thrown
 * because the transient state (trip active in SOAP but not yet in cumplidos)
 * resolves on the next syncCumplidos cycle.
 *
 * soap_sincronizado_en is always set to the current time — the caller should
 * not override this field in viajeRow.
 *
 * @param {import('./tripMapper.js').ViajeRow} viajeRow
 * @param {{ sbFetch: Function }} deps
 * @returns {Promise<void>}
 * @throws {MappingError} on unexpected Supabase errors or invalid input
 * @throws {ServiceUnavailableError} on network / timeout failures
 */
export async function upsertViaje(viajeRow, { sbFetch }) {
  // [TRACE-TEMP code_type_operation] Etapa 3 — entrada a upsertViaje().
  // Remover tras localizar la causa raíz (auditoría Fase 6 — 3ª ronda).
  console.log(`[TRACE code_type_operation] Etapa 3 | Objeto: payload enviado a persistenceLayer (viajeRow recibido por upsertViaje) | Valor: ${viajeRow?.tipo_operacion_codigo}`);

  if (!viajeRow || typeof viajeRow !== 'object') {
    throw new MappingError('viajeRow must be a non-null object');
  }
  if (!viajeRow.codigo_controlt) {
    throw new MappingError('viajeRow.codigo_controlt is required');
  }

  const patch = toSoapPatch(viajeRow, new Date().toISOString());

  // [TRACE-TEMP code_type_operation] Etapa 4 — payload REAL que se envía a
  // Supabase. Remover tras localizar la causa raíz.
  console.log(`[TRACE code_type_operation] Etapa 4 | Objeto: payload SQL/Supabase (patch.soap_tipo_operacion_codigo) | Valor: ${patch.soap_tipo_operacion_codigo}`);

  const filterPath = `${PATH}?id=eq.${encodeURIComponent(viajeRow.codigo_controlt)}`;

  let result;
  try {
    result = await sbFetch(filterPath, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer':       'return=minimal',
      },
      body: JSON.stringify(patch),
    });
  } catch (err) {
    throw new ServiceUnavailableError(
      `cumplidos soap patch — network error: ${err.message}`
    );
  }

  if (result?.error) {
    const { code, message, details } = result.error;
    // 23514 = check constraint (soap_estado_viaje out of range)
    // 23502 = not-null violation
    if (code === '23514' || code === '23502') {
      throw new MappingError(
        `cumplidos constraint violation [${code}]: ${message}${details ? ' — ' + details : ''}`
      );
    }
    throw new MappingError(
      `cumplidos patch error [${code ?? result.status}]: ${message ?? 'unknown'}`
    );
  }
}

/**
 * Fetch SOAP-enriched data for a trip from cumplidos.
 *
 * Returns null in two cases:
 *   1. No cumplidos row exists for this trip.
 *   2. The row exists but soap_sincronizado_en IS NULL (never SOAP-enriched).
 *
 * This lets tripService treat both cases identically:
 *   "no cache → call the SOAP and then upsertViaje."
 *
 * @param {string} codigoViaje
 * @param {{ sbFetch: Function }} deps
 * @returns {Promise<(import('./tripMapper.js').ViajeRow & { soap_sincronizado_en: string|null })|null>}
 */
export async function fetchViaje(codigoViaje, { sbFetch }) {
  if (!codigoViaje) throw new MappingError('codigoViaje is required');

  const queryPath =
    `${PATH}?id=eq.${encodeURIComponent(codigoViaje)}&select=${SOAP_SELECT}&limit=1`;

  let result;
  try {
    result = await sbFetch(queryPath, { method: 'GET', headers: { Accept: 'application/json' } });
  } catch (err) {
    throw new ServiceUnavailableError(
      `cumplidos soap fetch — network error: ${err.message}`
    );
  }

  if (result?.error) {
    throw new MappingError(
      `cumplidos fetch error [${result.error.code}]: ${result.error.message}`
    );
  }

  const rows = result?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0];
  // Row exists but was never SOAP-enriched — treat as cache miss.
  if (row.soap_sincronizado_en == null) return null;

  const mapped = fromSoapRow(row, codigoViaje);

  // [TRACE-TEMP code_type_operation] Etapa 5 — resultado de fetchViaje(),
  // más la fila cruda de Supabase y soap_sincronizado_en (clave para
  // descartar/confirmar una fila cacheada obsoleta). Remover tras localizar
  // la causa raíz (auditoría Fase 6 — 3ª ronda).
  console.log(
    `[TRACE code_type_operation] Etapa 5 | Objeto: resultado fetchViaje() (mapped.tipo_operacion_codigo) | Valor: ${mapped.tipo_operacion_codigo}` +
    ` | row.soap_tipo_operacion_codigo (Supabase crudo): ${row.soap_tipo_operacion_codigo}` +
    ` | soap_sincronizado_en: ${row.soap_sincronizado_en}`
  );

  return mapped;
}
