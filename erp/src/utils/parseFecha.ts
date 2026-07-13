/**
 * Parsers para los 3 formatos de fecha del TMS (ninguno es ISO 8601).
 * Centralizar aquí evita parseos distribuidos y facilita tests.
 *
 * Formatos detectados en auditoría funcional:
 *   - parseFechaMDY → MM/DD/YYYY HH:MM:SS [AM|PM]  (created_on, latest_gps_report)
 *   - parseFechaDMY → DD/MM/YYYY HH:MM:SS           (activated_on, schedulate_origin)
 */

/**
 * Parsea formato MM/DD/YYYY HH:MM:SS [AM|PM].
 * Maneja variantes: M/D/YYYY, espacios extra, AM/PM opcional.
 * Retorna null si el string es vacío, nulo o no reconocible.
 */
export function parseFechaMDY(str: string | null | undefined): Date | null {
  if (!str) return null;
  const s = str.trim();
  // Patrón: M/D/YYYY H:MM:SS [AM|PM]
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s+(AM|PM))?/i,
  );
  if (!m) return null;
  let [, mon, day, yr, hh, mm, ss, ampm] = m;
  let hour = parseInt(hh, 10);
  if (ampm) {
    if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
    if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
  }
  const d = new Date(
    parseInt(yr, 10),
    parseInt(mon, 10) - 1,
    parseInt(day, 10),
    hour,
    parseInt(mm, 10),
    parseInt(ss, 10),
  );
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parsea formato DD/MM/YYYY HH:MM:SS.
 * Retorna null si el string es vacío, nulo o no reconocible.
 */
export function parseFechaDMY(str: string | null | undefined): Date | null {
  if (!str) return null;
  const s = str.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, day, mon, yr, hh, mm, ss] = m;
  const d = new Date(
    parseInt(yr, 10),
    parseInt(mon, 10) - 1,
    parseInt(day, 10),
    parseInt(hh, 10),
    parseInt(mm, 10),
    parseInt(ss, 10),
  );
  return isNaN(d.getTime()) ? null : d;
}

/** Resultado de freshness GPS: label legible + color semántico + nivel de urgencia. */
export interface GpsFreshness {
  label: string;
  color: string;
  level: "ok" | "warn" | "stale";
}

/**
 * Calcula la antigüedad de una señal GPS a partir del campo latest_gps_report
 * (formato MM/DD/YYYY HH:MM:SS del TMS).
 *
 * Umbrales:
 *   < 2 h → ok    (verde)
 *   2–6 h → warn  (amarillo)
 *   > 6 h → stale (rojo)
 */
export function gpsRelativo(reportStr: string | null | undefined): GpsFreshness {
  const ts = parseFechaMDY(reportStr);
  if (!ts) {
    return { label: "Sin señal", color: "var(--gray-400)", level: "stale" };
  }
  const horas = (Date.now() - ts.getTime()) / (1000 * 3600);
  if (horas < 2) {
    const mins = Math.round(horas * 60);
    return { label: `hace ${mins} min`, color: "#059669", level: "ok" };
  }
  if (horas < 6) {
    return { label: `hace ${horas.toFixed(1)} h`, color: "#D97706", level: "warn" };
  }
  return { label: `hace ${Math.floor(horas)} h`, color: "#DC2626", level: "stale" };
}
