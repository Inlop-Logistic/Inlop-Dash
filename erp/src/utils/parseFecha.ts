/**
 * erp/src/utils/parseFecha.ts — Parsers corporativos de fechas TMS · ERP INLOP
 *
 * ESTÁNDAR: ERP_DATE_TIME_STANDARD.md V1.1
 * Zona oficial: America/Bogota (UTC−5 fijo, sin DST)
 *
 * REGLA (P-09): toda función de parseo de fecha TMS del frontend importa desde
 * este módulo. No reimplementar fuera de aquí.
 *
 * Formatos TMS detectados en auditoría funcional:
 *   MDY → MM/DD/YYYY HH:MM:SS [AM|PM]  (activated_on, created_on, latest_gps_report)
 *   DMY → DD/MM/YYYY HH:MM:SS           (schedulate_origin)
 */

const TZ_COLOMBIA = 'America/Bogota';
const OFFSET_COL  = '-05:00';

// ═══════════════════════════════════════════════════════════════════
// FUNCIÓN CORPORATIVA (§10.1 ERP_DATE_TIME_STANDARD.md V1.1)
// ═══════════════════════════════════════════════════════════════════

/**
 * Parsea un string de fecha del TMS construyendo un Date con offset explícito
 * −05:00 (America/Bogota). Nunca interpreta el string como UTC ni depende de
 * la zona del browser o del servidor.
 *
 * Formatos soportados:
 *   MDY → MM/DD/YYYY HH:MM:SS [AM|PM]
 *   DMY → DD/MM/YYYY HH:MM:SS
 *
 * Variantes toleradas: M/D/YYYY, segundos opcionales.
 * Retorna null si el string es nulo, vacío o no reconocible.
 */
export function parseFechaTMS(
  str: string | null | undefined,
  formato: 'MDY' | 'DMY',
): Date | null {
  if (!str) return null;
  const s = str.trim();

  if (formato === 'MDY') {
    const m = s.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s+(AM|PM))?/i,
    );
    if (!m) return null;
    const [, mon, day, yr, hhRaw, min, ss, ampm] = m;
    let hour = parseInt(hhRaw, 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    }
    const iso = `${yr}-${mon.padStart(2,'0')}-${day.padStart(2,'0')}T${String(hour).padStart(2,'0')}:${min}:${ss}${OFFSET_COL}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  // DMY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
  if (!m) return null;
  const [, day, mon, yr, hh, min, ss = '00'] = m;
  const iso = `${yr}-${mon.padStart(2,'0')}-${day.padStart(2,'0')}T${hh.padStart(2,'0')}:${min}:${ss.padStart(2,'0')}${OFFSET_COL}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// ═══════════════════════════════════════════════════════════════════
// WRAPPERS DE COMPATIBILIDAD
// ═══════════════════════════════════════════════════════════════════

/** @deprecated Usar parseFechaTMS(str, 'MDY') */
export function parseFechaMDY(str: string | null | undefined): Date | null {
  return parseFechaTMS(str, 'MDY');
}

/** @deprecated Usar parseFechaTMS(str, 'DMY') */
export function parseFechaDMY(str: string | null | undefined): Date | null {
  return parseFechaTMS(str, 'DMY');
}

// ═══════════════════════════════════════════════════════════════════
// GPS FRESHNESS
// ═══════════════════════════════════════════════════════════════════

/** Resultado de freshness GPS: label legible + color semántico + nivel de urgencia. */
export interface GpsFreshness {
  label: string;
  color: string;
  level: 'ok' | 'warn' | 'stale';
}

/**
 * Calcula la antigüedad de una señal GPS a partir del campo latest_gps_report
 * (formato MDY: MM/DD/YYYY HH:MM:SS del TMS).
 *
 * Umbrales (sincronizados con backend GPS_THRESHOLD_*):
 *   < 2 h → ok    (verde)
 *   2–6 h → warn  (amarillo)
 *   > 6 h → stale (rojo)
 *
 * Usa parseFechaTMS con offset −05:00 para evitar el drift de 5 h en UTC.
 */
export function gpsRelativo(reportStr: string | null | undefined): GpsFreshness {
  const ts = parseFechaTMS(reportStr, 'MDY');
  if (!ts) {
    return { label: 'Sin señal', color: 'var(--gray-400)', level: 'stale' };
  }
  const horas = (Date.now() - ts.getTime()) / (1000 * 3600);
  if (horas < 2) {
    const mins = Math.round(horas * 60);
    return { label: `hace ${mins} min`, color: '#059669', level: 'ok' };
  }
  if (horas < 6) {
    return { label: `hace ${horas.toFixed(1)} h`, color: '#D97706', level: 'warn' };
  }
  return { label: `hace ${Math.floor(horas)} h`, color: '#DC2626', level: 'stale' };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATO LEGIBLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Formatea cualquier string de fecha TMS a texto legible para la UI en hora Colombia.
 * Zona de salida explícita: America/Bogota (P-01 §7.3).
 * Retorna "—" si el string no es parseable.
 */
export function fmtTms(
  str: string | null | undefined,
  formato: 'MDY' | 'DMY' = 'MDY',
  opts: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    hour12: true,
  },
): string {
  if (!str) return '—';
  const d = parseFechaTMS(str, formato);
  if (!d) return '—';
  return d.toLocaleDateString('es-CO', { timeZone: TZ_COLOMBIA, ...opts });
}
