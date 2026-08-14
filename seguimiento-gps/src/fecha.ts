/**
 * src/fecha.ts — Estándar corporativo de fechas TMS, local a esta app
 * (Hotfix de despliegue, tras Fase 10C/10E).
 *
 * Hasta este hotfix, este módulo reexportaba por ruta relativa desde
 * `erp/src/utils/parseFecha.ts` (regla P-09 de ERP_DATE_TIME_STANDARD.md:
 * "toda función de parseo de fecha TMS del frontend importa desde este
 * módulo"). Railway despliega este proyecto con Root Directory=/seguimiento-gps,
 * así que el contexto de build de Docker no incluye /erp — `../../erp/...`
 * deja de existir en ese contexto y `tsc -b` falla con TS2307.
 *
 * Se traslada aquí ÚNICAMENTE lo que esta app consume de ese módulo
 * (`gpsRelativo`, y `parseFechaTMS` del que depende — ver src/components/
 * TarjetaVehiculo.tsx y DetalleVehiculo.tsx; `parseFechaMDY`/`parseFechaDMY`
 * (wrappers deprecados) y `fmtTms` NO se usan en este proyecto y no se
 * copian). La lógica es una copia LITERAL, carácter por carácter, del
 * erp/src/utils/parseFecha.ts vigente — mismo comportamiento exacto, cero
 * reglas nuevas o simplificadas. `erp/src/utils/parseFecha.ts` sigue siendo
 * la fuente única de verdad para el ERP (P-09); este archivo es ahora una
 * copia deliberada, no una reexportación — si el estándar de fechas TMS
 * cambia alguna vez, debe replicarse aquí a mano (ver src/fecha.test.ts
 * para la batería de casos que blindan el comportamiento).
 */

const OFFSET_COL = '-05:00';

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
  formato: "MDY" | "DMY",
): Date | null {
  if (!str) return null;
  const s = str.trim();

  if (formato === "MDY") {
    const m = s.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s+(AM|PM))?/i,
    );
    if (!m) return null;
    const [, mon, day, yr, hhRaw, min, ss, ampm] = m;
    let hour = parseInt(hhRaw, 10);
    if (ampm) {
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
    }
    const iso = `${yr}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}T${String(hour).padStart(2, "0")}:${min}:${ss}${OFFSET_COL}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  // DMY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
  if (!m) return null;
  const [, day, mon, yr, hh, min, ss = "00"] = m;
  const iso = `${yr}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}T${hh.padStart(2, "0")}:${min}:${ss.padStart(2, "0")}${OFFSET_COL}`;
  const d = new Date(iso);
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
  const ts = parseFechaTMS(reportStr, "MDY");
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
