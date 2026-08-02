/**
 * TEMPORAL — auditoría Fase 6.
 *
 * Agrupa la evidencia de las 6 etapas del flujo SOAP (XML crudo → tripMapper
 * → persistenceLayer → respuesta final) en un único bloque de log por Trip
 * Number, para facilitar la revisión en Railway sin buscar líneas dispersas.
 *
 * ELIMINAR este archivo y todas sus referencias (soapGateway.js, tripMapper.js,
 * persistenceLayer.js, tripService.js) una vez confirmada la causa raíz del
 * bug reportado en GET /api/viajes/:tripNumber (campos vacíos pese a que
 * ControlT sí devuelve datos completos).
 */

const _buffers = new Map();

/**
 * Registra la evidencia de una etapa para un Trip Number dado.
 * @param {string} tripNumber
 * @param {string} etiqueta — ej. "Etapa 1 - XML crudo"
 * @param {unknown} contenido
 */
export function record(tripNumber, etiqueta, contenido) {
  if (!tripNumber) return;
  if (!_buffers.has(tripNumber)) _buffers.set(tripNumber, []);
  _buffers.get(tripNumber).push({ etiqueta, contenido });
}

/**
 * Imprime el bloque consolidado de todas las etapas registradas para un Trip
 * Number y limpia el buffer. Debe llamarse una sola vez, al final del flujo.
 * @param {string} tripNumber
 */
export function flush(tripNumber) {
  if (!tripNumber) return;
  const entries = _buffers.get(tripNumber) || [];
  _buffers.delete(tripNumber);

  const lines = [];
  lines.push('================ FASE6 AUDITORIA ================');
  lines.push(`Trip Number: ${tripNumber}`);
  lines.push('');
  for (const { etiqueta, contenido } of entries) {
    lines.push(etiqueta);
    lines.push(typeof contenido === 'string' ? contenido : JSON.stringify(contenido, null, 2));
    lines.push('');
  }
  lines.push('============== FIN FASE6 AUDITORIA ==============');
  console.log(lines.join('\n'));
}
