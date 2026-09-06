/**
 * services/cumplidos/dominioEstados.js — Dominio de estados de cumplidos (Ola 4A)
 *
 * Centraliza los estados que solo el sistema puede escribir (syncCumplidos,
 * vía sbFetch directo) vs. los que puede asignar un usuario humano vía
 * PATCH /api/cumplidos/:trip/estado.
 *
 * Importado por index.js (validación HTTP) y por la suite de tests de dominio
 * (services/rbac/ola4a-cumplidos.test.js).
 *
 * NO importar desde index.js raíz para evitar el ciclo de módulos — este
 * archivo importa únicamente primitivas JavaScript estándar.
 */

/**
 * Estados escritos exclusivamente por syncCumplidos — nunca asignables
 * por un usuario humano.
 *
 * - LIVE: estado inicial al insertar un viaje desde el feed de ControlT.
 *   syncCumplidos también lo restaura al reconciliar (viaje vuelve al feed
 *   después de haber sido marcado como finalizado).
 * - FINALIZADO CONTROLT: auto-finalización cuando el viaje sale del feed y
 *   no tiene soporte documental (tiene_soporte = false).
 * - PENDIENTE LIQUIDACION: auto-finalización cuando el viaje sale del feed y
 *   tiene soporte documental (tiene_soporte = true).
 *
 * Fuente: syncCumplidos() en index.js —
 *   ESTADOS_AUTO_FINALIZACION = new Set(['FINALIZADO CONTROLT', 'PENDIENTE LIQUIDACION'])
 *   con el comentario "Estados escritos exclusivamente por syncCumplidos durante
 *   una finalización automática", más la inserción inicial con estado_cumplido:'LIVE'.
 */
export const ESTADOS_EXCLUSIVOS_SISTEMA = new Set([
  'LIVE',
  'FINALIZADO CONTROLT',
  'PENDIENTE LIQUIDACION',
]);

/**
 * Valida si un `estado_cumplido` puede ser asignado por un usuario humano
 * vía PATCH /api/cumplidos/:trip/estado.
 *
 * La comparación es insensible a mayúsculas/minúsculas para defensar contra
 * variaciones de escritura (ej. 'live', 'Live').
 *
 * @param {string} estado — valor recibido del cliente HTTP
 * @returns {string|null} — null si el estado es humanamente asignable;
 *   mensaje de error si es exclusivo del sistema.
 */
export function validarEstadoHumano(estado) {
  if (ESTADOS_EXCLUSIVOS_SISTEMA.has((estado ?? '').toUpperCase())) {
    return `El estado "${estado}" es gestionado automáticamente por el sistema y no puede asignarse manualmente.`;
  }
  return null;
}
