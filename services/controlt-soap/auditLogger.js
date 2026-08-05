/**
 * Audit logger for ControlT SOAP operations.
 *
 * Wraps Pino with two guarantees:
 *   1. Sensitive fields (SOAP password, active tokens) are filtered before any log entry.
 *   2. Full SOAP payloads are only emitted at DEBUG level in non-production environments.
 *
 * Import the singleton `auditLogger` — do not instantiate directly.
 */

import pino from 'pino';

// ── Sensitive field filter ────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'pass', 'password', 'senha', 'contrasena',
  'token', 'authToken', 'authenticationToken',
  'Authorization', 'authorization',
  'CONTROLT_SOAP_PASS',
]);

/**
 * Recursively redact sensitive keys from a plain-object tree.
 * Returns a new object (shallow clone at each level); does not mutate input.
 *
 * @param {unknown} obj
 * @returns {unknown}
 */
export function redactSensitive(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : redactSensitive(v);
  }
  return out;
}

// ── Logger factory ────────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';

const _pinoInstance = pino({
  name: 'controlt-soap',
  level: isProduction ? 'info' : 'debug',
  base: { service: 'controlt-soap' },
  // Redact at the pino level as a safety net (belt-and-suspenders).
  redact: {
    paths: [
      'pass', 'password', 'token', 'authToken',
      'authenticationToken', 'Authorization', 'authorization',
      '*.pass', '*.password', '*.token', '*.authToken',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Log a completed ControlT SOAP operation (success or failure).
 *
 * @param {object} params
 * @param {'Login'|'GetDetailMonitoringOrder'} params.operacion
 * @param {string|null}  params.codigoViaje   — null for Login calls
 * @param {number}       params.duracionMs
 * @param {boolean}      params.ok            — true = success, false = error
 * @param {string|null}  [params.errorTipo]   — error.code or error.constructor.name
 * @param {string|null}  [params.errorMsg]    — error.message (no credentials inside)
 */
export function logOperacion({ operacion, codigoViaje, duracionMs, ok, errorTipo = null, errorMsg = null }) {
  const entry = {
    operacion,
    codigoViaje,
    duracionMs,
    ok,
    ...(errorTipo && { errorTipo }),
    ...(errorMsg  && { errorMsg }),
  };
  if (ok) {
    _pinoInstance.info(entry, `ControlT ${operacion} OK`);
  } else {
    _pinoInstance.warn(entry, `ControlT ${operacion} FAILED`);
  }
}

/**
 * Log the raw SOAP payload — DEBUG only, non-production only.
 * Safe to call unconditionally; suppressed automatically in production.
 *
 * @param {string} operacion
 * @param {'request'|'response'} direction
 * @param {string} xml
 */
export function logSoapPayload(operacion, direction, xml) {
  if (isProduction) return;
  _pinoInstance.debug({ operacion, direction, xml }, `SOAP payload [${direction}]`);
}

/**
 * Log an authentication lifecycle event (token acquired, renewed, invalidated).
 *
 * @param {'acquired'|'renewed'|'invalidated'} evento
 * @param {number} [duracionMs]
 */
export function logAuthEvent(evento, duracionMs) {
  const entry = { evento, ...(duracionMs != null && { duracionMs }) };
  _pinoInstance.info(entry, `Auth token ${evento}`);
}

/**
 * Log an unhandled error at the module boundary.
 *
 * @param {Error} err
 * @param {object} [context]
 */
export function logError(err, context = {}) {
  _pinoInstance.error({ err, ...redactSensitive(context) }, err.message);
}

/**
 * Log a complete getTripDetail() execution summary.
 *
 * Prefix [CT:TRIP] in the message allows easy filtering in Railway log search.
 * All tracking fields are also emitted as structured JSON for query tools.
 *
 * @param {object} p
 * @param {string}           p.codigoViaje   — trip code sent to ControlT (e.g. "IN018175")
 * @param {string|null}      p.monitoreoId   — ControlT internal monitoring order ID, or null
 * @param {'CACHE'|'SOAP'|'RETRY'|'CACHE_FALLBACK'} p.origenDatos
 *   CACHE         → served from fresh cumplidos cache, no SOAP call
 *   SOAP          → served from a single successful SOAP call
 *   RETRY         → served from a retry call (auth fault or empty paradas on first call)
 *   CACHE_FALLBACK → SOAP returned empty after retry; returned previous valid cache
 * @param {boolean}          p.tokenRenovado — true if a fresh Login was triggered this call
 * @param {number}           p.duracionMs    — total wall time from entry to exit
 * @param {object}           p.paradas
 * @param {number|null}      p.paradas.xml         — count in raw SOAP XML (null if no SOAP call)
 * @param {number|null}      p.paradas.mapper      — count after mapToViajeRow (null if no SOAP call)
 * @param {number|null}      p.paradas.persistidas — count passed to upsert (null if skipped)
 * @param {number}           p.paradas.enviadas    — count in the final response to the caller
 */
export function logTripDetail({ codigoViaje, monitoreoId, origenDatos, tokenRenovado, duracionMs, paradas }) {
  const tokenTag = tokenRenovado ? 'token:RENOVADO' : 'token:REUTILIZADO';
  const msg = `[CT:TRIP] ${codigoViaje} | ${origenDatos} | ${tokenTag} | ${paradas.enviadas}p | ${duracionMs}ms`;
  _pinoInstance.info(
    {
      codigoViaje,
      monitoreoId: monitoreoId ?? null,
      origenDatos,
      tokenRenovado,
      duracionMs,
      paradas: {
        xml:         paradas.xml         ?? null,
        mapper:      paradas.mapper      ?? null,
        persistidas: paradas.persistidas ?? null,
        enviadas:    paradas.enviadas,
      },
    },
    msg
  );
}

// Export pino instance for advanced use (e.g., child loggers in tests).
export const _logger = _pinoInstance;
