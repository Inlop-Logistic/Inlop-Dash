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

/**
 * Colapsa repeticiones idénticas dentro de un valor de texto separado por
 * comas — corrige un patrón real de datos de origen (TMS): algunos campos de
 * texto (ej. `company_customer_name`) llegan con el mismo valor repetido,
 * como "FRONTERA ENERGY COLOMBIA CORP, FRONTERA ENERGY COLOMBIA CORP".
 *
 * Solo presentación: no modifica el dato fuente (opera sobre una copia del
 * string, en el momento de formatear la celda) ni inventa valores — se
 * limita a eliminar repeticiones EXACTAS (tras trim, sin distinguir
 * mayúsculas) del mismo texto, conservando el primer token visto y el orden
 * de aparición. Un valor sin comas, o cuyos tokens son todos distintos,
 * vuelve sin cambios.
 */
export function normalizarTextoDuplicado(valor) {
  if (typeof valor !== 'string' || !valor.includes(',')) return valor;

  const partes = valor.split(',').map(p => p.trim()).filter(p => p !== '');
  const vistos = new Set();
  const unicas = [];
  for (const parte of partes) {
    const clave = parte.toLowerCase();
    if (!vistos.has(clave)) {
      vistos.add(clave);
      unicas.push(parte);
    }
  }
  return unicas.join(', ');
}
