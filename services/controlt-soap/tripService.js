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
 * ── PROTECCIÓN FRENTE A RESPUESTAS VACÍAS INTERMITENTES ──────────────────────
 *
 * ControlT exhibe dos comportamientos problemáticos cuando el token expira:
 *
 *   SOAP Fault con texto de auth (Escenario C — comportamiento ya existente):
 *     soapGateway lo detecta, invalida el token y lanza SoapFaultError.
 *     tripService lo captura, reintenta una sola vez con token fresco.
 *     → Resuelto desde la versión anterior.
 *
 *   HTTP 200 success=true con 0 paradas (Escenario A — nuevo):
 *     No hay Fault que detectar. El token expirado simplemente devuelve
 *     datos vacíos en lugar de un error explícito. tripService detecta el
 *     resultado vacío, invalida el token y reintenta una sola vez.
 *     Si el reintento también falla, aplica Escenario B.
 *
 *   Respuesta confirmada vacía con caché previo válido (Escenario B — nuevo):
 *     Después de un reintento con token fresco, si la respuesta sigue siendo
 *     empty pero existe un caché previo con paradas válidas, se conserva
 *     el último dato bueno conocido y se omite el upsert para no sobreescribir.
 *     Señal de inestabilidad transitoria de ControlT — el caché protege al
 *     consumidor mientras el problema se resuelve en el lado del servidor.
 *
 * En ningún escenario se generan ciclos: el máximo de llamadas SOAP por
 * invocación de getTripDetail es:
 *   - Camino feliz:                                   1 SOAP
 *   - Escenario C (SOAP Fault de auth):              2 SOAP (1 login nuevo)
 *   - Escenario A (vacío con token expirado):        2 SOAP (1 login nuevo)
 *   - Escenario A + Escenario B (doble vacío):       2 SOAP + devuelve caché
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
 * Si el SOAP falla sin caché previo válido, se propaga el error al consumidor.
 * Si el SOAP falla pero existe caché previo con paradas válidas, se devuelve
 * el caché (Escenario B) — el consumidor recibe datos aunque sean algo viejos.
 * Si la persistencia (upsert) falla, el error se absorbe: el consumidor
 * recibe igualmente los datos frescos del SOAP.
 */

import { getDetailMonitoringOrder } from './soapGateway.js';
import { mapToViajeRow }            from './tripMapper.js';
import { upsertViaje, fetchViaje }  from './persistenceLayer.js';
import { getConfig }                from './config.js';
import { SoapFaultError }           from './errors.js';
import { invalidate }               from './authManager.js';
import { logTripDetail }            from './auditLogger.js';

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

/** True si el row de caché contiene al menos una parada válida. */
function cachedHasValidParadas(cached) {
  return Array.isArray(cached?.paradas) && cached.paradas.length > 0;
}

/**
 * Cuenta las paradas del resultado crudo de soapGateway, ANTES de aplicar
 * el mapper. Usa los mismos caminos de navegación que normalizeArray() en
 * tripMapper para que el conteo sea consistente con lo que el mapper procesa.
 *
 * @param {object|null} soapResult — resultado directo de getDetailMonitoringOrder()
 * @returns {number}
 */
function _countRawParadas(soapResult) {
  if (!soapResult) return 0;
  const data = soapResult?.data;
  if (!data) return 0;
  const raw = data?.stops?.eMonitoringOrderPointStop ??
              data?.Paradas?.Parada                  ??
              data?.paradas?.Parada                  ??
              data?.Paradas;
  if (raw == null) return 0;
  if (Array.isArray(raw)) return raw.length;
  return 1; // ControlT a veces devuelve un objeto único en lugar de un array
}

/**
 * Intenta extraer el ID de orden de monitoreo del resultado SOAP.
 * Campo no siempre presente — devuelve null si no se encuentra.
 *
 * @param {object|null} soapResult
 * @returns {string|null}
 */
function _extractMonitoreoId(soapResult) {
  if (!soapResult) return null;
  return String(
    soapResult?.id_monitoring_order       ??
    soapResult?.data?.id_monitoring_order ??
    ''
  ) || null;
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
 * Protección frente a respuestas vacías intermitentes:
 *   - Escenario A: SOAP devuelve 0 paradas (token silenciosamente expirado)
 *     → invalida token + reintento con Login fresco (máx. una vez).
 *   - Escenario B: reintento también devuelve vacío + existe caché válido
 *     → devuelve caché previo, omite upsert para no sobreescribir datos buenos.
 *   - Escenario C: SOAP Fault de auth → ya manejado: soapGateway invalida +
 *     tripService reintenta (comportamiento preexistente, sin cambios).
 *
 * Observabilidad: emite un log estructurado [CT:TRIP] al finalizar cada
 * invocación, con origen de datos, estado del token, conteos de paradas en
 * cada etapa y tiempo total. Buscable en Railway por prefijo [CT:TRIP].
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
 * @throws {import('./errors.js').SoapFaultError}     si ControlT responde con Fault no-auth
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

  // ── Tracking para observabilidad ──────────────────────────────────────────
  // Estas variables se actualizan a lo largo de la ejecución y se emiten en
  // el log estructurado [CT:TRIP] al finalizar en cada punto de salida.
  const t0 = now; // mismo instante que se usa para decidir la frescura del caché
  let origenDatos   = 'SOAP';
  let tokenRenovado = false;
  let monitoreoId   = null;
  let nParadasXml   = null; // null = no se realizó llamada SOAP
  let nParadasMapper      = null;
  let nParadasPersistidas = null;

  // ── 1. Verificar caché ────────────────────────────────────────────────────
  const cached = await doFetchViaje(codigoTrimmed, { sbFetch });
  if (cached && !isStale(cached.soap_sincronizado_en, now, resolvedTtl)) {
    logTripDetail({
      codigoViaje:  codigoTrimmed,
      monitoreoId:  null,
      origenDatos:  'CACHE',
      tokenRenovado: false,
      duracionMs:   Date.now() - t0,
      paradas: {
        xml:         null,
        mapper:      null,
        persistidas: null,
        enviadas:    Array.isArray(cached.paradas) ? cached.paradas.length : 0,
      },
    });
    return cached;
  }

  // ── 2. Primera llamada SOAP ───────────────────────────────────────────────
  // Escenario C (preexistente): SOAP Fault con texto de auth → soapGateway ya
  // llamó invalidate(); el reintento dispara un Login fresco automáticamente.
  let soapResult;
  try {
    soapResult = await doSoapGetDetail(codigoTrimmed, resolvedConfig);
  } catch (firstErr) {
    const isAuthFault =
      firstErr instanceof SoapFaultError &&
      AUTH_FAULT_RE.test(firstErr.faultstring);

    if (isAuthFault) {
      // Token ya invalidado por soapGateway — el reintento dispara un nuevo Login.
      tokenRenovado = true;
      origenDatos   = 'RETRY';
      soapResult = await doSoapGetDetail(codigoTrimmed, resolvedConfig);
    } else {
      throw firstErr;
    }
  }

  nParadasXml = _countRawParadas(soapResult);
  monitoreoId = _extractMonitoreoId(soapResult);

  let viajeRow = doMap(soapResult, codigoTrimmed);
  nParadasMapper = viajeRow.paradas.length;

  // ── 2b. Escenario A: paradas vacías → posible token expirado silencioso ───
  //
  // ControlT puede devolver HTTP 200 success=true con 0 paradas cuando el
  // token ha expirado, en lugar de emitir un SOAP Fault explícito. Esta
  // condición no es detectable por soapGateway (no hay Fault). Se detecta
  // aquí comparando el resultado mapeado.
  //
  // Acción: invalidar el token actual y reintentar una sola vez. El siguiente
  // getToken() dentro de doSoapGetDetail ejecutará un Login fresco.
  // Si el reintento también devuelve vacío, se aplica Escenario B.
  if (viajeRow.paradas.length === 0) {
    console.warn(
      `[CT:TRIP] ${codigoTrimmed}: SOAP devolvió 0 paradas — posible ` +
      `token expirado sin Fault. Forzando renovación de token y reintento.`
    );

    tokenRenovado = true;
    origenDatos   = 'RETRY';
    invalidate(); // fuerza nuevo Login en la próxima llamada a getToken()

    let retryRow;
    try {
      const retryResult = await doSoapGetDetail(codigoTrimmed, resolvedConfig);
      nParadasXml = _countRawParadas(retryResult);   // actualizar con datos del reintento
      monitoreoId = _extractMonitoreoId(retryResult) ?? monitoreoId;
      retryRow = doMap(retryResult, codigoTrimmed);
      nParadasMapper = retryRow.paradas.length;
    } catch (retryErr) {
      // El reintento con token fresco también falló.
      // Si existe caché previo con paradas válidas, proteger esos datos.
      if (cachedHasValidParadas(cached)) {
        console.warn(
          `[CT:TRIP] ${codigoTrimmed}: reintento falló (${retryErr.message}). ` +
          `Conservando caché previo con ${cached.paradas.length} parada(s).`
        );
        logTripDetail({
          codigoViaje:  codigoTrimmed,
          monitoreoId,
          origenDatos:  'CACHE_FALLBACK',
          tokenRenovado: true,
          duracionMs:   Date.now() - t0,
          paradas: {
            xml:         nParadasXml,
            mapper:      nParadasMapper,
            persistidas: null,
            enviadas:    cached.paradas.length,
          },
        });
        return cached;
      }
      throw retryErr;
    }

    viajeRow = retryRow;
    // Si retryRow.paradas sigue vacío → cae en Escenario B abajo.
  }

  // ── 2c. Escenario B: protección del caché ante respuesta definitivamente vacía
  //
  // Si después del reintento con token fresco (Escenario A) la respuesta sigue
  // siendo 0 paradas, y existe un caché previo con paradas válidas, se asume
  // inestabilidad transitoria de ControlT. Se devuelve el último dato bueno
  // conocido y se omite el upsert para no sobreescribir información correcta
  // con datos incompletos.
  if (viajeRow.paradas.length === 0 && cachedHasValidParadas(cached)) {
    console.warn(
      `[CT:TRIP] ${codigoTrimmed}: respuesta definitiva sin paradas ` +
      `tras token renovado. Inestabilidad ControlT — conservando caché ` +
      `previo (${cached.paradas.length} parada(s)), upsert omitido.`
    );
    logTripDetail({
      codigoViaje:  codigoTrimmed,
      monitoreoId,
      origenDatos:  'CACHE_FALLBACK',
      tokenRenovado,
      duracionMs:   Date.now() - t0,
      paradas: {
        xml:         nParadasXml,
        mapper:      nParadasMapper,
        persistidas: null,
        enviadas:    cached.paradas.length,
      },
    });
    return cached;
  }

  // ── 3. Persistir en cumplidos (best-effort) ───────────────────────────────
  // Un fallo aquí no interrumpe la respuesta — el consumidor recibe igualmente
  // los datos frescos del SOAP aunque el enriquecimiento no pueda persistirse.
  nParadasPersistidas = viajeRow.paradas.length;
  try {
    await doUpsertViaje(viajeRow, { sbFetch });
  } catch (persistErr) {
    console.error(
      `[tripService] persistencia fallida para ${codigoTrimmed}: ${persistErr.message}`
    );
    nParadasPersistidas = null; // upsert no completado
  }

  // BUG CONFIRMADO (auditoría Fase 6): mapToViajeRow() nunca produce
  // soap_sincronizado_en — ese campo solo lo agrega persistenceLayer al leer
  // de caché (fromSoapRow). Sin esta línea, todo camino SOAP fresco devolvía
  // sincronizado_en: null aunque el enriquecimiento sí ocurrió. Se fija aquí
  // con el mismo `now` ya resuelto arriba (respeta el hook de test `_now`),
  // para que el contrato de salida sea idéntico entre caché y SOAP fresco.
  const resultado = { ...viajeRow, soap_sincronizado_en: new Date(now).toISOString() };

  logTripDetail({
    codigoViaje:  codigoTrimmed,
    monitoreoId,
    origenDatos,
    tokenRenovado,
    duracionMs:   Date.now() - t0,
    paradas: {
      xml:         nParadasXml,
      mapper:      nParadasMapper,
      persistidas: nParadasPersistidas,
      enviadas:    resultado.paradas.length,
    },
  });

  return resultado;
}
