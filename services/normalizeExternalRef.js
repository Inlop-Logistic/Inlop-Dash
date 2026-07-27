/**
 * Normaliza una referencia externa al formato canónico: <TIPO_VEHICULO>-<REFERENCIA>
 *
 * Reglas:
 *   - trim + uppercase
 *   - espacios → guion
 *   - guiones consecutivos → uno solo
 *   - guiones en extremos eliminados
 *   - no duplica el prefijo si ya está presente
 *   - retorna null si la referencia queda vacía tras normalizar
 *
 * @param {string} tipoVehiculo  Tipo de vehículo (ej. "NHR", "NPR")
 * @param {string|null} ref      Referencia externa cruda
 * @returns {string|null}
 */
function normalizeExternalRef(tipoVehiculo, ref) {
  if (!ref || !String(ref).trim()) return null;

  const prefix = String(tipoVehiculo || '').trim().toUpperCase()
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  let val = String(ref).trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!val) return null;

  if (prefix) {
    if (val.startsWith(prefix + '-')) return val;
    // evitar NHR-NHR-... si el usuario ya puso el prefijo sin guion separador
    if (val === prefix) return prefix;
    return `${prefix}-${val}`;
  }

  return val;
}

export { normalizeExternalRef };
