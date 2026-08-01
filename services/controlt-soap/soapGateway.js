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
  // SecuredToken header is required even for Login — the .NET service accesses
  // this.securedToken inside CurrentToken() before checking the token value.
  // Omitting the header leaves the field null and causes NullReferenceException.
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://controlt.com.co/">
  <soap:Header>
    <ns:SecuredToken>
      <ns:AuthenticationToken></ns:AuthenticationToken>
      <ns:user>${escapeXml(user)}</ns:user>
      <ns:password>${escapeXml(pass)}</ns:password>
    </ns:SecuredToken>
  </soap:Header>
  <soap:Body>
    <ns:Login>
      <ns:user>${escapeXml(user)}</ns:user>
      <ns:password>${escapeXml(pass)}</ns:password>
    </ns:Login>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * @param {string} token
 * @param {string} user
 * @param {string} pass
 * @param {string} codigoViaje
 * @returns {string}
 */
function buildGetDetailEnvelope(token, user, pass, codigoViaje) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://controlt.com.co/">
  <soap:Header>
    <ns:SecuredToken>
      <ns:AuthenticationToken>${escapeXml(token)}</ns:AuthenticationToken>
      <ns:user>${escapeXml(user)}</ns:user>
      <ns:password>${escapeXml(pass)}</ns:password>
    </ns:SecuredToken>
  </soap:Header>
  <soap:Body>
    <ns:GetDetailMonitoringOrder>
      <ns:number_travel_main>${escapeXml(codigoViaje)}</ns:number_travel_main>
    </ns:GetDetailMonitoringOrder>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  let response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"http://controlt.com.co/${soapAction}"`,
        },
        body,
      },
      timeoutMs
    );
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new TimeoutError(timeoutMs);
    }
    throw new NetworkError(err.message);
  }

  const xml = await response.text();
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

    // Never log the Login envelope — it contains the password.
    logSoapPayload('Login', 'request', '[SUPPRESSED — contains credentials]');

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
