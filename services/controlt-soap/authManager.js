/**
 * Token manager for ControlT SOAP authentication.
 *
 * Design:
 *   - Singleton token: one active UUID at a time, shared by all callers.
 *   - Promise queue: concurrent Login requests collapse into a single in-flight
 *     call; all waiters receive the same token.
 *   - Reactive renewal: token is invalidated only when ControlT rejects it with
 *     an authentication fault. Proactive TTL renewal is NOT implemented because
 *     ControlT does not document token lifetime.
 *   - Double-failure fast-fail: if Login fails twice in a row (initial + retry),
 *     throw AuthError immediately — do not mask the failure.
 *
 * The only exported surface intended for callers is:
 *   - getToken()    → Promise<string>
 *   - invalidate()  → void
 */

import { AuthError } from './errors.js';
import { logAuthEvent, logOperacion } from './auditLogger.js';

// ── State (module-level singleton) ────────────────────────────────────────────

/** @type {string|null} */
let _token = null;

/** @type {Promise<string>|null}  in-flight Login call, if any */
let _loginInProgress = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Execute the SOAP Login operation via the provided caller function.
 * Wrapped here to centralise timing + audit logging.
 *
 * @param {() => Promise<string>} loginFn  — injected; returns raw UUID string
 * @returns {Promise<string>}
 */
async function _executeLogin(loginFn) {
  const t0 = Date.now();
  try {
    const token = await loginFn();
    if (!token || typeof token !== 'string') {
      throw new AuthError('Login retornó un token vacío o con tipo inesperado');
    }
    logOperacion({ operacion: 'Login', codigoViaje: null, duracionMs: Date.now() - t0, ok: true });
    return token;
  } catch (err) {
    logOperacion({
      operacion: 'Login',
      codigoViaje: null,
      duracionMs: Date.now() - t0,
      ok: false,
      errorTipo: err.code ?? err.constructor.name,
      errorMsg: err.message,
    });
    throw err instanceof AuthError ? err : new AuthError(err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the active token, acquiring one if necessary.
 *
 * If a Login is already in flight, this call waits for it (no double Login).
 * On failure the error is re-thrown to all waiters simultaneously.
 *
 * @param {() => Promise<string>} loginFn — injected Login executor
 * @returns {Promise<string>}
 */
export async function getToken(loginFn) {
  if (_token) return _token;

  if (_loginInProgress) return _loginInProgress;

  _loginInProgress = _executeLogin(loginFn)
    .then((tok) => {
      _token = tok;
      _loginInProgress = null;
      logAuthEvent('acquired');
      return tok;
    })
    .catch((err) => {
      _loginInProgress = null;
      throw err;
    });

  return _loginInProgress;
}

/**
 * Invalidate the current token.
 * Call this when ControlT responds with an authentication fault on any operation.
 * The next getToken() call will re-authenticate.
 */
export function invalidate() {
  if (_token) {
    _token = null;
    logAuthEvent('invalidated');
  }
}

/**
 * Reset all module state — ONLY for use in tests.
 * @internal
 */
export function _resetAuth() {
  _token = null;
  _loginInProgress = null;
}

/**
 * Expose current token for tests (read-only peek).
 * @internal
 */
export function _getTokenSnapshot() {
  return _token;
}
