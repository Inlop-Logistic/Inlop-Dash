/**
 * erp/src/utils/date.ts — Módulo corporativo de fechas · ERP INLOP
 *
 * ESTÁNDAR: ERP_DATE_TIME_STANDARD.md V1.1
 * Zona oficial: America/Bogota (UTC−5 fijo, sin DST)
 *
 * REGLA (P-09 Single Source of Truth): toda función de fecha del frontend
 * importa desde este módulo. No reimplementar aquí fuera.
 *
 * Funciones corporativas (§10.1): fechaHoyColombia · extraerFechaColombia · formatearFecha
 * Wrappers de compatibilidad: hoy · hace7dias · fmtFecha · fmtFechaCort · fmtHora
 *                             fmtDDMMYYYYHm · fmtDDMMYYYY · splitISO
 */

const TZ_COLOMBIA = 'America/Bogota';

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES CORPORATIVAS (§10.1 ERP_DATE_TIME_STANDARD.md V1.1)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fecha actual en hora Colombia como string YYYY-MM-DD.
 *
 * @param offsetDias Días a sumar (+) o restar (−). Default 0.
 * @returns String YYYY-MM-DD en hora Colombia.
 *
 * Casos de borde (§14):
 *   00:00 COL (05:00 UTC)  → devuelve el día Colombia iniciado
 *   19:00 COL (00:00 UTC)  → devuelve el día Colombia corriente (no el siguiente UTC)
 *   23:59 COL (04:59 UTC)  → devuelve el día Colombia corriente
 *
 * RESUELVE H-01. REEMPLAZA: hoy() y hace7dias() — ambas son wrappers hacia esta función.
 */
export function fechaHoyColombia(offsetDias = 0): string {
  const base = new Date();
  if (offsetDias !== 0) {
    base.setUTCDate(base.getUTCDate() + offsetDias);
  }
  return base.toLocaleDateString('en-CA', { timeZone: TZ_COLOMBIA });
}

/**
 * Extrae la parte de fecha (YYYY-MM-DD) de un objeto Date en hora Colombia.
 * Nunca usa .toISOString().slice(0,10) — siempre declara la zona Colombia.
 *
 * Uso: filtros client-side donde se compara la fecha Colombia de un registro
 * contra un rango YYYY-MM-DD.
 */
export function extraerFechaColombia(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ_COLOMBIA });
}

/**
 * Formatea un timestamp ISO-8601 para mostrar al usuario en hora Colombia.
 * Zona de salida explícita: America/Bogota. Locale: es-CO para texto natural.
 * Formato 24 horas siempre (P-01, §7.3).
 *
 * Modos (§7.1):
 *   'fecha'      → "28/07/2026"            columnas de tabla
 *   'hora'       → "14:30"                 hora operativa (24h)
 *   'completo'   → "28/07/2026 14:30"      drawer y exportaciones
 *   'largo'      → "28 jul. 2026"          fecha larga sin hora
 *   'largo-hora' → "28 jul. 2026, 14:30"   detalles y timelines
 *
 * Devuelve "—" si iso es null, undefined o string vacío.
 *
 * REEMPLAZA: fmtFecha · fmtFechaCort · fmtHora · fmtDDMMYYYY · fmtDDMMYYYYHm · splitISO
 */
export function formatearFecha(
  iso: string | null | undefined,
  modo: 'fecha' | 'hora' | 'completo' | 'largo' | 'largo-hora',
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';

  // Extrae año, mes, día en hora Colombia con formato ISO de calendario.
  const ymd = d.toLocaleDateString('en-CA', { timeZone: TZ_COLOMBIA }); // "2026-07-28"
  const [Y, M, D] = ymd.split('-');

  // Extrae hora:minuto en hora Colombia, forzando formato 24h.
  const hhmm = d.toLocaleTimeString('en-US', {
    timeZone: TZ_COLOMBIA,
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }); // "14:30"

  switch (modo) {
    case 'fecha':    return `${D}/${M}/${Y}`;
    case 'hora':     return hhmm;
    case 'completo': return `${D}/${M}/${Y} ${hhmm}`;
    case 'largo': {
      const mes = d.toLocaleDateString('es-CO', { timeZone: TZ_COLOMBIA, month: 'short' });
      return `${parseInt(D, 10)} ${mes} ${Y}`;
    }
    case 'largo-hora': {
      const mes = d.toLocaleDateString('es-CO', { timeZone: TZ_COLOMBIA, month: 'short' });
      return `${parseInt(D, 10)} ${mes} ${Y}, ${hhmm}`;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// WRAPPERS DE COMPATIBILIDAD
//
// Delegan en las funciones corporativas de arriba.
// Se mantienen para no romper módulos pendientes de migración.
// Marcar como @deprecated al usar en código nuevo — importar las
// funciones corporativas directamente.
// ═══════════════════════════════════════════════════════════════════

/** @deprecated Usar fechaHoyColombia() — RESUELVE H-01 */
export function hoy(): string {
  return fechaHoyColombia();
}

/** @deprecated Usar fechaHoyColombia(-7) — RESUELVE H-01 */
export function hace7dias(): string {
  return fechaHoyColombia(-7);
}

/** @deprecated Usar formatearFecha(iso, 'largo-hora') */
export function fmtFecha(iso: string | null | undefined): string {
  return formatearFecha(iso, 'largo-hora');
}

/** @deprecated Usar formatearFecha(iso, 'largo') */
export function fmtFechaCort(iso: string | null | undefined): string {
  return formatearFecha(iso, 'largo');
}

/** @deprecated Usar formatearFecha(iso, 'hora') */
export function fmtHora(iso: string | null | undefined): string {
  return formatearFecha(iso, 'hora');
}

/** @deprecated Usar formatearFecha(iso, 'completo') */
export function fmtDDMMYYYYHm(iso: string | null | undefined): string {
  return formatearFecha(iso, 'completo');
}

/** @deprecated Usar formatearFecha(iso, 'fecha') */
export function fmtDDMMYYYY(iso: string | null | undefined): string {
  return formatearFecha(iso, 'fecha');
}

/**
 * Separa un ISO timestamp en { fecha: DD/MM/YYYY, hora: HH:mm }.
 * hora es string vacío cuando iso es null/inválido (preserva comportamiento de DateTimeCell).
 * @deprecated Usar formatearFecha(iso, 'fecha') y formatearFecha(iso, 'hora') directamente.
 */
export function splitISO(iso: string | null | undefined): { fecha: string; hora: string } {
  if (!iso) return { fecha: '—', hora: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { fecha: '—', hora: '' };
  return {
    fecha: formatearFecha(iso, 'fecha'),
    hora:  formatearFecha(iso, 'hora'),
  };
}
