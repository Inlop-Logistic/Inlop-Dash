/**
 * TripService — única autoridad para datos de ControlT.
 *
 * Responsabilidades:
 *   1. Verificar la caché persistida en cumplidos (soap_sincronizado_en).
 *   2. Decidir si el caché sigue vigente o si debe consultar el SOAP.
 *   3. Si el caché es fresco → devolver sin llamar a ControlT.
 *   4. Si el caché está vencido o es null → GetDetailMonitoringOrder → mapear
 *      → persistir en cumplidos (best-effort) → devolver al consumidor.
 *   5. Reintentar una vez en caso de fallo de autenticación (el token ya fue
 *      invalidado por soapGateway, el reintento dispara un nuevo Login).
 *
 * Ningún otro componente del backend (controladores, endpoints, otros módulos)
 * debe importar soapGateway, authManager, ni llamar al Login o al
 * GetDetailMonitoringOrder directamente.
 *
 * ── DI CONTRACT ──────────────────────────────────────────────────────────────
 * getTripDetail recibe { sbFetch } como dependencia principal.
 * sbFetch debe seguir el contrato de persistenceLayer:
 *   sbFetch(path, { method, headers, body }) → Promise<{ data, error, status }>
 *
 * Para construir ese adaptador desde el sbFetch global de index.js (que tiene
 * firma diferente), usar makeSbFetchAdapter(baseUrl, key) exportado aquí.
 *
 * ── POLÍTICA DE CACHÉ ────────────────────────────────────────────────────────
 * TTL por defecto: 5 minutos. Configurable con CONTROLT_SOAP_CACHE_TTL_MS.
 * Frescura: comparar (now - soap_sincronizado_en) con el TTL.
 * Nulo: fetchViaje devuelve null cuando la fila no existe O cuando
 *       soap_sincronizado_en IS NULL (nunca enriquecida por SOAP) — ambos
 *       casos son tratados como caché ausente.
 *
 * ── POLÍTICA DE ERROR ────────────────────────────────────────────────────────
 * Si el SOAP falla, se propaga el error al consumidor (no hay fallback a
 * caché vencida en esta fase). El consumidor decide cómo responder.
 * Si la persistencia (upsert) falla, el error se absorbe: el consumidor
 * recibe igualmente los datos frescos del SOAP.
 */

import { getDetailMonitoringOrder } from './soapGateway.js';
import { mapToViajeRow }            from './tripMapper.js';
import { upsertViaje, fetchViaje }  from './persistenceLayer.js';
import { getConfig }                from './config.js';
import { SoapFaultError }           from './errors.js';

// TTL por defecto: 5 minutos
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000;

// Patrón de falla de autenticación que soapGateway detecta y que justifica
// un reintento (el token ya fue invalidado por getDetailMonitoringOrder).
const AUTH_FAULT_RE = /token|session|authen|autoriza/i;

// ── Helpers internos ──────────────────────────────────────────────────────────

function resolveCacheTtl() {
  const raw = process.env.CONTROLT_SOAP_CACHE_TTL_MS;
  if (!raw) return DEFAULT_CACHE_TTL_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CACHE_TTL_MS;
}

function isStale(sincronizadoEn, now, cacheTtlMs) {
  if (!sincronizadoEn) return true;
  return (now - new Date(sincronizadoEn).getTime()) > cacheTtlMs;
}

// ── Exported adapter factory ──────────────────────────────────────────────────

/**
 * Construye un sbFetch compatible con el contrato de persistenceLayer a partir
 * de los parámetros de conexión a Supabase.
 *
 * Uso desde index.js / route handlers:
 *   const sbFetch = makeSbFetchAdapter(SB_URL, SB_KEY);
 *   await getTripDetail('IN018108', { sbFetch });
 *
 * Las cabeceras del llamador (e.g. "Prefer: return=minimal" de persistenceLayer)
 * se superponen sobre las cabeceras base (apikey, Authorization).
 *
 * @param {string} baseUrl   — URL base de Supabase REST (sin barra final)
 * @param {string} key       — apikey / Bearer token (service key preferida)
 * @param {Function} [_fetch] — inyección de fetch; solo para tests
 * @returns {(path: string, opts?: object) => Promise<{data, error, status}>}
 */
export function makeSbFetchAdapter(baseUrl, key, _fetch = fetch) {
  return async function sbFetchAdapter(path, opts = {}) {
    const { method = 'GET', headers: callerHeaders = {}, body } = opts;

    const headers = {
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      ...callerHeaders,
    };

    const fetchOpts = { method, headers };
    if (body != null) fetchOpts.body = body;

    let response;
    try {
      response = await _fetch(`${baseUrl}${path}`, fetchOpts);
    } catch (err) {
      throw err; // network error — persistenceLayer wraps as ServiceUnavailableError
    }

    const text = await response.text();

    if (!response.ok) {
      let error = { code: String(response.status), message: response.statusText };
      try {
        const parsed = JSON.parse(text);
        if (parsed.code || parsed.message) error = parsed;
      } catch { /* non-JSON error body */ }
      return { data: null, error, status: response.status };
    }

    const data = text ? JSON.parse(text) : null;
    return { data, error: null, status: response.status };
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Obtiene el detalle completo de un viaje ControlT.
 *
 * Es la ÚNICA función autorizada para comunicarse con ControlT.
 * Ningún endpoint, controlador ni módulo externo debe llamar directamente a
 * soapGateway, authManager, ni a Login / GetDetailMonitoringOrder.
 *
 * @param {string} codigoViaje  — código de viaje ControlT (ej. "IN018108")
 * @param {object} deps
 * @param {Function} deps.sbFetch     — Supabase adapter (contrato persistenceLayer)
 * @param {object}  [deps.config]     — config SOAP; por defecto getConfig()
 * @param {number}  [deps.cacheTtlMs] — TTL en ms; por defecto env o 300 000
 *
 * Hooks de test — no deben usarse en código de producción:
 * @param {Function} [deps._fetchViaje]    — sustituye persistenceLayer.fetchViaje
 * @param {Function} [deps._upsertViaje]   — sustituye persistenceLayer.upsertViaje
 * @param {Function} [deps._soapGetDetail] — sustituye soapGateway.getDetailMonitoringOrder
 * @param {Function} [deps._mapper]        — sustituye tripMapper.mapToViajeRow
 * @param {Function} [deps._now]           — sustituye Date.now() (control de tiempo en tests)
 *
 * @returns {Promise<import('./tripMapper.js').ViajeRow & { soap_sincronizado_en?: string }>}
 * @throws {TypeError} si codigoViaje es vacío o solo espacios
 * @throws {import('./errors.js').SoapFaultError}     si ControlT responde con Fault
 * @throws {import('./errors.js').AuthError}          si el Login falla tras el reintento
 * @throws {import('./errors.js').NetworkError}       si hay error de red con ControlT
 * @throws {import('./errors.js').TimeoutError}       si la llamada SOAP supera el timeout
 * @throws {import('./errors.js').ViajeNotFoundError} si el viaje no existe en ControlT
 * @throws {import('./errors.js').MappingError}       si el XML no puede mapearse
 */
export async function getTripDetail(codigoViaje, {
  sbFetch,
  config         = null,
  cacheTtlMs     = null,
  _fetchViaje    = null,
  _upsertViaje   = null,
  _soapGetDetail = null,
  _mapper        = null,
  _now           = null,
} = {}) {
  const codigoTrimmed = typeof codigoViaje === 'string' ? codigoViaje.trim() : '';
  if (!codigoTrimmed) {
    throw new TypeError('codigoViaje is required and must be a non-empty string');
  }

  const resolvedConfig = config  ?? getConfig();
  const resolvedTtl    = cacheTtlMs ?? resolveCacheTtl();
  const now            = _now ? _now() : Date.now();

  // Resolve injectable implementations (production vs test hooks)
  const doFetchViaje    = _fetchViaje    ?? ((c, d) => fetchViaje(c, d));
  const doUpsertViaje   = _upsertViaje   ?? ((r, d) => upsertViaje(r, d));
  const doSoapGetDetail = _soapGetDetail ?? getDetailMonitoringOrder;
  const doMap           = _mapper        ?? mapToViajeRow;

  // ── 1. Verificar caché ────────────────────────────────────────────────────
  const cached = await doFetchViaje(codigoTrimmed, { sbFetch });
  if (cached && !isStale(cached.soap_sincronizado_en, now, resolvedTtl)) {
    // [FASE6-AUDIT-TEMP] Etapa 6 (camino cache-hit) — objeto final devuelto sin
    // llamar SOAP. Remover tras confirmar causa raíz (auditoría Fase 6).
    console.log('[FASE6-AUDIT-TEMP] Etapa6_cache_hit_sin_SOAP', codigoTrimmed, JSON.stringify(cached));
    return cached;
  }

  // ── 2. Llamada SOAP con reintento en fallo de autenticación ───────────────
  let soapResult;
  try {
    soapResult = await doSoapGetDetail(codigoTrimmed, resolvedConfig);
  } catch (firstErr) {
    const isAuthFault =
      firstErr instanceof SoapFaultError &&
      AUTH_FAULT_RE.test(firstErr.faultstring);

    if (isAuthFault) {
      // Token ya invalidado por soapGateway — el reintento dispara un nuevo Login.
      soapResult = await doSoapGetDetail(codigoTrimmed, resolvedConfig);
    } else {
      throw firstErr;
    }
  }

  const viajeRow = doMap(soapResult, codigoTrimmed);

  // ── 3. Persistir en cumplidos (best-effort) ───────────────────────────────
  // Un fallo aquí no interrumpe la respuesta — el consumidor recibe los datos
  // frescos del SOAP aunque el enriquecimiento no pueda persistirse.
  try {
    await doUpsertViaje(viajeRow, { sbFetch });
  } catch (persistErr) {
    console.error(
      `[tripService] persistencia fallida para ${codigoTrimmed}: ${persistErr.message}`
    );
  }

  // [FASE6-AUDIT-TEMP] Etapa 6 — objeto final que tripService devuelve al
  // endpoint (camino SOAP fresco). Remover tras confirmar causa raíz (auditoría Fase 6).
  console.log('[FASE6-AUDIT-TEMP] Etapa6_viajeRow_final_a_endpoint', codigoTrimmed, JSON.stringify(viajeRow));

  return viajeRow;
}
