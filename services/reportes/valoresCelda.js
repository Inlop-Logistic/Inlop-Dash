/**
 * services/reportes/valoresCelda.js — Interpretación de valores de celda
 * compartida entre los builders del generador de reportes (Excel — Fase 9C;
 * HTML — Fase 9D).
 *
 * Cada builder decide cómo REPRESENTAR el valor ya interpretado (Date real
 * en Excel, texto DD/MM/YYYY en HTML) — esta función solo resuelve el valor
 * a partir del formato real de transporte del campo, para que el parseo de
 * fechas no se duplique entre ambos builders (ni con filterEngine.js, que
 * usa el mismo criterio para comparar en los filtros).
 */
import { parseFechaTMS } from '../../utils/fechas.js';

/**
 * Fecha real (Date) a partir del valor crudo, respetando el formato real de
 * transporte del campo (mdy|dmy|iso) — mismo criterio que
 * filterEngine.js#fechaCampoYMD.
 */
export function valorFecha(valorCrudo, campoInfo) {
  if (valorCrudo === null || valorCrudo === undefined || valorCrudo === '') return null;
  const formato = campoInfo?.formatoFecha ?? 'iso';
  if (formato === 'iso') {
    const d = new Date(valorCrudo);
    return isNaN(d.getTime()) ? null : d;
  }
  return parseFechaTMS(valorCrudo, formato === 'mdy' ? 'MDY' : 'DMY');
}
