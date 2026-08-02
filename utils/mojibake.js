/**
 * Corrige mojibake UTF-8 → Latin-1 presente en las respuestas SOAP de ControlT.
 *
 * El SOAP de ControlT declara encoding="UTF-8" pero los bytes de caracteres
 * multi-byte (acentos, ñ, etc.) llegan double-encoded: los bytes UTF-8 son
 * interpretados individualmente como caracteres Latin-1. El parser XML los
 * convierte a su code-point Unicode equivalente, produciendo cadenas como
 * "PetrÃ³leo crudo" en lugar de "Petróleo crudo".
 *
 * Algoritmo:
 *   1. Intentar decodificar la cadena COMPLETA de una sola vez (caso común:
 *      toda la cadena es mojibake consistente). Si tiene éxito, listo.
 *   2. Si falla, la causa más frecuente (certificación Fase 6, objetivo de
 *      codificación) es que ControlT ya perdió un carácter en su propio
 *      sistema antes de entregarlo (ej. lo reemplazó por "?" en un tramo
 *      previo de su propio pipeline) — un solo byte irrecuperable en medio
 *      de texto por lo demás perfectamente corregible. En vez de descartar
 *      TODA la corrección por un byte roto, se divide la cadena en tramos
 *      contiguos de caracteres "altos" (0x80-0xFF) y de caracteres ASCII, y
 *      se intenta decodificar cada tramo alto de forma independiente. Un
 *      tramo que no decodifica de forma válida se conserva tal cual — no
 *      se reemplaza ni se inventa contenido para un byte que ya se perdió
 *      en origen; los demás tramos sí quedan corregidos.
 */

/**
 * Intenta decodificar una cadena reinterpretando cada char code (0-255)
 * como un byte UTF-8. Retorna null si la secuencia no es UTF-8 válido.
 * @param {string} str
 * @returns {string|null}
 */
function tryDecodeAsUtf8(str) {
  try {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xFF;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value - Valor a corregir. Si no es string, se retorna sin cambios.
 * @returns {unknown}
 */
export function fixMojibake(value) {
  if (typeof value !== 'string') return value;
  // Optimización: sin chars > 0x7F no hay nada que corregir.
  if (!/[-ÿ]/.test(value)) return value;

  // 1. Intento de cadena completa — cubre el caso común.
  const whole = tryDecodeAsUtf8(value);
  if (whole !== null) return whole;

  // 2. Recuperación parcial por tramos — ver algoritmo arriba.
  const segments = value.match(/[-ÿ]+|[^-ÿ]+/g) || [value];
  let changed = false;
  const fixed = segments.map(seg => {
    if (!/[-ÿ]/.test(seg)) return seg;
    const decoded = tryDecodeAsUtf8(seg);
    if (decoded !== null) {
      changed = true;
      return decoded;
    }
    return seg; // tramo irrecuperable — se conserva sin modificar
  }).join('');

  return changed ? fixed : value;
}
