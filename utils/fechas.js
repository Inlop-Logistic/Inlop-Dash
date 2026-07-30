/**
 * utils/fechas.js — Funciones corporativas de fechas para el backend ERP INLOP
 *
 * ESTÁNDAR: ERP_DATE_TIME_STANDARD.md V1.1 · Zona oficial: America/Bogota (UTC−5 fijo)
 *
 * Railway corre en UTC. Ninguna función de este módulo asume la zona del servidor.
 * Toda operación de fecha de negocio declara explícitamente America/Bogota.
 *
 * Importar: import { fechaHoyColombia, parseFechaTMS, extraerFechaColombia } from './utils/fechas.js';
 */

const TZ_COLOMBIA = 'America/Bogota';
const OFFSET_COL  = '-05:00';         // UTC−5 fijo, sin DST

/**
 * Devuelve la fecha actual en hora Colombia como string YYYY-MM-DD.
 *
 * @param {number} offsetDias - Días a sumar (positivo) o restar (negativo). Default 0.
 * @returns {string} Fecha en formato YYYY-MM-DD en hora Colombia.
 */
export function fechaHoyColombia(offsetDias = 0) {
  const base = new Date();
  if (offsetDias !== 0) {
    base.setUTCDate(base.getUTCDate() + offsetDias);
  }
  return base.toLocaleDateString('en-CA', { timeZone: TZ_COLOMBIA });
}

/**
 * Extrae la parte de fecha (YYYY-MM-DD) de un objeto Date en hora Colombia.
 * Usar en lugar de .toISOString().slice(0,10), que devuelve la fecha UTC.
 *
 * @param {Date} date - Objeto Date válido.
 * @returns {string} Fecha en formato YYYY-MM-DD en hora Colombia.
 */
export function extraerFechaColombia(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ_COLOMBIA });
}

/**
 * Parsea un string de fecha del TMS (formatos MDY o DMY) construyendo un Date
 * con offset explícito −05:00 (America/Bogota). Nunca interpreta el string como UTC.
 *
 * Formatos soportados:
 *   MDY → MM/DD/YYYY HH:MM:SS  (activated_on, created_on, latest_gps_report)
 *   DMY → DD/MM/YYYY HH:MM:SS  (schedulate_origin)
 *
 * Variantes toleradas: M/D/YYYY, segundos opcionales.
 *
 * @param {string|null|undefined} str    - String del TMS.
 * @param {'MDY'|'DMY'}           formato - Orden de los componentes de fecha.
 * @returns {Date|null} Date con el instante UTC correcto, o null si inválido.
 */
export function parseFechaTMS(str, formato) {
  if (!str) return null;
  const s = str.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
  if (!m) return null;
  const [, p1, p2, yr, hh, min, ss = '00'] = m;
  const [day, mon] = formato === 'DMY' ? [p1, p2] : [p2, p1];
  const iso = `${yr}-${mon.padStart(2,'0')}-${day.padStart(2,'0')}T${hh.padStart(2,'0')}:${min}:${ss.padStart(2,'0')}${OFFSET_COL}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
