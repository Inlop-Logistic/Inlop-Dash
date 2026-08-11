/**
 * services/reportes/htmlBuilder.js — Generador HTML del motor de reportes (Fase 9D)
 *
 * Flujo:  obtenerDatosReporte(reporte, deps) → generarHtml(datos, reporte)
 *         → { buffer, filename, mimeType }
 *
 * Dos formatos configurables en reportes_automaticos.formato:
 *   html_filas    → tabla tradicional: columnas = campos resueltos,
 *                   encabezados = título, orden = orden, filas = registros.
 *   html_columnas → transpuesto: cada registro es una columna, cada campo
 *                   es una fila, la primera columna es el título del campo.
 *
 * Reutiliza exactamente `columnas`/`registros` de obtenerDatosReporte()
 * (Fase 9B) — no vuelve a filtrar ni a resolver columnas. HTML
 * autocontenido (una sola <style> embebida, sin recursos externos), con
 * escape HTML obligatorio en todo dato de fila y todo texto configurado
 * por el usuario (título de columna, nombre del reporte).
 *
 * Igual que excelBuilder.js: `generarHtml(datos, reporte, formato?)` es un
 * builder puro (no depende de `deps` de datos); `generarHtmlDeReporte`
 * encadena el pipeline completo cuando sí se tienen esas `deps`. Archivo
 * generado enteramente en memoria (Buffer) — nunca disco ni Storage
 * (decisión Fase 9A §5.4).
 */
import { extraerFechaColombia } from '../../utils/fechas.js';
import { valorFecha } from './valoresCelda.js';
import { construirNombreArchivo } from './nombreArchivo.js';
import { camposDe } from './catalogoDatasets.js';
import { obtenerDatosReporte } from './index.js';

export const MIME_HTML = 'text/html';

// Misma paleta corporativa que services/email/templates.js.
const NAVY   = '#012A6B';
const GRAY   = '#6B7280';
const BORDE  = '#E5E7EB';
const ZEBRA  = '#F8F9FB';

// ─── Escape HTML ────────────────────────────────────────────────────────────
// Obligatorio en todo valor que provenga de datos o de configuración del
// usuario (título de columna, nombre del reporte) — nunca se interpreta
// como markup.

export function escapeHtml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Formato de valores como texto ──────────────────────────────────────────

function formatearFechaDDMMYYYY(valorCrudo, campoInfo) {
  const d = valorFecha(valorCrudo, campoInfo);
  if (!d) return '';
  const [y, m, day] = extraerFechaColombia(d).split('-');
  return `${day}/${m}/${y}`;
}

/**
 * Mismo criterio de tipos que excelBuilder.js, pero representado como
 * texto (HTML no tiene un tipo de dato "fecha" o "número" nativo):
 *   - fecha    → DD/MM/YYYY
 *   - booleano → "Sí"/"No" (mismo criterio que excelBuilder/Preview)
 *   - texto/enum/numero → String(valor)
 *   - vacío (null/undefined/'') → cadena vacía — celda vacía, sin
 *     placeholder "—" (regla explícita de Fase 9D, distinta de la Preview
 *     del wizard que sí usa "—" para legibilidad en pantalla).
 */
function formatearValorTexto(valorCrudo, campoInfo) {
  if (valorCrudo === null || valorCrudo === undefined || valorCrudo === '') return '';
  switch (campoInfo?.tipo) {
    case 'fecha':
      return formatearFechaDDMMYYYY(valorCrudo, campoInfo);
    case 'booleano':
      return (valorCrudo === true || valorCrudo === 'true') ? 'Sí' : 'No';
    default:
      return String(valorCrudo);
  }
}

// ─── Documento base ──────────────────────────────────────────────────────────

function documentoBase(tituloReporte, cuerpoHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tituloReporte)}</title>
<style>
  body { margin: 0; padding: 24px; background: #F8F9FB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1F2937; }
  .contenedor { max-width: 100%; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); border: 1px solid ${BORDE}; }
  .encabezado { background: ${NAVY}; color: #fff; padding: 16px 20px; font-size: 16px; font-weight: 700; letter-spacing: 0.01em; }
  .meta { padding: 10px 20px; font-size: 12px; color: ${GRAY}; border-bottom: 1px solid ${BORDE}; }
  .tabla-scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid ${BORDE}; white-space: nowrap; }
  thead th { background: #F1F3F7; color: ${GRAY}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
  tbody th[scope="row"] { background: #F1F3F7; color: #374151; font-weight: 600; white-space: nowrap; }
  tbody tr:nth-child(even) td { background: ${ZEBRA}; }
  .vacio { padding: 24px 20px; text-align: center; color: ${GRAY}; font-size: 13px; }
  .pie { padding: 12px 20px; font-size: 11px; color: ${GRAY}; border-top: 1px solid ${BORDE}; }
</style>
</head>
<body>
  <div class="contenedor">
    <div class="encabezado">${escapeHtml(tituloReporte)}</div>
    ${cuerpoHtml}
    <div class="pie">INLOP · Ecosistema Logístico — Reportes Automáticos</div>
  </div>
</body>
</html>`;
}

function metaLinea(registros, metadata) {
  const n = registros.length;
  return `<div class="meta">${n} registro${n !== 1 ? 's' : ''}${
    metadata?.fechaEjecucion ? ` · generado ${escapeHtml(metadata.fechaEjecucion)}` : ''
  }</div>`;
}

function tituloDe(reporte, metadata) {
  return reporte?.nombre || reporte?.tipo_reporte || metadata?.tipoReporte || 'Reporte';
}

// ─── html_filas — tabla tradicional ─────────────────────────────────────────
//
// columnas = campos resueltos por columnResolver.js; encabezados = título;
// orden = orden ya resuelto; filas = registros ya filtrados. No se vuelve a
// filtrar ni a reordenar nada aquí.

export function generarHtmlFilas(datos, reporte) {
  const { columnas, registros, metadata } = datos;
  const campos = camposDe(metadata?.tipoReporte);
  const tituloReporte = tituloDe(reporte, metadata);

  const encabezados = columnas.map(c => `<th>${escapeHtml(c.titulo)}</th>`).join('');

  const filasHtml = registros.map(fila => {
    const celdas = columnas
      .map(c => `<td>${escapeHtml(formatearValorTexto(fila[c.campo], campos[c.campo]))}</td>`)
      .join('');
    return `<tr>${celdas}</tr>`;
  }).join('');

  const cuerpo = `
    ${metaLinea(registros, metadata)}
    <div class="tabla-scroll">
      <table>
        <thead><tr>${encabezados}</tr></thead>
        <tbody>${filasHtml}</tbody>
      </table>
    </div>
    ${registros.length === 0 ? '<div class="vacio">Sin registros para este reporte.</div>' : ''}
  `;

  return documentoBase(tituloReporte, cuerpo);
}

// ─── html_columnas — formato transpuesto ────────────────────────────────────
//
// Cada registro se vuelve una columna; cada campo se vuelve una fila; la
// primera columna de cada fila es el título del campo (como encabezado de
// fila, <th scope="row">). Reutiliza las mismas `columnas`/`registros`
// resueltas por 9B — el único cambio es la orientación de la tabla.

export function generarHtmlColumnas(datos, reporte) {
  const { columnas, registros, metadata } = datos;
  const campos = camposDe(metadata?.tipoReporte);
  const tituloReporte = tituloDe(reporte, metadata);

  const encabezadosRegistros = registros.map((_, i) => `<th>Registro ${i + 1}</th>`).join('');

  const filasHtml = columnas.map(c => {
    const celdas = registros
      .map(fila => `<td>${escapeHtml(formatearValorTexto(fila[c.campo], campos[c.campo]))}</td>`)
      .join('');
    return `<tr><th scope="row">${escapeHtml(c.titulo)}</th>${celdas}</tr>`;
  }).join('');

  const cuerpo = `
    ${metaLinea(registros, metadata)}
    <div class="tabla-scroll">
      <table>
        <thead><tr><th>Campo</th>${encabezadosRegistros}</tr></thead>
        <tbody>${filasHtml}</tbody>
      </table>
    </div>
    ${registros.length === 0 ? '<div class="vacio">Sin registros para este reporte.</div>' : ''}
  `;

  return documentoBase(tituloReporte, cuerpo);
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Genera el archivo HTML a partir de la salida de obtenerDatosReporte().
 * Builder puro — no hace fetch de datos, no conoce `deps`.
 *
 * @param {{columnas: Array, registros: Array, metadata: Object}} datos —
 *   salida de obtenerDatosReporte() (Fase 9B).
 * @param {{nombre?: string, tipo_reporte?: string, formato?: string}} reporte
 * @param {'html_filas'|'html_columnas'} [formatoOverride] — si se omite, se
 *   usa `reporte.formato`; cualquier valor que no sea 'html_columnas' cae a
 *   la tabla tradicional (html_filas).
 * @returns {{buffer: Buffer, filename: string, mimeType: string}}
 */
export function generarHtml(datos, reporte, formatoOverride) {
  const formato = formatoOverride ?? reporte?.formato;
  const html = formato === 'html_columnas'
    ? generarHtmlColumnas(datos, reporte)
    : generarHtmlFilas(datos, reporte);

  return {
    buffer:   Buffer.from(html, 'utf-8'),
    filename: construirNombreArchivo(reporte, datos.metadata, 'html'),
    mimeType: MIME_HTML,
  };
}

/**
 * Atajo de conveniencia: encadena el pipeline completo
 * obtenerDatosReporte(reporte, deps) → generarHtml() cuando se tienen las
 * `deps` de datos a mano (sbFetch, caché de viajes, etc. — ver Fase 9B).
 */
export async function generarHtmlDeReporte(reporte, deps = {}) {
  const datos = await obtenerDatosReporte(reporte, deps);
  return generarHtml(datos, reporte);
}
