import { z } from 'zod';

/**
 * Configuración del módulo ControlT SOAP.
 *
 * Lee y valida las variables de entorno propias de este módulo usando Zod.
 * La validación se ejecuta de forma diferida: al primer import desde un
 * módulo que llame getConfig(). Esto garantiza que el proceso no rompa
 * el arranque del servidor (index.js) si las vars no están configuradas aún —
 * el fallo ocurrirá en el momento en que el módulo intente usarse.
 *
 * En Fase 4, routes/controltSoap.js llamará getConfig() al montarse en
 * index.js, produciendo fail-fast durante el startup si falta alguna var.
 *
 * Variables de entorno:
 *   CONTROLT_SOAP_USER        {string} REQUERIDA — usuario del servicio SOAP
 *   CONTROLT_SOAP_PASS        {string} REQUERIDA — contraseña (nunca se loga)
 *   CONTROLT_SOAP_TIMEOUT_MS  {number} OPCIONAL  — timeout en ms (default: 10 000)
 *
 * ⚠ Advertencia de seguridad (R-10 — Arquitectura v1.0):
 *   El endpoint SOAP de ControlT opera sobre HTTP (sin TLS). Las credenciales
 *   y los datos de carga viajan en texto plano. Este módulo NO debe activarse
 *   en producción sin confirmación de que el canal está protegido a nivel de
 *   red (VPN site-to-site o habilitación de HTTPS por parte de ControlT).
 */

const ConfigSchema = z.object({
  CONTROLT_SOAP_USER: z
    .string({ required_error: 'CONTROLT_SOAP_USER es requerida' })
    .min(1, 'CONTROLT_SOAP_USER no puede estar vacía'),

  CONTROLT_SOAP_PASS: z
    .string({ required_error: 'CONTROLT_SOAP_PASS es requerida' })
    .min(1, 'CONTROLT_SOAP_PASS no puede estar vacía'),

  CONTROLT_SOAP_TIMEOUT_MS: z
    .preprocess(
      (v) => (v == null || v === '' ? 10_000 : Number(v)),
      z
        .number({ invalid_type_error: 'CONTROLT_SOAP_TIMEOUT_MS debe ser un número' })
        .int('CONTROLT_SOAP_TIMEOUT_MS debe ser un entero')
        .min(1_000, 'CONTROLT_SOAP_TIMEOUT_MS mínimo es 1 000 ms')
        .max(60_000, 'CONTROLT_SOAP_TIMEOUT_MS máximo es 60 000 ms')
    ),
});

/** @type {ReturnType<typeof buildConfig> | null} */
let _config = null;

function buildConfig() {
  const result = ConfigSchema.safeParse({
    CONTROLT_SOAP_USER: process.env.CONTROLT_SOAP_USER,
    CONTROLT_SOAP_PASS: process.env.CONTROLT_SOAP_PASS,
    CONTROLT_SOAP_TIMEOUT_MS: process.env.CONTROLT_SOAP_TIMEOUT_MS,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  · ${i.path[0] ?? 'config'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[controlt-soap] Configuración inválida — verifica las variables de entorno:\n${issues}`
    );
  }

  return Object.freeze({
    /** Usuario SOAP. Usar solo en authManager para el Login. Nunca logar. */
    user: result.data.CONTROLT_SOAP_USER,

    /** Contraseña SOAP. NUNCA logar. NUNCA incluir en audit logs. */
    pass: result.data.CONTROLT_SOAP_PASS,

    /** Timeout de cada llamada HTTP al SOAP en milisegundos. */
    timeoutMs: result.data.CONTROLT_SOAP_TIMEOUT_MS,

    /** URL del WSDL / endpoint SOAP de ControlT. ⚠ HTTP — sin TLS (R-10). */
    endpoint: 'http://app.controlt.com.co/WS/service.asmx',

    /** SOAPAction base y xmlns del servicio. */
    namespace: 'http://controlt.com.co/',
  });
}

/**
 * Retorna la configuración validada del módulo.
 * Lanza Error en la primera llamada si alguna variable de entorno requerida
 * falta o es inválida (fail-fast diferido).
 *
 * @returns {Readonly<{user:string, pass:string, timeoutMs:number, endpoint:string, namespace:string}>}
 */
export function getConfig() {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}

/**
 * Descarta la configuración cacheada.
 * Solo para uso en tests (permite cambiar variables de entorno entre casos).
 * @internal
 */
export function _resetConfig() {
  _config = null;
}
