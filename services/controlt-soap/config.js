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
 *   CONTROLT_USER             {string} REQUERIDA — usuario (compartida con REST y SOAP)
 *   CONTROLT_PASS             {string} REQUERIDA — contraseña (nunca se loga)
 *   CONTROLT_SOAP_TIMEOUT_MS  {number} OPCIONAL  — timeout en ms (default: 10 000)
 *
 * Endpoint: el módulo usa HTTPS por defecto
 * (https://app.controlt.com.co/WS/service.asmx), validado durante las pruebas
 * de integración de la Fase 2. El endpoint HTTP queda documentado solo como
 * fallback de referencia — no debe usarse en producción.
 */

const ConfigSchema = z.object({
  CONTROLT_USER: z
    .string({ required_error: 'CONTROLT_USER es requerida' })
    .min(1, 'CONTROLT_USER no puede estar vacía'),

  CONTROLT_PASS: z
    .string({ required_error: 'CONTROLT_PASS es requerida' })
    .min(1, 'CONTROLT_PASS no puede estar vacía'),

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
    CONTROLT_USER: process.env.CONTROLT_USER,
    CONTROLT_PASS: process.env.CONTROLT_PASS,
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
    user: result.data.CONTROLT_USER,

    /** Contraseña SOAP. NUNCA logar. NUNCA incluir en audit logs. */
    pass: result.data.CONTROLT_PASS,

    /** Timeout de cada llamada SOAP en milisegundos. */
    timeoutMs: result.data.CONTROLT_SOAP_TIMEOUT_MS,

    /** Endpoint SOAP de ControlT — HTTPS validado en Fase 2. */
    endpoint: 'https://app.controlt.com.co/WS/service.asmx',

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
