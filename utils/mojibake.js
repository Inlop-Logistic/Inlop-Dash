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
 *   1. Leer cada carácter de la cadena como un byte (código 0-255).
 *   2. Construir un Uint8Array con esos bytes.
 *   3. Decodificar el Uint8Array como UTF-8 (fatal: true — si la secuencia
 *      no es UTF-8 válido, retornar la cadena original sin modificar).
 */

/**
 * @param {unknown} value - Valor a corregir. Si no es string, se retorna sin cambios.
 * @returns {unknown}
 */
export function fixMojibake(value) {
  if (typeof value !== 'string') return value;
  // Optimización: sin chars > 0x7F no hay nada que corregir.
  if (!/[-ÿ]/.test(value)) return value;
  try {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) {
      bytes[i] = value.charCodeAt(i) & 0xFF;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Secuencia de bytes inválida para UTF-8 → devolver original sin cambios.
    return value;
  }
}
