/**
 * SOAP gateway for ControlT — the only module that knows ControlT exists.
 *
 * Responsibilities:
 *   - Build SOAP 1.1 envelopes for Login and GetDetailMonitoringOrder.
 *   - Send HTTP POST with AbortController timeout.
 *   - Parse XML response with fast-xml-parser.
 *   - Detect and unwrap SOAP Fault envelopes → SoapFaultError.
 *   - Apply fixMojibake to all string values in the parsed result.
 *   - Coordinate with authManager (getToken / invalidate) for token lifecycle.
 *   - Emit audit log entries via auditLogger.
 *
 * The public surface is:
 *   - login(config)                           → Promise<string>  (raw UUID)
 *   - getDetailMonitoringOrder(codigoViaje)   → Promise<object>  (raw SOAP result)
 *
 * Neither function retries on its own — retry / fallback decisions belong to
 * the callers (tripService, Phase 3+).
 */

import { XMLParser } from 'fast-xml-parser';
import { fixMojibake } from '../../utils/mojibake.js';
import { getToken, invalidate } from './authManager.js';
import { logOperacion, logSoapPayload, logError } from './auditLogger.js';
import {
  AuthError,
  SoapFaultError,
  NetworkError,
  TimeoutError,
  ViajeNotFoundError,
} from './errors.js';

// ── XML parser (shared instance) ──────────────────────────────────────────────

const _xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,          // drop "soap:" / "diffgr:" etc.
  parseTagValue: true,
  trimValues: true,
});

// ── Timeout fetch (mirrors fetchConTimeout in index.js) ───────────────────────

/**
 * fetch() with AbortController timeout.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── SOAP envelope builders ────────────────────────────────────────────────────

/**
 * @param {string} user
 * @param {string} pass
 * @returns {string}
 */
function buildLoginEnvelope(user, pass) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="http://controlt.com.co/">
   <soapenv:Header/>
   <soapenv:Body>
      <con:Login>
         <con:username>${escapeXml(user)}</con:username>
         <con:password>${escapeXml(pass)}</con:password>
      </con:Login>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// Company code required by ControlT for all GetDetailMonitoringOrder calls.
const CODE_COMPANY = '57INLOP';

/**
 * @param {string} token
 * @param {string} user
 * @param {string} pass
 * @param {string} codigoViaje
 * @returns {string}
 */

function buildGetDetailEnvelope(token, user, pass, codigoViaje) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="http://controlt.com.co/">
   <soapenv:Header>
      <con:SecuredToken>
         <con:UserName>${escapeXml(user)}</con:UserName>
         <con:Password>${escapeXml(pass)}</con:Password>
         <con:AuthenticationToken>${escapeXml(token)}</con:AuthenticationToken>
      </con:SecuredToken>
   </soapenv:Header>
   <soapenv:Body>
      <con:GetDetailMonitoringOrder>
         <con:code_company>${CODE_COMPANY}</con:code_company>
         <con:number_travel_main>${escapeXml(codigoViaje)}</con:number_travel_main>
      </con:GetDetailMonitoringOrder>
   </soapenv:Body>
</soapenv:Envelope>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── AUDIT INSTRUMENTATION (temporary — remove after Fase 2 validation) ───────

const _SEP = '=========================================================';

/**
 * Redact <password> and <AuthenticationToken> values from XML strings.
 * Any namespace prefix is handled (e.g. ns:password, soap:password).
 * Only these two fields are redacted — nothing else.
 */
function _redactXml(xml) {
  return xml
    .replace(/(<(?:[\w]+:)?password>)[^<]*/gi,              '$1[REDACTED]')
    .replace(/(<(?:[\w]+:)?AuthenticationToken>)[^<]*/gi,   '$1[REDACTED]');
}

function _logReqAudit(label, endpoint, headers, body) {
  console.log(`\n${_SEP}`);
  console.log(`${label} REQUEST`);
  console.log(_SEP);
  console.log(`URL: ${endpoint}`);
  console.log(`Método HTTP: POST`);
  console.log(`Headers HTTP completos (explícitos — fetch puede agregar Content-Length, Host, Accept-Encoding):`);
  for (const [k, v] of Object.entries(headers)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`SOAPAction: ${headers['SOAPAction']}`);
  console.log(`Content-Type: ${headers['Content-Type']}`);
  console.log(`Body XML (${Buffer.byteLength(body, 'utf8')} bytes UTF-8):`);
  console.log(_redactXml(body));
  console.log(_SEP);
}

function _logResAudit(label, response, xml) {
  const resHeaders = {};
  response.headers.forEach((v, k) => { resHeaders[k] = v; });

  console.log(`\n${_SEP}`);
  console.log(`${label} RESPONSE`);
  console.log(_SEP);
  console.log(`Status HTTP: ${response.status} ${response.statusText}`);
  console.log(`Headers HTTP completos:`);
  for (const [k, v] of Object.entries(resHeaders)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`Body XML (${Buffer.byteLength(xml, 'utf8')} bytes UTF-8):`);
  console.log(_redactXml(xml));
  console.log(_SEP);
}

function _logNetErrAudit(label, err) {
  console.log(`\n${_SEP}`);
  console.log(`${label} RESPONSE — ERROR DE RED`);
  console.log(_SEP);
  console.log(`Error: ${err.name}: ${err.message}`);
  console.log(_SEP);
}

// ── HTTP send ─────────────────────────────────────────────────────────────────

/**
 * Send a SOAP 1.1 POST and return the raw XML response string.
 * Maps fetch/abort errors to typed module errors.
 *
 * @param {string} endpoint
 * @param {string} soapAction
 * @param {string} body
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
async function sendSoap(endpoint, soapAction, body, timeoutMs) {
  const label = soapAction === 'Login' ? 'LOGIN' : 'GETDETAIL';
  const requestHeaders = {
    'Content-Type': 'text/xml; charset=utf-8',
    SOAPAction: `"http://controlt.com.co/${soapAction}"`,
  };

  _logReqAudit(label, endpoint, requestHeaders, body);

  let response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      { method: 'POST', headers: requestHeaders, body },
      timeoutMs
    );
  } catch (err) {
    _logNetErrAudit(label, err);
    if (err.name === 'AbortError') {
      throw new TimeoutError(timeoutMs);
    }
    throw new NetworkError(err.message);
  }

  const xml = await response.text();
  _logResAudit(label, response, xml);
  return xml;
}

// ── XML parsing & fault detection ────────────────────────────────────────────

/**
 * Parse XML and throw SoapFaultError if a <Fault> is present.
 *
 * @param {string} xml
 * @returns {object} parsed document
 */
function parseXml(xml) {
  const doc = _xmlParser.parse(xml);
  const body = doc?.Envelope?.Body ?? doc?.['soap:Envelope']?.['soap:Body'];
  if (!body) return doc;

  const fault = body.Fault ?? body['soap:Fault'];
  if (fault) {
    const faultstring = fault.faultstring ?? fault['faultstring'] ?? 'Unknown SOAP fault';
    const detail = fault.detail ?? null;
    throw new SoapFaultError(String(faultstring), detail ? String(detail) : null);
  }

  return doc;
}

// ── Mojibake deep-fix ─────────────────────────────────────────────────────────

/**
 * Recursively apply fixMojibake to all string values in a parsed SOAP object.
 *
 * @param {unknown} node
 * @returns {unknown}
 */
export function deepFixMojibake(node) {
  if (typeof node === 'string') return fixMojibake(node);
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(deepFixMojibake);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = deepFixMojibake(v);
  }
  return out;
}

// ── Public operations ─────────────────────────────────────────────────────────

/**
 * Execute the SOAP Login operation.
 * Returns the raw UUID token string from <LoginResult>.
 * Throws AuthError on failure.
 *
 * This function is designed to be passed as the `loginFn` argument to
 * authManager.getToken().
 *
 * @param {{ endpoint: string, namespace: string, timeoutMs: number, user: string, pass: string }} config
 * @returns {() => Promise<string>}
 */
export function makeLoginFn(config) {
  return async function loginFn() {
    const { endpoint, timeoutMs, user, pass } = config;
    const envelope = buildLoginEnvelope(user, pass);

    // The console audit (_logReqAudit) already logs this with credentials redacted.
    // The pino-level payload log is suppressed to avoid double-logging in production.
    logSoapPayload('Login', 'request', '[logged by audit instrumentation]');

    const xml = await sendSoap(endpoint, 'Login', envelope, timeoutMs);
    logSoapPayload('Login', 'response', xml);

    let doc;
    try {
      doc = parseXml(xml);
    } catch (err) {
      if (err instanceof SoapFaultError) throw new AuthError(`SOAP Fault durante Login: ${err.faultstring}`);
      throw err;
    }

    // Navigate: Envelope → Body → LoginResponse → LoginResult
    const loginResult =
      doc?.Envelope?.Body?.LoginResponse?.LoginResult ??
      doc?.Envelope?.Body?.LoginResult;

    if (!loginResult || typeof loginResult !== 'string' || loginResult.trim() === '') {
      throw new AuthError('LoginResult ausente o vacío en la respuesta SOAP');
    }

    return loginResult.trim();
  };
}

/**
 * Call GetDetailMonitoringOrder for the given trip code.
 * Handles token acquisition (via authManager) and reactive renewal on
 * auth faults.
 *
 * @param {string} codigoViaje — e.g. "IN018108"
 * @param {{ endpoint: string, namespace: string, timeoutMs: number, user: string, pass: string }} config
 * @returns {Promise<object>} raw SOAP result object (mojibake-corrected)
 */
export async function getDetailMonitoringOrder(codigoViaje, config) {
  const { endpoint, timeoutMs, user, pass } = config;
  const loginFn = makeLoginFn(config);

  const t0 = Date.now();

  // Get (or acquire) the token — authManager deduplicates concurrent logins.
  let token;
  try {
    token = await getToken(loginFn);
  } catch (err) {
    logOperacion({
      operacion: 'GetDetailMonitoringOrder',
      codigoViaje,
      duracionMs: Date.now() - t0,
      ok: false,
      errorTipo: err.code ?? err.constructor.name,
      errorMsg: err.message,
    });
    throw err;
  }

  const envelope = buildGetDetailEnvelope(token, user, pass, codigoViaje);
  logSoapPayload('GetDetailMonitoringOrder', 'request', envelope);

  let xml;
  try {
    xml = await sendSoap(endpoint, 'GetDetailMonitoringOrder', envelope, timeoutMs);
  } catch (err) {
    logOperacion({
      operacion: 'GetDetailMonitoringOrder',
      codigoViaje,
      duracionMs: Date.now() - t0,
      ok: false,
      errorTipo: err.code ?? err.constructor.name,
      errorMsg: err.message,
    });
    throw err;
  }

  logSoapPayload('GetDetailMonitoringOrder', 'response', xml);

  let doc;
  try {
    doc = parseXml(xml);
  } catch (err) {
    if (err instanceof SoapFaultError) {
      // Heuristic: faultstrings mentioning "token" / "session" / "auth" indicate
      // the token was rejected — invalidate and let caller retry.
      const isAuthFault = /token|session|authen|autoriza/i.test(err.faultstring);
      if (isAuthFault) {
        invalidate();
        logOperacion({
          operacion: 'GetDetailMonitoringOrder',
          codigoViaje,
          duracionMs: Date.now() - t0,
          ok: false,
          errorTipo: 'AUTH_FAULT_INVALIDATED',
          errorMsg: err.faultstring,
        });
      } else {
        logOperacion({
          operacion: 'GetDetailMonitoringOrder',
          codigoViaje,
          duracionMs: Date.now() - t0,
          ok: false,
          errorTipo: 'SOAP_FAULT',
          errorMsg: err.faultstring,
        });
      }
      throw err;
    }
    logError(err, { operacion: 'GetDetailMonitoringOrder', codigoViaje });
    throw err;
  }

  // Navigate to the result payload
  const body = doc?.Envelope?.Body;
  if (!body) {
    logOperacion({
      operacion: 'GetDetailMonitoringOrder',
      codigoViaje,
      duracionMs: Date.now() - t0,
      ok: false,
      errorTipo: 'MAPPING_ERROR',
      errorMsg: 'Envelope.Body ausente en respuesta',
    });
    throw new ViajeNotFoundError(codigoViaje);
  }

  const responseNode =
    body.GetDetailMonitoringOrderResponse ??
    body.GetDetailMonitoringOrderResult;

  if (!responseNode) {
    logOperacion({
      operacion: 'GetDetailMonitoringOrder',
      codigoViaje,
      duracionMs: Date.now() - t0,
      ok: false,
      errorTipo: 'VIAJE_NOT_FOUND',
      errorMsg: `Sin nodo de respuesta para ${codigoViaje}`,
    });
    throw new ViajeNotFoundError(codigoViaje);
  }

  const fixed = deepFixMojibake(responseNode);

  logOperacion({
    operacion: 'GetDetailMonitoringOrder',
    codigoViaje,
    duracionMs: Date.now() - t0,
    ok: true,
  });

  return fixed;
}
