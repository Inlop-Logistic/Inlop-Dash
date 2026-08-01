/**
 * PersistenceLayer — persists a ViajeRow into controlt_viajes via Supabase.
 *
 * Design rules:
 *   - Receives an sbFetch dependency (injected) so it can be unit-tested
 *     without a real Supabase connection.
 *   - Single public function: upsertViaje(viajeRow, { sbFetch })
 *   - Strategy: upsert on codigo_controlt (merge-update, not replace-all).
 *     sincronizado_en is always set to now() on every write.
 *   - Throws ServiceUnavailableError on network/timeout failures.
 *   - Throws MappingError if the upsert returns an unexpected error code.
 *
 * sbFetch contract (same as the one used by tripService / other modules):
 *   sbFetch(path, options) → Promise<{ data, error, status }>
 *   where path is a Supabase REST path (e.g. '/rest/v1/controlt_viajes')
 *   and options follows the fetch init shape.
 */

import { MappingError, ServiceUnavailableError } from './errors.js';

const TABLE = 'controlt_viajes';
const PATH  = `/rest/v1/${TABLE}`;

/**
 * Upsert a ViajeRow into controlt_viajes.
 *
 * Sets `sincronizado_en` to the current time regardless of what the row
 * contains — the caller should not override this field.
 *
 * @param {import('./tripMapper.js').ViajeRow} viajeRow
 * @param {{ sbFetch: Function }} deps
 * @returns {Promise<void>}
 * @throws {MappingError} on unexpected Supabase errors
 * @throws {ServiceUnavailableError} on network / timeout failures
 */
export async function upsertViaje(viajeRow, { sbFetch }) {
  if (!viajeRow || typeof viajeRow !== 'object') {
    throw new MappingError('viajeRow must be a non-null object');
  }
  if (!viajeRow.codigo_controlt) {
    throw new MappingError('viajeRow.codigo_controlt is required');
  }

  const row = {
    ...viajeRow,
    sincronizado_en: new Date().toISOString(),
  };

  let result;
  try {
    result = await sbFetch(PATH, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    });
  } catch (err) {
    throw new ServiceUnavailableError(
      `controlt_viajes upsert — network error: ${err.message}`
    );
  }

  if (result?.error) {
    const { code, message, details } = result.error;
    // 23514 = check constraint violation (estado_viaje out of range)
    // 23502 = not-null violation
    if (code === '23514' || code === '23502') {
      throw new MappingError(
        `controlt_viajes constraint violation [${code}]: ${message}${details ? ' — ' + details : ''}`
      );
    }
    throw new MappingError(
      `controlt_viajes upsert error [${code ?? result.status}]: ${message ?? 'unknown'}`
    );
  }
}

/**
 * Fetch a single ViajeRow by codigo_controlt.
 * Returns null when the row does not exist.
 *
 * @param {string} codigoViaje
 * @param {{ sbFetch: Function }} deps
 * @returns {Promise<import('./tripMapper.js').ViajeRow|null>}
 */
export async function fetchViaje(codigoViaje, { sbFetch }) {
  if (!codigoViaje) throw new MappingError('codigoViaje is required');

  let result;
  try {
    result = await sbFetch(
      `${PATH}?codigo_controlt=eq.${encodeURIComponent(codigoViaje)}&limit=1`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    );
  } catch (err) {
    throw new ServiceUnavailableError(
      `controlt_viajes fetch — network error: ${err.message}`
    );
  }

  if (result?.error) {
    throw new MappingError(
      `controlt_viajes fetch error [${result.error.code}]: ${result.error.message}`
    );
  }

  const rows = result?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}
