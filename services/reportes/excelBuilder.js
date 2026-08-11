/**
 * services/reportes/excelBuilder.js — Generador Excel del motor de reportes (Fase 9C)
 *
 * Flujo:  obtenerDatosReporte(reporte, deps) → generarExcel(datos, reporte)
 *         → { buffer, filename, mimeType }
 *
 * Usa `exceljs`. El libro se arma íntegramente en memoria — nunca escribe a
 * disco ni a Supabase Storage (decisión Fase 9A §5.4: archivo efímero, se
 * adjunta al correo en una fase posterior).
 *
 * `generarExcel(datos, reporte)` es un builder puro: recibe la salida ya
 * resuelta de obtenerDatosReporte() (Fase 9B) — columnas, registros
 * filtrados y metadata — y no depende de sbFetch ni de ninguna otra
 * dependencia de datos. `generarExcelDeReporte(reporte, deps)` es el atajo
 * de conveniencia que encadena el pipeline completo cuando se tienen las
 * `deps` de datos a mano.
 */
import ExcelJS from 'exceljs';
import { camposDe } from './catalogoDatasets.js';
import { obtenerDatosReporte } from './index.js';
import { valorFecha, normalizarTextoDuplicado } from './valoresCelda.js';
import { construirNombreArchivo } from './nombreArchivo.js';

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Re-exportado para no romper imports existentes — la definición vive en
// nombreArchivo.js, compartida con htmlBuilder.js (Fase 9D).
export { construirNombreArchivo };

// Navy corporativo del ERP (--navy: #012A6B) en ARGB para el fondo del encabezado.
const COLOR_ENCABEZADO_FONDO = 'FF012A6B';
const COLOR_ENCABEZADO_TEXTO = 'FFFFFFFF';

// ─── Valores de celda por tipo de campo ────────────────────────────────────────

/**
 * Convierte el valor crudo de una fila al tipo de dato Excel apropiado,
 * según `campoInfo.tipo` del catálogo:
 *   - fecha    → Date real (Excel la reconoce como fecha nativa — permite
 *                ordenar/filtrar en el archivo, no solo texto con ese formato)
 *   - numero   → number real
 *   - booleano → "Sí"/"No" (legibilidad para el destinatario del correo —
 *                mismo criterio que formatCelda() de la Preview del wizard;
 *                un TRUE/FALSE de Excel es menos claro para el usuario final)
 *   - texto     → string, con duplicados idénticos separados por coma
 *                colapsados (ver normalizarTextoDuplicado — presentación
 *                únicamente, el dato fuente no se toca)
 *   - enum      → string, sin normalizar (valores fijos del catálogo, nunca
 *                llegan como lista separada por comas)
 * Valores vacíos siempre devuelven null (celda vacía, no la cadena "null").
 */
function valorCelda(valorCrudo, campoInfo) {
  if (valorCrudo === null || valorCrudo === undefined || valorCrudo === '') return null;

  switch (campoInfo?.tipo) {
    case 'fecha':
      return valorFecha(valorCrudo, campoInfo);
    case 'numero': {
      const n = Number(valorCrudo);
      return isNaN(n) ? String(valorCrudo) : n;
    }
    case 'booleano':
      return (valorCrudo === true || valorCrudo === 'true') ? 'Sí' : 'No';
    case 'texto':
      return normalizarTextoDuplicado(String(valorCrudo));
    default:
      return String(valorCrudo);
  }
}

// ─── Ancho de columnas ──────────────────────────────────────────────────────
//
// Autoajuste basado en el contenido real (título + valores de la columna),
// con límites razonables por tipo de dato del catálogo — nunca un ancho
// arbitrario fijo. Fecha y booleano tienen un ancho fijo derivado de su
// representación (dd/mm/yyyy, "Sí"/"No"): no varían con el contenido, así
// que no tiene sentido medirlos. Texto/enum/número se miden por el contenido
// real, acotados a un máximo — así una columna de observaciones largas no
// se vuelve gigante; en su lugar se activa wrapText para esa columna.
const ANCHO_MIN          = 10;
const ANCHO_FECHA        = 12; // "31/12/2026" (10) + margen
const ANCHO_BOOLEANO     = 8;  // "Sí" / "No"
const ANCHO_MAX_NUMERO   = 16;
const ANCHO_MAX_ENUM     = 24;
const ANCHO_MAX_TEXTO    = 45;

/**
 * @returns {{width: number, wrap: boolean}} — `wrap` es true cuando el
 *   contenido real excede el ancho máximo permitido para ese tipo: el
 *   límite evita una columna gigante, wrapText evita que ese contenido más
 *   largo quede cortado sin poder leerse.
 */
function calcularAnchoColumna(columna, campoInfo, registros) {
  const tituloLen = columna.titulo.length;

  if (campoInfo?.tipo === 'fecha')    return { width: Math.max(ANCHO_FECHA, tituloLen + 2), wrap: false };
  if (campoInfo?.tipo === 'booleano') return { width: Math.max(ANCHO_BOOLEANO, tituloLen + 2), wrap: false };

  const anchoMax = campoInfo?.tipo === 'numero' ? ANCHO_MAX_NUMERO
    : campoInfo?.tipo === 'enum' ? ANCHO_MAX_ENUM
    : ANCHO_MAX_TEXTO; // texto y cualquier tipo no reconocido

  const contenidoMax = registros.reduce((max, fila) => {
    const crudo = fila[columna.campo];
    if (crudo === null || crudo === undefined || crudo === '') return max;
    const texto = campoInfo?.tipo === 'texto'
      ? normalizarTextoDuplicado(String(crudo))
      : String(crudo);
    return Math.max(max, texto.length);
  }, tituloLen);

  const width = Math.min(Math.max(contenidoMax + 2, ANCHO_MIN), anchoMax);
  const wrap  = contenidoMax + 2 > anchoMax; // el contenido no cabe → wrap ayuda a leerlo completo
  return { width, wrap };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Genera el archivo Excel a partir de la salida de obtenerDatosReporte().
 * Builder puro — no hace fetch de datos, no conoce `deps`.
 *
 * @param {{
 *   columnas:  Array<{campo: string, titulo: string}>,
 *   registros: Array<Record<string, unknown>>,
 *   metadata:  {tipoReporte: string, fechaEjecucion: string, [k: string]: unknown},
 * }} datos — salida de obtenerDatosReporte() (Fase 9B): columnas ya
 *   resueltas (campo/título/orden) y registros ya filtrados.
 * @param {{nombre?: string, tipo_reporte?: string}} reporte — fila de
 *   reportes_automaticos, usada solo para el nombre del archivo.
 * @returns {Promise<{buffer: Buffer, filename: string, mimeType: string}>}
 */
export async function generarExcel(datos, reporte) {
  const { columnas, registros, metadata } = datos;
  const campos = camposDe(metadata?.tipoReporte);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INLOP — Reportes Automáticos';
  workbook.created = new Date();

  const hoja = workbook.addWorksheet('Reporte', {
    views: [{ state: 'frozen', ySplit: 1 }], // congela la fila de encabezados al desplazar
  });

  // Columnas: título configurado como encabezado, campo como key interna,
  // orden = orden del array `columnas` (ya resuelto por columnResolver.js).
  // Ancho autoajustado según contenido real y tipo de dato del catálogo —
  // ver calcularAnchoColumna().
  const anchosColumnas = columnas.map(c => calcularAnchoColumna(c, campos[c.campo], registros));
  hoja.columns = columnas.map((c, idx) => ({
    header: c.titulo,
    key:    c.campo,
    width:  anchosColumnas[idx].width,
  }));

  // Registros ya filtrados — se proyectan tal cual, sin volver a filtrar ni reordenar.
  for (const fila of registros) {
    const filaExcel = {};
    for (const c of columnas) {
      filaExcel[c.campo] = valorCelda(fila[c.campo], campos[c.campo]);
    }
    hoja.addRow(filaExcel);
  }

  // Encabezado con identidad INLOP: negrita, fondo navy, texto blanco.
  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.font      = { bold: true, color: { argb: COLOR_ENCABEZADO_TEXTO } };
  filaEncabezado.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO_FONDO } };
  filaEncabezado.alignment = { vertical: 'middle' };

  // Formato de fecha nativo (dd/mm/yyyy) en las columnas cuyo campo es tipo fecha;
  // wrapText solo en las columnas cuyo contenido excede el ancho máximo
  // permitido (calcularAnchoColumna) — evita cortar texto largo sin volver
  // gigante la columna.
  columnas.forEach((c, idx) => {
    const columnaExcel = hoja.getColumn(idx + 1);
    if (campos[c.campo]?.tipo === 'fecha') {
      columnaExcel.numFmt = 'dd/mm/yyyy';
    }
    if (anchosColumnas[idx].wrap) {
      columnaExcel.alignment = { wrapText: true, vertical: 'top' };
    }
  });

  const raw = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

  return {
    buffer,
    filename: construirNombreArchivo(reporte, metadata, 'xlsx'),
    mimeType: MIME_XLSX,
  };
}

/**
 * Atajo de conveniencia: encadena el pipeline completo
 * obtenerDatosReporte(reporte, deps) → generarExcel() cuando se tienen las
 * `deps` de datos a mano (sbFetch, caché de viajes, etc. — ver Fase 9B).
 */
export async function generarExcelDeReporte(reporte, deps = {}) {
  const datos = await obtenerDatosReporte(reporte, deps);
  return generarExcel(datos, reporte);
}
