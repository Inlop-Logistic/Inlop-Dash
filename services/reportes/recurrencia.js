/**
 * services/reportes/recurrencia.js — Cálculo de próxima ejecución (Fase 9F)
 *
 * Módulo puro (sin I/O, sin dependencias de Supabase/sbFetch): dado un
 * objeto `recurrencia` (misma estructura que persiste `reportes_automaticos
 * .recurrencia` desde la Etapa 04 del wizard — ver
 * erp/src/modules/configuracion/types.ts) y una referencia temporal,
 * calcula el siguiente instante en que el reporte debe ejecutarse.
 *
 * Estructura de `recurrencia`:
 *   {
 *     tipo:         "diaria" | "semanal" | "mensual",
 *     horas:        ["08:00", "14:30"],       // una o más — cada hora es
 *                                              // una ejecución independiente
 *     dias_semana:  [1, 3, 5],                // solo si tipo = "semanal"
 *                                              // (0=domingo..6=sábado)
 *     dia_mes:      15,                       // solo si tipo = "mensual" (1-31)
 *     fecha_inicio: "2026-08-11",              // obligatoria, YYYY-MM-DD
 *     fin: { modo: "nunca" }
 *         | { modo: "fecha", fecha: "2026-12-31" }
 *         | { modo: "repeticiones", cantidad: 10 },
 *   }
 *
 * Diseño clave: SIN estado persistido de "cuántas veces ya se ejecutó". El
 * modo `repeticiones` se resuelve contando, de forma puramente determinista,
 * cuántos slots válidos existen entre `fecha_inicio` y el slot candidato —
 * no requiere una columna nueva en `reportes_automaticos` ni un historial de
 * ejecuciones (explícitamente fuera de alcance, Fase 9E/9F). Esto también
 * hace que recalcular la próxima ejecución sea siempre reproducible: el
 * mismo par (recurrencia, referencia) da siempre el mismo resultado.
 *
 * Todas las fechas/horas se interpretan en hora Colombia (America/Bogota,
 * UTC−5 fijo, sin DST) — mismo estándar corporativo que utils/fechas.js.
 */
import { extraerFechaColombia } from '../../utils/fechas.js';

const OFFSET_COL = '-05:00';

/** Cota de seguridad para la búsqueda del SIGUIENTE slot (calcularProximaEjecucion)
 *  — ~3 años. En uso real nunca debería alcanzarse: la búsqueda arranca en
 *  `referencia` (normalmente "ahora"), no en `fecha_inicio`, así que el salto
 *  más largo posible es ~31 días (mensual). Protege contra una recurrencia
 *  mal formada que nunca encuentra un día válido (loop infinito). NO se usa
 *  en contarSlotsHasta() — esa función necesita una cota exacta, ver abajo. */
const LIMITE_DIAS_BUSQUEDA = 1100;

// ─── Aritmética de fechas (YYYY-MM-DD), UTC-pura — mismo patrón que
// erp/src/utils/date.ts#sumarDias: nunca depende de la hora local del
// proceso, solo de los componentes numéricos de la fecha. ────────────────────

function diaSiguiente(fechaYMD) {
  const [y, m, d] = fechaYMD.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function diaDeLaSemana(fechaYMD) {
  // Mediodía UTC evita cualquier ambigüedad de rollover de fecha —
  // fechaYMD es un día calendario puro, no un instante.
  return new Date(`${fechaYMD}T12:00:00Z`).getUTCDay(); // 0=domingo..6=sábado
}

function diaDelMes(fechaYMD) {
  return Number(fechaYMD.split('-')[2]);
}

function ultimoDiaDelMes(fechaYMD) {
  const [y, m] = fechaYMD.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // día 0 del mes siguiente = último del actual
}

/** Días de calendario entre dos fechas YYYY-MM-DD (>= 0 si hasta >= desde). */
function diasEntre(desdeYMD, hastaYMD) {
  const [y1, m1, d1] = desdeYMD.split('-').map(Number);
  const [y2, m2, d2] = hastaYMD.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86_400_000);
}

/** Instante real (Date) de una fecha+hora en horario Colombia fijo (UTC−5). */
function construirInstanteColombia(fechaYMD, horaHHmm) {
  const [hh, mm] = horaHHmm.split(':');
  const iso = `${fechaYMD}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00${OFFSET_COL}`;
  return new Date(iso);
}

// ─── Validación de día según el tipo de recurrencia ────────────────────────────

/**
 * ¿`fechaYMD` es un día en que corresponde ejecutar, según `recurrencia`?
 * No considera la hora — solo el día calendario.
 *   - diaria:  cualquier día >= fecha_inicio.
 *   - semanal: solo los días de dias_semana.
 *   - mensual: el día dia_mes, o el último día del mes si dia_mes excede
 *     los días que tiene ese mes (ej. dia_mes=31 en febrero → día 28/29).
 */
export function esFechaValida(fechaYMD, recurrencia) {
  if (fechaYMD < recurrencia.fecha_inicio) return false;
  switch (recurrencia.tipo) {
    case 'diaria':
      return true;
    case 'semanal':
      return (recurrencia.dias_semana ?? []).includes(diaDeLaSemana(fechaYMD));
    case 'mensual': {
      const objetivo = Math.min(recurrencia.dia_mes ?? 1, ultimoDiaDelMes(fechaYMD));
      return diaDelMes(fechaYMD) === objetivo;
    }
    default:
      return false;
  }
}

/**
 * Cuenta cuántos slots válidos existen entre `fecha_inicio` (inclusive) y
 * el slot (fechaObjetivo, horaObjetivo) (inclusive) — usado únicamente por
 * `fin.modo === "repeticiones"` para saber si ese slot todavía cabe dentro
 * de `cantidad`. Cada hora configurada cuenta como un slot independiente.
 *
 * Cota EXACTA (no LIMITE_DIAS_BUSQUEDA): un reporte diario/semanal con
 * `fecha_inicio` de más de ~3 años de antigüedad superaría la cota de
 * búsqueda genérica y el conteo se cortaría antes de llegar a
 * `fechaObjetivo`, subestimando el ordinal — un reporte con `repeticiones`
 * ya agotadas seguiría pareciendo "dentro de la cantidad" y el scheduler lo
 * seguiría ejecutando indefinidamente. Aquí el número de iteraciones se
 * calcula a partir del rango real de fechas, sin techo artificial.
 */
function contarSlotsHasta(recurrencia, fechaObjetivo, horaObjetivo) {
  const horas = [...recurrencia.horas].sort();
  let contador = 0;
  let fecha = recurrencia.fecha_inicio;
  const maxIteraciones = Math.max(diasEntre(recurrencia.fecha_inicio, fechaObjetivo) + 1, 1);
  for (let i = 0; i < maxIteraciones && fecha <= fechaObjetivo; i++) {
    if (esFechaValida(fecha, recurrencia)) {
      contador += fecha === fechaObjetivo
        ? horas.filter(h => h <= horaObjetivo).length
        : horas.length;
    }
    if (fecha === fechaObjetivo) break;
    fecha = diaSiguiente(fecha);
  }
  return contador;
}

// ─── Cálculo principal ──────────────────────────────────────────────────────

/**
 * Calcula el siguiente instante de ejecución de un reporte.
 *
 * @param {object} recurrencia — ver estructura arriba.
 * @param {Date|null} referencia
 *   - `null`  → primera ejecución jamás programada (bootstrapping): devuelve
 *     el primer slot válido desde `fecha_inicio` inclusive.
 *   - `Date`  → reprogramación tras una ejecución (o tras el tick actual del
 *     scheduler): devuelve el primer slot ESTRICTAMENTE posterior a
 *     `referencia`. Usar la hora actual del tick (no el `proxima_ejecucion`
 *     vencido) evita reintentar en cascada slots atrasados tras una caída
 *     del proceso — un reporte que se atrasó se ejecuta una sola vez, y la
 *     siguiente programación mira hacia adelante desde "ahora", no desde el
 *     slot perdido.
 * @returns {Date|null} — `null` si no hay una próxima ejecución válida
 *   (recurrencia mal formada, o `fin` ya alcanzado — fecha límite superada o
 *   cantidad de repeticiones agotada).
 */
export function calcularProximaEjecucion(recurrencia, referencia = null) {
  if (!recurrencia?.tipo || !recurrencia.horas?.length || !recurrencia.fecha_inicio) {
    return null;
  }
  const horas = [...recurrencia.horas].sort();

  let fecha = recurrencia.fecha_inicio;
  if (referencia) {
    const fechaRef = extraerFechaColombia(referencia);
    if (fechaRef > fecha) fecha = fechaRef;
  }

  for (let i = 0; i < LIMITE_DIAS_BUSQUEDA; i++) {
    // Corte inmediato apenas se supera la fecha límite — sin esperar a que
    // ese día particular sea además un día válido de la cadencia.
    if (recurrencia.fin?.modo === 'fecha' && fecha > recurrencia.fin.fecha) {
      return null;
    }

    if (esFechaValida(fecha, recurrencia)) {
      for (const hora of horas) {
        const instante = construirInstanteColombia(fecha, hora);
        if (referencia && instante <= referencia) continue;

        if (recurrencia.fin?.modo === 'repeticiones') {
          const ordinal = contarSlotsHasta(recurrencia, fecha, hora);
          if (ordinal > recurrencia.fin.cantidad) return null;
        }
        return instante;
      }
    }
    fecha = diaSiguiente(fecha);
  }
  return null;
}
