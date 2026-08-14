/**
 * services/reportes/filterEngine.js — Motor de filtros del generador (Fase 9B)
 *
 * Puerto backend, sin cambios de semántica, de la lógica ya validada en el
 * wizard (Fase 8D — erp/src/modules/configuracion/services/api.ts:
 * evaluaCondicion / aplicarFiltros / fechaCampoYMD). Mismos operadores,
 * mismo criterio AND, misma comparación de fechas por formato real de
 * transporte, mismo tratamiento de filtros incompletos o de un reporte
 * anterior. No se introduce ningún catálogo de filtros nuevo — la metadata
 * de campo (tipo, filtrable) viene de catalogoDatasets.js, la proyección
 * backend de datasetsReportes.ts.
 *
 * Los parsers de fecha (parseFechaTMS, extraerFechaColombia) NO se
 * duplican: son los mismos utils/fechas.js que ya usa el resto del backend
 * (mismo estándar corporativo que erp/src/utils/parseFecha.ts + date.ts).
 */
import { parseFechaTMS, extraerFechaColombia } from '../../utils/fechas.js';
import { camposDe } from './catalogoDatasets.js';

/** Fecha de un campo, normalizada a YYYY-MM-DD en hora Colombia, o null si no es parseable. */
export function fechaCampoYMD(valor, campoInfo) {
  if (valor === null || valor === undefined || valor === '') return null;
  const formato = campoInfo?.formatoFecha ?? 'iso';
  if (formato === 'iso') {
    const d = new Date(valor);
    return isNaN(d.getTime()) ? null : extraerFechaColombia(d);
  }
  const d = parseFechaTMS(valor, formato === 'mdy' ? 'MDY' : 'DMY');
  return d ? extraerFechaColombia(d) : null;
}

/**
 * Evalúa una condición de filtro contra una fila. Un filtro sin campo, sin
 * metadata reconocida, o sin valor configurado (aún incompleto en el
 * wizard) no restringe resultados — mismo criterio que Preview (8D).
 */
export function evaluaCondicion(fila, filtro, campoInfo) {
  if (!filtro.campo || !campoInfo) return true;

  // ── Campos de fecha: comparación por día calendario (Colombia) ──────────
  if (campoInfo.tipo === 'fecha') {
    const ymd = fechaCampoYMD(fila[filtro.campo], campoInfo);
    switch (filtro.operador) {
      case 'es':
        return !filtro.valor || (ymd !== null && ymd === filtro.valor);
      case 'antes_de':
        return !filtro.valor || (ymd !== null && ymd < filtro.valor);
      case 'despues_de':
        return !filtro.valor || (ymd !== null && ymd > filtro.valor);
      case 'entre': {
        if (!filtro.valor_desde && !filtro.valor_hasta) return true;
        if (ymd === null) return false;
        if (filtro.valor_desde && ymd < filtro.valor_desde) return false;
        if (filtro.valor_hasta && ymd > filtro.valor_hasta) return false;
        return true;
      }
      default:
        return true;
    }
  }

  // ── Booleano: presencia/ausencia de valor ────────────────────────────────
  if (filtro.operador === 'tiene_valor' || filtro.operador === 'sin_valor') {
    const valor = fila[filtro.campo];
    const tieneValor = valor !== null && valor !== undefined && valor !== '' && valor !== false;
    return filtro.operador === 'tiene_valor' ? tieneValor : !tieneValor;
  }

  // ── Multi-selección ("en"): coincide si el valor de la fila está entre
  // los elegidos (Fase 11A — filtro "Cliente"). Para tipo "cliente" compara
  // contra `cliente_normalizado` (agregado por enriquecerFilas en
  // datasetProvider.js), no contra el nombre crudo — así "Productos Ramo
  // SAS" y "Productos Ramo S.A.S." cuentan como el mismo cliente elegido.
  // Sin valores elegidos ("Todos" en el wizard) no restringe.
  if (filtro.operador === 'en') {
    if (!filtro.valores || filtro.valores.length === 0) return true;
    const valorComparar = campoInfo.tipo === 'cliente'
      ? String(fila.cliente_normalizado ?? '')
      : String(fila[filtro.campo] ?? '');
    return filtro.valores.includes(valorComparar);
  }

  // ── Texto / enum: igualdad exacta ────────────────────────────────────────
  const valorStr = fila[filtro.campo] === null || fila[filtro.campo] === undefined
    ? ''
    : String(fila[filtro.campo]);
  if (filtro.operador === 'es')    return !filtro.valor || valorStr === filtro.valor;
  if (filtro.operador === 'no_es') return !filtro.valor || valorStr !== filtro.valor;

  return true;
}

/**
 * Aplica todos los `filtros` a `filas` en condición AND (mismo criterio que
 * EtapaFiltros: "se aplicarán todos los filtros"). Ignora filtros cuyo campo
 * no es filtrable para `tipoReporte` — evita restos de un reporte anterior.
 * Sin filtros → devuelve las filas sin tocar.
 */
export function aplicarFiltros(filas, filtros, tipoReporte) {
  if (!filtros || filtros.length === 0) return filas;

  const campos = camposDe(tipoReporte);
  const activos = filtros.filter(f => f.campo && campos[f.campo]?.filtrable);
  if (activos.length === 0) return filas;

  return filas.filter(fila =>
    activos.every(f => evaluaCondicion(fila, f, campos[f.campo]))
  );
}
