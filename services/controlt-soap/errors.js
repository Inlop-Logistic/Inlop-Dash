/**
 * Jerarquía de errores tipados para el módulo ControlT SOAP.
 *
 * Todos los errores extienden ControltSoapError, que a su vez extiende Error.
 * Cada clase define:
 *   - code        {string}  — identificador máquina (nunca cambia entre versiones)
 *   - statusCode  {number}  — código HTTP sugerido para la respuesta al cliente
 *
 * Solo estas clases deben cruzar la frontera del módulo hacia los route handlers.
 * Los errores de red / SOAP / XML internos se envuelven aquí antes de propagarse.
 */

export class ControltSoapError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} statusCode
   */
  constructor(message, code, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    // Preservar stack trace en V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Fallo en el Login SOAP de ControlT (credenciales, servicio caído, etc.).
 * El módulo no puede autenticarse para hacer ninguna llamada posterior.
 * statusCode: 503 — el servicio dependiente no está disponible.
 */
export class AuthError extends ControltSoapError {
  /** @param {string} [message] */
  constructor(message = 'Fallo en autenticación SOAP de ControlT') {
    super(message, 'AUTH_FAILED', 503);
  }
}

/**
 * El servicio SOAP retornó un <soap:Fault> explícito.
 * statusCode: 502 — el gateway obtuvo una respuesta inválida del upstream.
 */
export class SoapFaultError extends ControltSoapError {
  /**
   * @param {string} faultstring — contenido de <faultstring> en el envelope SOAP
   * @param {string|null} [detail]  — contenido de <detail> si existe
   */
  constructor(faultstring, detail = null) {
    super(`SOAP Fault: ${faultstring}`, 'SOAP_FAULT', 502);
    this.faultstring = faultstring;
    this.detail = detail;
  }
}

/**
 * Error de red al contactar el endpoint SOAP (DNS, TCP, TLS, rechazo de conexión).
 * statusCode: 503 — servicio no disponible transitoriamente.
 */
export class NetworkError extends ControltSoapError {
  /** @param {string} [message] */
  constructor(message = 'Error de red al contactar ControlT') {
    super(message, 'NETWORK_ERROR', 503);
  }
}

/**
 * La llamada SOAP superó el tiempo máximo configurado (CONTROLT_SOAP_TIMEOUT_MS).
 * statusCode: 504 — Gateway Timeout.
 */
export class TimeoutError extends ControltSoapError {
  /** @param {number} timeoutMs — timeout configurado en ms */
  constructor(timeoutMs) {
    super(
      `Tiempo de espera agotado esperando respuesta de ControlT (${timeoutMs} ms)`,
      'TIMEOUT',
      504
    );
    this.timeoutMs = timeoutMs;
  }
}

/**
 * El viaje solicitado no existe en ControlT o no fue encontrado en la
 * respuesta SOAP (resultado vacío / nodo ausente).
 * statusCode: 404 — recurso no encontrado.
 */
export class ViajeNotFoundError extends ControltSoapError {
  /** @param {string} codigoViaje — ej. "IN018108" */
  constructor(codigoViaje) {
    super(
      `Viaje no encontrado en ControlT: ${codigoViaje}`,
      'VIAJE_NOT_FOUND',
      404
    );
    this.codigoViaje = codigoViaje;
  }
}

/**
 * Error al transformar la respuesta XML de ControlT al modelo de dominio INLOP.
 * Indica un campo obligatorio ausente o con formato inesperado en el XML.
 * statusCode: 500 — error interno (implica un cambio en el contrato del SOAP).
 */
export class MappingError extends ControltSoapError {
  /**
   * @param {string} field  — nombre del campo que causó el error
   * @param {string|null} [detail] — información adicional de depuración
   */
  constructor(field, detail = null) {
    super(
      `Error al mapear campo "${field}" de la respuesta SOAP de ControlT`,
      'MAPPING_ERROR',
      500
    );
    this.field = field;
    this.detail = detail;
  }
}

/**
 * El servicio no puede satisfacer la solicitud: ControlT falló Y no hay
 * datos en caché de Supabase.
 *
 * Se usa como error "de último recurso" en tripService cuando todos los
 * orígenes de datos fallaron. El code y statusCode reflejan la causa raíz
 * del fallo de ControlT (puede ser TIMEOUT → 504, NETWORK_ERROR → 503, etc.).
 *
 * hasCache: false — invariante al lanzar este error (si hubiera caché,
 * tripService lo habría retornado con fuenteDatos: 'SUPABASE_CACHE' en lugar
 * de lanzar este error).
 */
export class ServiceUnavailableError extends ControltSoapError {
  /**
   * @param {object} params
   * @param {string} params.message
   * @param {string} [params.code]
   * @param {number} [params.statusCode]
   * @param {Error}  [params.cause]  — error original que desencadenó este fallo
   */
  constructor({ message, code = 'SERVICE_UNAVAILABLE', statusCode = 503, cause }) {
    super(message, code, statusCode);
    this.hasCache = false;
    if (cause) this.cause = cause;
  }
}
