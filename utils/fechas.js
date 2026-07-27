/**
 * utils/fechas.js — Funciones corporativas de fechas para el backend ERP INLOP
 *
 * ESTÁNDAR: ERP_DATE_TIME_STANDARD.md V1.1 · Zona oficial: America/Bogota (UTC−5 fijo)
 *
 * Railway corre en UTC. Ninguna función de este módulo asume la zona del servidor.
 * Toda operación de fecha de negocio declara explícitamente America/Bogota.
 *
 * Importar: import { fechaHoyColombia } from './utils/fechas.js';
 */

const TZ_COLOMBIA = 'America/Bogota';

/**
 * Devuelve la fecha actual en hora Colombia como string YYYY-MM-DD.
 *
 * @param {number} offsetDias - Días a sumar (positivo) o restar (negativo). Default 0.
 * @returns {string} Fecha en formato YYYY-MM-DD en hora Colombia.
 *
 * Ejemplos:
 *   fechaHoyColombia()    → "2026-07-28"  (hoy en Colombia)
 *   fechaHoyColombia(-1)  → "2026-07-27"  (ayer en Colombia)
 *   fechaHoyColombia(-6)  → "2026-07-22"  (hace 6 días en Colombia)
 *
 * Casos de borde validados (ERP_DATE_TIME_STANDARD.md §14):
 *   00:00 COL (05:00 UTC)  → devuelve el día Colombia iniciado, no el UTC anterior
 *   18:59 COL (23:59 UTC)  → devuelve el día Colombia corriente
 *   19:00 COL (00:00 UTC+1)→ devuelve el día Colombia corriente (no el siguiente UTC)
 *   23:59 COL (04:59 UTC+1)→ devuelve el día Colombia corriente
 */
export function fechaHoyColombia(offsetDias = 0) {
  const base = new Date();

  if (offsetDias !== 0) {
    base.setUTCDate(base.getUTCDate() + offsetDias);
  }

  return base.toLocaleDateString('en-CA', { timeZone: TZ_COLOMBIA });
}
