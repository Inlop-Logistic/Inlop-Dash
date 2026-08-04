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

// ── AUDIT INSTRUMENTATION — getTripDetail (temporal, remover tras diagnóstico) ─

const _AUDIT_SEP  = '▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶';
const _AUDIT_SEP2 = '───────────────────────────────────────────────────────';

/** Cuenta paradas de forma segura desde un array (puede ser null/undefined). */
function _countArr(arr) {
  if (!arr) return 0;
  if (Array.isArray(arr)) return arr.length;
  return 1; // objeto único (ControlT a veces no envuelve en array)
}

/**
 * Cuenta las paradas crudas del objeto soapResult ANTES del mapper.
 * Replica el mismo camino de navegación que normalizeArray() en tripMapper.
 */
function _countSoapRaw(soapResult) {
  // soapGateway devuelve el nodo GetDetailMonitoringOrderResult que contiene
  // { success, data: { stops: { eMonitoringOrderPointStop: [...] } } }
  const data = soapResult?.data ?? soapResult?.GetDetailMonitoringOrderResult?.data ?? soapResult;
  const stopsNode = data?.stops;
  if (!stopsNode) return { count: 0, path: 'data.stops ausente' };

  const raw = stopsNode.eMonitoringOrderPointStop ??
              stopsNode.Paradas?.Parada          ??
              stopsNode.paradas?.Parada          ??
              stopsNode.Paradas;

  if (raw == null) return { count: 0, path: 'eMonitoringOrderPointStop/Paradas ausente' };
  const count = _countArr(raw);
  return { count, path: 'data.stops.eMonitoringOrderPointStop' };
}

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

  // ── AUDIT ① — entrada ─────────────────────────────────────────────────────
  console.log(`\n${_AUDIT_SEP}`);
  console.log(`[AUDIT getTripDetail] INICIO`);
  console.log(`  [1] Trip Number recibido : "${codigoTrimmed}"`);
  console.log(`  TTL caché configurado    : ${resolvedTtl / 1000}s`);
  console.log(_AUDIT_SEP2);

  // ── 1. Verificar caché ────────────────────────────────────────────────────
  const cached = await doFetchViaje(codigoTrimmed, { sbFetch });

  // ── AUDIT ② — estado del caché ────────────────────────────────────────────
  if (!cached) {
    console.log(`  [2] Caché               : NO existe registro en cumplidos`);
    console.log(`  [3] soap_sincronizado_en: null`);
    console.log(`  [4] Edad del caché      : N/A`);
    console.log(`  [5] Decisión            : CONSULTAR SOAP (sin caché previo)`);
  } else {
    const sincEn    = cached.soap_sincronizado_en;
    const edadMs    = sincEn ? now - new Date(sincEn).getTime() : null;
    const edadMin   = edadMs != null ? (edadMs / 60_000).toFixed(2) : 'N/A';
    const stale     = isStale(sincEn, now, resolvedTtl);
    const nParadasCache = _countArr(cached.paradas);

    console.log(`  [2] Caché               : EXISTE registro en cumplidos`);
    console.log(`  [3] soap_sincronizado_en: ${sincEn ?? 'null'}`);
    console.log(`  [4] Edad del caché      : ${edadMin} min (TTL = ${resolvedTtl / 60_000} min)`);
    console.log(`  [7] Paradas en caché    : ${nParadasCache}`);

    if (!stale) {
      console.log(`  [5] Decisión            : USAR CACHÉ (edad < TTL → fresco)`);
      console.log(`      Motivo              : soap_sincronizado_en dentro del TTL`);
      if (nParadasCache === 0) {
        console.log(`  ⚠️  [8] PARADAS VACÍAS   : la caché contiene 0 paradas.`);
        console.log(`         Las paradas desaparecieron cuando se persistió este registro.`);
        console.log(`         Verificar el upsert previo — ControlT pudo haber devuelto`);
        console.log(`         0 paradas en esa llamada, o la persistencia las descartó.`);
        console.log(`         Limpiar la fila en cumplidos para forzar nueva llamada SOAP.`);
      }
      console.log(_AUDIT_SEP);
      return cached;
    }

    console.log(`  [5] Decisión            : CONSULTAR SOAP (caché vencido)`);
    console.log(`      Motivo              : edad ${edadMin} min ≥ TTL ${resolvedTtl / 60_000} min`);
    if (!sincEn) {
      console.log(`      (Nota: soap_sincronizado_en es null → siempre se considera vencido)`);
    }
  }
  console.log(_AUDIT_SEP2);

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
      console.log(`  [AUDIT] Auth fault detectado — reintentando con nuevo token`);
      soapResult = await doSoapGetDetail(codigoTrimmed, resolvedConfig);
    } else {
      console.log(`  [AUDIT] Error SOAP no-auth — propagando: ${firstErr.message}`);
      throw firstErr;
    }
  }

  // ── AUDIT ③ — resultado crudo SOAP (antes del mapper) ────────────────────
  const soapSuccess = soapResult?.success ?? soapResult?.GetDetailMonitoringOrderResult?.success;
  const { count: nParadasRaw, path: rawPath } = _countSoapRaw(soapResult);
  console.log(`  [6a] SOAP success field  : ${soapSuccess === undefined ? '(campo ausente)' : soapSuccess}`);
  console.log(`  [6b] Paradas XML (crudo) : ${nParadasRaw}  (ruta: ${rawPath})`);
  if (nParadasRaw === 0) {
    console.log(`  ⚠️  SOAP devolvió 0 paradas — verificar:`);
    console.log(`      - ¿El trip number "${codigoTrimmed}" es correcto para ControlT?`);
    console.log(`      - ¿El token era válido? (soapGateway ya logueó la respuesta XML completa)`);
    console.log(`      - ¿ControlT devolvió success=false sin SOAP Fault?`);
  }

  const viajeRow = doMap(soapResult, codigoTrimmed);

  // ── AUDIT ④ — después del mapper ─────────────────────────────────────────
  const nParadasMapper = _countArr(viajeRow.paradas);
  console.log(`  [6c] Paradas post-mapper : ${nParadasMapper}`);
  if (nParadasRaw > 0 && nParadasMapper === 0) {
    console.log(`  ⚠️  [8] PARADAS VACÍAS   : el mapper recibió ${nParadasRaw} paradas del SOAP`);
    console.log(`         pero mapToViajeRow() devolvió 0.`);
    console.log(`         Las paradas DESAPARECIERON dentro del mapper.`);
    console.log(`         Revisar tripMapper.js → normalizeArray() → mapParada()`);
    console.log(`         y la ruta de navegación real del XML en este ambiente.`);
  }

  // ── 3. Persistir en cumplidos (best-effort) ───────────────────────────────
  // Un fallo aquí no interrumpe la respuesta — el consumidor recibe los datos
  // frescos del SOAP aunque el enriquecimiento no pueda persistirse.
  const nParadasPrePersist = _countArr(viajeRow.paradas);
  console.log(`  [6d] Paradas pre-persist : ${nParadasPrePersist}`);

  try {
    await doUpsertViaje(viajeRow, { sbFetch });
    console.log(`  [AUDIT] Persistencia OK  : ${nParadasPrePersist} paradas guardadas en cumplidos`);
  } catch (persistErr) {
    console.error(
      `[tripService] persistencia fallida para ${codigoTrimmed}: ${persistErr.message}`
    );
    console.log(`  ⚠️  Persistencia FALLÓ   : los datos SOAP no quedarán en caché`);
  }

  // BUG CONFIRMADO (auditoría Fase 6): mapToViajeRow() nunca produce
  // soap_sincronizado_en — ese campo solo lo agrega persistenceLayer al leer
  // de caché (fromSoapRow). Sin esta línea, todo camino SOAP fresco devolvía
  // sincronizado_en: null aunque el enriquecimiento sí ocurrió. Se fija aquí
  // con el mismo `now` ya resuelto arriba (respeta el hook de test `_now`),
  // para que el contrato de salida sea idéntico entre caché y SOAP fresco.
  const resultado = { ...viajeRow, soap_sincronizado_en: new Date(now).toISOString() };

  // ── AUDIT ⑤ — resultado final ─────────────────────────────────────────────
  const nParadasFinal = _countArr(resultado.paradas);
  console.log(`  [AUDIT] Paradas devueltas: ${nParadasFinal}`);
  if (nParadasFinal === 0 && nParadasRaw > 0) {
    console.log(`  🔴 [8] CAUSA RAÍZ        : ControlT devolvió ${nParadasRaw} paradas`);
    console.log(`         pero la respuesta final contiene 0.`);
    console.log(`         El punto exacto de pérdida está entre [6b] y [6c] → mapper.`);
  } else if (nParadasFinal === 0) {
    console.log(`  🔴 [8] El SOAP también devolvió 0 paradas — problema en ControlT o en`);
    console.log(`         el parámetro enviado (trip number, token, code_company).`);
  }
  console.log(`[AUDIT getTripDetail] FIN — ${codigoTrimmed}`);
  console.log(_AUDIT_SEP);

  return resultado;
}
