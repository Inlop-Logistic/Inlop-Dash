/**
 * ob-excel-parser.js — Parser de carga masiva · Módulo Obligaciones Financieras
 * INLOP · Integral Logistics Operations SAS
 * Versión: 1.1.0 — Junio 2026
 *
 * DEPENDENCIAS (cargar en este orden en obligaciones.html):
 *   1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
 *   2. ../js/supabase.js        → window.INLOP.sb
 *   3. ../js/ob-services.js     → window.OB
 *   4. https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
 *   5. ../js/ob-excel-parser.js ← este archivo
 *
 * INTEGRACIÓN:
 *   obligaciones.html → obLeerExcel(file) → window.OB.obParseExcel(wb, filename)
 *   Este archivo extiende window.OB con ese método sin modificar ob-services.js.
 *
 * PIPELINE:
 *   A. PARSE      → detectar hoja, detectar cabecera, leer matrix
 *   B. CATALOGS   → cargar categorías/proveedores/obligaciones desde Supabase
 *   C. TRANSFORM  → normalizar cada fila: sede, dia_pago, frecuencia, categoria
 *   D. VALIDATE   → campos obligatorios + categoría existente en DB
 *   E. DEDUP      → cotejar contra catálogos en memoria
 *   F. LOAD       → crear proveedores nuevos → crear obligaciones nuevas
 *   G. AUDIT      → registrar en ob_auditoria
 *   H. SUMMARY    → modal con KPIs + tabla de errores
 *
 * DATOS CONFIRMADOS DEL XLSX (PAGOS_RECURRENTES.xlsx · hoja "GASTOS FIJOS"):
 *   34 obligaciones válidas · 24 proveedores únicos (todos con NIT excepto 1)
 *   18 sub-filas informativas ignoradas (empleados de líneas móviles)
 *   20 tipos de categoría → todos mapeados a los 15 códigos del seed
 *
 * CONVENCIONES INLOP:
 *   - var en scope global (no const/let)
 *   - Prefijo funciones: obXl*
 *   - Variables globales: OBX_*
 *   - Sin console.log en producción
 *   - Patrón resultado: { ok, data, error }
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════
   1. ESTADO DEL PARSER (variables globales OBX_*)
   ══════════════════════════════════════════════════════════════════ */

var OBX_RESULTADO    = null;   // resultado de la última importación
var OBX_CATEGORIAS   = [];     // catálogo cargado de ob_categorias
var OBX_PROVEEDORES  = [];     // catálogo cargado de ob_proveedores
var OBX_OBLIGACIONES = [];     // catálogo cargado de ob_obligaciones

/* ══════════════════════════════════════════════════════════════════
   2. TABLAS DE NORMALIZACIÓN
   ══════════════════════════════════════════════════════════════════ */

/**
 * Mapeo Tipo-del-Excel → código de ob_categorias.
 * Cubre todos los tipos encontrados en PAGOS_RECURRENTES.xlsx incluyendo
 * los prefijos de número de cuenta de telefonía (ej: "8988964210-80 SERVICIO…").
 * Las claves se comparan en UPPERCASE después de limpiar espacios y NBSP.
 */
var OBX_TIPO_A_CODIGO = {
  'ADMINISTRACION':                   'ADMINISTRACION',
  'ADMINISTRACIÓN':                   'ADMINISTRACION',
  'ARRIENDO':                         'ARRIENDO',
  'ASEO':                             'ASEO',
  'LIBRANZA':                         'LIBRANZA',
  'POLIZAS':                          'POLIZAS',
  'PÓLIZAS':                          'POLIZAS',
  'SERVICIO PROFESIONAL OUTSORCING':  'OUTSOURCING',
  'SERVICIO PROFESIONAL OUTSOURCING': 'OUTSOURCING',
  'OUTSOURCING':                      'OUTSOURCING',
  'SERVICIOS PUBLICOS':               'SERVICIOS_PUBLICOS',
  'SERVICIOS PÚBLICOS':               'SERVICIOS_PUBLICOS',
  'SERVICIOS_PUBLICOS':               'SERVICIOS_PUBLICOS',
  'SOFTWARE':                         'SOFTWARE',
  'SOPORTE TECNICO':                  'SOPORTE_TI',
  'SOPORTE TÉCNICO':                  'SOPORTE_TI',
  'SOPORTE TECNICO V2':               'SOPORTE_TI',
  'SOPORTE_TI':                       'SOPORTE_TI',
  'ASESORIA COMERCIAL':               'ASESORIA',
  'ASESORÍA COMERCIAL':               'ASESORIA',
  'ASESORIA':                         'ASESORIA',
  'INSPECION DE SEGURIDAD':           'SEGURIDAD',
  'INSPECCIÓN DE SEGURIDAD':          'SEGURIDAD',
  'ASISTENCIA TECNICA INSPECION DE SEGURIDAD': 'SEGURIDAD',
  'SEGURIDAD':                        'SEGURIDAD',
  'CUOTA DE SOSTENIMIENTO':           'CUOTA_GREMIAL',
  'CUOTA_GREMIAL':                    'CUOTA_GREMIAL',
  // Telefonía: variantes exactas encontradas en el xlsx
  'SERVICIO LINEA COPORATIVA':        'TELEFONIA',   // typo original
  'SERVICIO LINEA CORPORATIVA':       'TELEFONIA',
  'TELEFONIA':                        'TELEFONIA',
  'TELEFONÍA':                        'TELEFONIA',
  'PRESTAMOS BANCARIOS':              'DEUDA_BANCARIA',
  'PRÉSTAMOS BANCARIOS':              'DEUDA_BANCARIA',
  'DEUDA_BANCARIA':                   'DEUDA_BANCARIA',
  'TARJETA DE CREDITO':               'TARJETA_CREDITO',
  'TARJETA DE CRÉDITO':               'TARJETA_CREDITO',
  'TARJETA_CREDITO':                  'TARJETA_CREDITO',
};

/**
 * Normalización de frecuencias (absorbe typos y espacios del xlsx).
 */
var OBX_FREC_NORM = {
  'MENSUAL':   'mensual',
  'MENSUL':    'mensual',    // typo fila 6 del xlsx
  ' MENSUAL':  'mensual',
  'MENSUAL ':  'mensual',
  'SEMANAL':   'semanal',
  'QUINCENAL': 'quincenal',
};

/**
 * Mapeo nombre-de-día → índice 0-6 (lunes=0, domingo=6).
 */
var OBX_DIA_SEMANA = {
  'LUNES':     0,
  'MARTES':    1,
  'MIERCOLES': 2,
  'MIÉRCOLES': 2,
  'JUEVES':    3,
  'VIERNES':   4,
  'SABADO':    5,
  'SÁBADO':    5,
  'DOMINGO':   6,
};

/**
 * Detección de sede desde el campo Detalle.
 * Se evalúan en orden; primera coincidencia gana.
 */
var OBX_SEDE_KWORDS = [
  { re: /CARTAGENA/i, sede: 'cartagena' },
  { re: /BOGOT[AÁ]/i, sede: 'bogota'   },
  { re: /YOPAL/i,     sede: 'yopal'    },
  { re: /NACIONAL/i,  sede: 'nacional' },
];

/**
 * Nombres de hojas aceptados (case-insensitive, búsqueda por contención).
 */
var OBX_HOJAS_VALIDAS = ['GASTOS FIJOS', 'GASTOS', 'OBLIGACIONES', 'PAGOS', 'RECURRENTES'];

/**
 * Aliases para detección automática de cabecera.
 * Clave = nombre canónico interno; valor = substrings a buscar (lowercase).
 */
var OBX_HEADER_ALIASES = {
  nit:        ['id', 'nit', 'rut', 'cedula', 'cédula', 'identificacion'],
  proveedor:  ['nombre proveedor', 'proveedor', 'razón social', 'razon social', 'empresa'],
  detalle:    ['detalle', 'descripcion', 'descripción', 'concepto', 'servicio'],
  tipo:       ['tipo', 'categoria', 'categoría', 'category'],
  fecha:      ['fecha de pago', 'fecha limite', 'fecha límite', 'fecha', 'dia pago'],
  frecuencia: ['frecuencia', 'freciencia', 'periodicidad', 'recurrencia'],
};

/* ══════════════════════════════════════════════════════════════════
   3. UTILIDADES INTERNAS
   ══════════════════════════════════════════════════════════════════ */

/** Limpia una celda: elimina NBSP, espacios múltiples. */
function obXlStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Convierte valor de celda NIT a string numérico limpio o null. */
function obXlNit(val) {
  if (val === null || val === undefined || val === '') return null;
  var s = String(val).replace(/\D/g, '').trim();
  return s.length > 0 ? s : null;
}

/** Genera nombre_corto en title case, máx 22 chars. */
function obXlNombreCorto(razonSocial) {
  var s = obXlStr(razonSocial);
  if (!s) return '—';
  s = s.toLowerCase().replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  return s.length > 22 ? s.substring(0, 22).trim() : s;
}

/** Detecta sede desde el texto del campo Detalle. */
function obXlDetectarSede(detalle) {
  var d = obXlStr(detalle).toUpperCase();
  for (var i = 0; i < OBX_SEDE_KWORDS.length; i++) {
    if (OBX_SEDE_KWORDS[i].re.test(d)) return OBX_SEDE_KWORDS[i].sede;
  }
  return 'nacional';
}

/**
 * Parsea "Fecha de pago limite" → { dia_pago, dia_semana }.
 * Soporta: "N DE CADA MES", "DÍA DE CADA SEMANA", "NÚMERO-TEXTO SERVICIO…"
 */
function obXlParsearFecha(raw, frecNorm) {
  var s = obXlStr(raw).toUpperCase();
  // Extraer número al inicio (cubre "10 DE CADA MES" y "8988964210-80 SERVICIO…" → toma el primer número corto)
  var numMatch = s.match(/^(\d{1,2})\s/);
  if (numMatch) {
    var dia = parseInt(numMatch[1], 10);
    if (dia >= 1 && dia <= 31) return { dia_pago: dia, dia_semana: null };
  }
  // Nombre de día
  var dias = Object.keys(OBX_DIA_SEMANA);
  for (var i = 0; i < dias.length; i++) {
    if (s.indexOf(dias[i]) !== -1) return { dia_pago: null, dia_semana: OBX_DIA_SEMANA[dias[i]] };
  }
  // Semanal sin día → lunes
  if (frecNorm === 'semanal') return { dia_pago: null, dia_semana: 0 };
  return { dia_pago: null, dia_semana: null };
}

/** Normaliza frecuencia absorbiendo typos del xlsx. */
function obXlNormFrecuencia(raw) {
  var s = obXlStr(raw).toUpperCase().trim();
  return OBX_FREC_NORM[s] || 'mensual';
}

/**
 * Determina el código de categoría a partir del campo Tipo.
 * Orden de búsqueda:
 *   1. Lookup exacto en OBX_TIPO_A_CODIGO
 *   2. El valor contiene una clave conocida (cubre "N° SERVICIO LINEA CORPORATIVA")
 *   3. Alguna clave conocida contiene el valor
 *   4. Devuelve el valor normalizado como código (fallback registrable)
 */
function obXlMapearCategoria(raw) {
  var s = obXlStr(raw).toUpperCase().replace(/\u00A0/g, '').trim();
  if (!s) return null;
  // 1. Exacto
  if (OBX_TIPO_A_CODIGO[s]) return OBX_TIPO_A_CODIGO[s];
  // 2. Valor contiene clave
  var claves = Object.keys(OBX_TIPO_A_CODIGO);
  for (var i = 0; i < claves.length; i++) {
    if (s.indexOf(claves[i]) !== -1) return OBX_TIPO_A_CODIGO[claves[i]];
  }
  // 3. Clave contiene valor
  for (var j = 0; j < claves.length; j++) {
    if (claves[j].indexOf(s) !== -1) return OBX_TIPO_A_CODIGO[claves[j]];
  }
  // 4. Fallback
  return s.replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').substring(0, 40) || 'SIN_CLASIFICAR';
}

/**
 * Detecta columnas relevantes en una fila de cabecera.
 * Retorna { nit, proveedor, detalle, tipo, fecha, frecuencia } con índices (−1 = no encontrado).
 */
function obXlDetectarColumnas(headerRow) {
  var idx = { nit: -1, proveedor: -1, detalle: -1, tipo: -1, fecha: -1, frecuencia: -1 };
  for (var col = 0; col < headerRow.length; col++) {
    var celda = obXlStr(headerRow[col]).toLowerCase().trim();
    if (!celda) continue;
    var campos = Object.keys(idx);
    for (var ci = 0; ci < campos.length; ci++) {
      var campo = campos[ci];
      if (idx[campo] !== -1) continue;
      var aliases = OBX_HEADER_ALIASES[campo];
      for (var ai = 0; ai < aliases.length; ai++) {
        if (celda.indexOf(aliases[ai]) !== -1 || aliases[ai].indexOf(celda) !== -1) {
          idx[campo] = col;
          break;
        }
      }
    }
  }
  return idx;
}

/**
 * Fila ignorable: tiene algún contenido pero NO tiene Proveedor+Tipo+Fecha.
 * Cubre las sub-filas informativas de empleados de Comcel/Colombia Móvil.
 */
function obXlEsSubFila(cols, row) {
  var tieneProveedor = cols.proveedor >= 0 && obXlStr(row[cols.proveedor]);
  var tieneTipo      = cols.tipo      >= 0 && obXlStr(row[cols.tipo]);
  var tieneFecha     = cols.fecha     >= 0 && obXlStr(row[cols.fecha]);
  return !tieneProveedor || !tieneTipo || !tieneFecha;
}

/** Busca proveedor en catálogo local por NIT (prioritario) o nombre exacto. */
function obXlBuscarProveedorLocal(nit, razonSocial) {
  var rsNorm = razonSocial ? razonSocial.toUpperCase().trim() : '';
  for (var i = 0; i < OBX_PROVEEDORES.length; i++) {
    var p = OBX_PROVEEDORES[i];
    if (nit && p.nit === nit) return p;
    if (!nit && rsNorm && (p.razon_social || '').toUpperCase().trim() === rsNorm) return p;
  }
  // Segunda pasada: buscar por NIT aunque la primera fue por nombre
  if (nit) {
    for (var j = 0; j < OBX_PROVEEDORES.length; j++) {
      if (OBX_PROVEEDORES[j].nit === nit) return OBX_PROVEEDORES[j];
    }
  }
  return null;
}

/** Busca obligación en catálogo local por proveedor_id + detalle (case-insensitive). */
function obXlBuscarObligacionLocal(proveedorId, detalle) {
  var dNorm = detalle.toUpperCase().trim();
  for (var i = 0; i < OBX_OBLIGACIONES.length; i++) {
    var ob = OBX_OBLIGACIONES[i];
    if (ob.proveedor_id === proveedorId &&
        (ob.detalle || '').toUpperCase().trim() === dNorm) return ob;
  }
  return null;
}

/** Busca categoría en catálogo local por código. */
function obXlBuscarCategoriaLocal(codigo) {
  if (!codigo) return null;
  var c = codigo.toUpperCase().trim();
  for (var i = 0; i < OBX_CATEGORIAS.length; i++) {
    if ((OBX_CATEGORIAS[i].codigo || '').toUpperCase().trim() === c) return OBX_CATEGORIAS[i];
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════
   4. FASE A — PARSE
   ══════════════════════════════════════════════════════════════════ */

/** Detecta la hoja correcta del workbook por nombre o como fallback la primera. */
function obXlDetectarHoja(wb) {
  var nombres = wb.SheetNames;
  for (var ki = 0; ki < OBX_HOJAS_VALIDAS.length; ki++) {
    var kNorm = OBX_HOJAS_VALIDAS[ki].toUpperCase();
    for (var si = 0; si < nombres.length; si++) {
      if (nombres[si].toUpperCase().indexOf(kNorm) !== -1) {
        return { hoja: wb.Sheets[nombres[si]], nombre: nombres[si] };
      }
    }
  }
  if (nombres.length > 0) return { hoja: wb.Sheets[nombres[0]], nombre: nombres[0] };
  return null;
}

/** Convierte hoja SheetJS a array de arrays. */
function obXlHojaAMatrix(hoja) {
  return XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null, blankrows: false });
}

/**
 * Busca la fila de cabecera dentro de las primeras N filas.
 * Requiere encontrar al menos proveedor + detalle + fecha.
 */
function obXlDetectarCabecera(matrix, maxFila) {
  maxFila = maxFila || 6;
  for (var fi = 0; fi < Math.min(maxFila, matrix.length); fi++) {
    var cols = obXlDetectarColumnas(matrix[fi]);
    if (cols.proveedor !== -1 && cols.detalle !== -1 && cols.fecha !== -1) {
      return { filaIdx: fi, cols: cols };
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════
   5. FASE C — TRANSFORM
   ══════════════════════════════════════════════════════════════════ */

/**
 * Transforma una fila raw en objeto normalizado.
 * Retorna siempre — errores se acumulan en _errores, _valida indica si procede.
 */
function obXlTransformarFila(row, cols, filaNum) {
  var errores = [];
  var nit         = cols.nit        >= 0 ? obXlNit(row[cols.nit])          : null;
  var razonSocial = cols.proveedor  >= 0 ? obXlStr(row[cols.proveedor])     : '';
  var detalle     = cols.detalle    >= 0 ? obXlStr(row[cols.detalle])        : '';
  var tipoRaw     = cols.tipo       >= 0 ? obXlStr(row[cols.tipo])           : '';
  var fechaRaw    = cols.fecha      >= 0 ? obXlStr(row[cols.fecha])          : '';
  var frecRaw     = cols.frecuencia >= 0 ? obXlStr(row[cols.frecuencia])     : 'MENSUAL';

  var frecNorm    = obXlNormFrecuencia(frecRaw);
  var fechaObj    = obXlParsearFecha(fechaRaw, frecNorm);
  var categCodigo = obXlMapearCategoria(tipoRaw);
  var sede        = obXlDetectarSede(detalle);
  var nombreCorto = obXlNombreCorto(razonSocial);

  if (!razonSocial) errores.push('Nombre de proveedor vacío');
  if (!detalle)     errores.push('Detalle de obligación vacío');
  if (!tipoRaw)     errores.push('Tipo/categoría vacío');
  if (!fechaRaw)    errores.push('Fecha límite vacía');
  if ((frecNorm === 'mensual' || frecNorm === 'quincenal') && !fechaObj.dia_pago) {
    errores.push('No se pudo extraer día de pago de: "' + fechaRaw + '"');
  }
  if (frecNorm === 'semanal' && fechaObj.dia_semana === null) {
    errores.push('No se pudo detectar día de la semana de: "' + fechaRaw + '"');
  }

  return {
    fila:             filaNum,
    nit:              nit,
    razon_social:     razonSocial,
    nombre_corto:     nombreCorto,
    detalle:          detalle,
    tipo_raw:         tipoRaw,
    categoria_codigo: categCodigo,
    sede:             sede,
    frecuencia:       frecNorm,
    dia_pago:         fechaObj.dia_pago,
    dia_semana:       fechaObj.dia_semana,
    _valida:          errores.length === 0,
    _errores:         errores,
    // campos que se rellenan en fases posteriores:
    _categoria_id:    null,
    _proveedor_id:    null,
    _proveedor_nuevo: false,
    _duplicado:       false,
    _obligacion_id:   null,
  };
}

/* ══════════════════════════════════════════════════════════════════
   6. FASE D — VALIDATE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Valida que la categoría mapeada exista en OBX_CATEGORIAS.
 * Mutación en-place: actualiza _categoria_id o marca _valida=false.
 */
function obXlValidarCategoria(fila) {
  if (!fila._valida) return fila;
  var cat = obXlBuscarCategoriaLocal(fila.categoria_codigo);
  if (!cat) {
    fila._valida = false;
    fila._errores.push(
      'Categoría "' + fila.tipo_raw + '" → código "' + fila.categoria_codigo +
      '" no existe en ob_categorias. Verifica ob_categorias_seed.sql.'
    );
  } else {
    fila._categoria_id = cat.id;
  }
  return fila;
}

/* ══════════════════════════════════════════════════════════════════
   7. FASE E — DEDUP
   ══════════════════════════════════════════════════════════════════ */

/**
 * Detecta si proveedor y/u obligación ya existen en los catálogos locales.
 * Mutación en-place.
 */
function obXlDedupFila(fila) {
  if (!fila._valida) return fila;
  var provExistente = obXlBuscarProveedorLocal(fila.nit, fila.razon_social);
  if (provExistente) {
    fila._proveedor_id    = provExistente.id;
    fila._proveedor_nuevo = false;
    var obExistente = obXlBuscarObligacionLocal(provExistente.id, fila.detalle);
    if (obExistente) {
      fila._duplicado     = true;
      fila._obligacion_id = obExistente.id;
    }
  } else {
    fila._proveedor_id    = null;
    fila._proveedor_nuevo = true;
    fila._duplicado       = false;
  }
  return fila;
}

/* ══════════════════════════════════════════════════════════════════
   8. FASE F — LOAD: crear proveedores y obligaciones
   ══════════════════════════════════════════════════════════════════ */

/**
 * Crea en Supabase todos los proveedores nuevos del lote.
 * - Proveedores con NIT → upsert masivo (OB.Proveedores.upsertDesdeExcel)
 * - Proveedores sin NIT → insert individual (OB.Proveedores.crear)
 * Retorna mapa { 'NIT_xxx' → id, 'RS_NOMBRE' → id } para resolver IDs luego.
 * Los errores se acumulan en el array erroresOut (mutación por referencia).
 */
async function obXlCrearProveedores(filas, onProgress, erroresOut) {
  var mapa       = {};
  var conNit     = {};   // nit → fila representativa
  var sinNitSet  = {};   // razonSocial.upper → true
  var sinNit     = [];

  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (!f._proveedor_nuevo) continue;
    if (f.nit) {
      if (!conNit[f.nit]) conNit[f.nit] = f;
    } else {
      var key = f.razon_social.toUpperCase().trim();
      if (!sinNitSet[key]) { sinNitSet[key] = true; sinNit.push(f); }
    }
  }

  // ── Upsert masivo con NIT ────────────────────────────────────────
  var nitFilas = Object.values(conNit);
  if (nitFilas.length > 0) {
    onProgress('Creando ' + nitFilas.length + ' proveedor(es) por NIT…');
    var payload = nitFilas.map(function(f) {
      return { nit: f.nit, razon_social: f.razon_social.trim(),
               nombre_corto: f.nombre_corto.trim(), activo: true };
    });
    var resUpsert = await OB.Proveedores.upsertDesdeExcel(payload);
    if (resUpsert.ok && resUpsert.data) {
      for (var pi = 0; pi < resUpsert.data.length; pi++) {
        var prov = resUpsert.data[pi];
        if (prov.nit)         mapa['NIT_' + prov.nit] = prov.id;
        if (prov.razon_social) mapa['RS_' + prov.razon_social.toUpperCase().trim()] = prov.id;
        OBX_PROVEEDORES.push(prov);
      }
    } else if (!resUpsert.ok) {
      erroresOut.push({ fila: 0, detalle: 'Upsert proveedores',
                        proveedor: '(lote NIT)',
                        msgs: ['Error al crear proveedores: ' + (resUpsert.error || '?')] });
    }
  }

  // ── Insert individual sin NIT ────────────────────────────────────
  for (var si = 0; si < sinNit.length; si++) {
    var sf = sinNit[si];
    onProgress('Creando proveedor sin NIT: ' + sf.nombre_corto + '…');
    var resCrear = await OB.Proveedores.crear({
      nit: null, razon_social: sf.razon_social.trim(), nombre_corto: sf.nombre_corto.trim()
    });
    if (resCrear.ok && resCrear.data) {
      var np = resCrear.data;
      mapa['RS_' + np.razon_social.toUpperCase().trim()] = np.id;
      OBX_PROVEEDORES.push(np);
    } else {
      erroresOut.push({ fila: sf.fila, detalle: sf.detalle,
                        proveedor: sf.razon_social,
                        msgs: ['No se pudo crear proveedor sin NIT: ' + (resCrear.error || '?')] });
    }
  }

  return mapa;
}

/**
 * Resuelve el proveedor_id de una fila usando el mapa o buscando en el catálogo local.
 * Retorna null si no puede resolverse (indica error de carga del proveedor).
 */
function obXlResolverProveedorId(fila, mapaProveedores) {
  if (fila._proveedor_id) return fila._proveedor_id;
  if (fila.nit && mapaProveedores['NIT_' + fila.nit]) return mapaProveedores['NIT_' + fila.nit];
  var rsKey = 'RS_' + fila.razon_social.toUpperCase().trim();
  if (mapaProveedores[rsKey]) return mapaProveedores[rsKey];
  // Último recurso: catálogo local (puede haber sido actualizado por upsert)
  var prov = obXlBuscarProveedorLocal(fila.nit, fila.razon_social);
  return prov ? prov.id : null;
}

/**
 * Crea las obligaciones nuevas en Supabase, una a una.
 * Incluye dedup secundario post-resolución de proveedor_id.
 * Retorna { creadas, errores }.
 */
async function obXlCrearObligaciones(filas, mapaProveedores, onProgress) {
  var creadas    = 0;
  var erroresObl = [];
  var total      = filas.filter(function(f) { return f._valida && !f._duplicado; }).length;
  var idx        = 0;

  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (!f._valida || f._duplicado) continue;

    idx++;
    var provId = obXlResolverProveedorId(f, mapaProveedores);
    if (!provId) {
      erroresObl.push({ fila: f.fila, detalle: f.detalle, proveedor: f.razon_social,
                        msgs: ['ID de proveedor no resuelto — obligación omitida.'] });
      continue;
    }

    // Dedup secundario con proveedor_id ya resuelto
    if (obXlBuscarObligacionLocal(provId, f.detalle)) continue;

    onProgress('Obligación ' + idx + '/' + total + ': ' + f.nombre_corto + '…');

    var res = await OB.Obligaciones.crear({
      proveedor_id:   provId,
      categoria_id:   f._categoria_id,
      detalle:        f.detalle.trim(),
      sede:           f.sede,
      frecuencia:     f.frecuencia,
      dia_pago:       f.dia_pago,
      dia_semana:     f.dia_semana,
      monto_estimado: 0,
      activo:         true,
      notas:          'Importado desde Excel · ' + new Date().toLocaleDateString('es-CO'),
    });

    if (res.ok) {
      creadas++;
      if (res.data) OBX_OBLIGACIONES.push(res.data);
    } else {
      erroresObl.push({ fila: f.fila, detalle: f.detalle, proveedor: f.razon_social,
                        msgs: [res.error || 'Error al crear obligación'] });
    }
  }

  return { creadas: creadas, errores: erroresObl };
}

/* ══════════════════════════════════════════════════════════════════
   9. ORQUESTADOR PRINCIPAL
   ══════════════════════════════════════════════════════════════════ */

async function obXlEjecutarImportacion(wb, filename) {
  var t0 = Date.now();
  obXlMostrarProgreso('Iniciando importación…');

  var resultado = {
    archivo:              filename,
    hoja:                 '',
    filas_leidas:         0,
    filas_validas:        0,
    filas_ignoradas:      0,
    filas_duplicadas:     0,
    proveedores_creados:  0,
    proveedores_existentes: 0,
    obligaciones_creadas: 0,
    errores:              [],
    duracion_ms:          0,
    ok:                   false,
  };

  try {

    // ── A. PARSE ────────────────────────────────────────────────────
    obXlProgreso('Detectando hoja…');
    var hojaInfo = obXlDetectarHoja(wb);
    if (!hojaInfo) throw new Error('No se encontró hoja válida. Nombres aceptados: ' + OBX_HOJAS_VALIDAS.join(', '));

    resultado.hoja = hojaInfo.nombre;
    var matrix = obXlHojaAMatrix(hojaInfo.hoja);
    if (!matrix || matrix.length < 3) throw new Error('La hoja "' + hojaInfo.nombre + '" tiene menos de 2 filas de datos.');

    var cabecera = obXlDetectarCabecera(matrix, 6);
    if (!cabecera) throw new Error('No se detectaron las columnas requeridas (Proveedor, Detalle, Fecha). Verifica que sea PAGOS_RECURRENTES.xlsx.');

    var totalDataRows = matrix.length - cabecera.filaIdx - 1;
    obXlProgreso('Hoja "' + hojaInfo.nombre + '" · ' + totalDataRows + ' filas a procesar…');

    // ── B. CATÁLOGOS ────────────────────────────────────────────────
    obXlProgreso('Cargando catálogos desde Supabase…');
    var resCat  = await OB.Categorias.listar();
    var resProv = await OB.Proveedores.listar({ soloActivos: false });
    var resObl  = await OB.Obligaciones.listar({ soloActivas: false });

    OBX_CATEGORIAS   = resCat.ok  && resCat.data   ? resCat.data   : [];
    OBX_PROVEEDORES  = resProv.ok && resProv.data   ? resProv.data  : [];
    OBX_OBLIGACIONES = resObl.ok  && resObl.data    ? resObl.data   : [];

    if (OBX_CATEGORIAS.length === 0) {
      throw new Error(
        'La tabla ob_categorias está vacía. ' +
        'Ejecuta ob_categorias_seed.sql en Supabase SQL Editor primero.'
      );
    }
    obXlProgreso(OBX_CATEGORIAS.length + ' categorías · ' + OBX_PROVEEDORES.length + ' proveedores · ' + OBX_OBLIGACIONES.length + ' obligaciones existentes');

    // ── C+D+E. TRANSFORM + VALIDATE + DEDUP ────────────────────────
    obXlProgreso('Analizando filas…');
    var filasValidas = [];

    for (var ri = cabecera.filaIdx + 1; ri < matrix.length; ri++) {
      var row = matrix[ri];
      if (!row || row.every(function(c) { return c === null || c === undefined || String(c).trim() === ''; })) continue;

      resultado.filas_leidas++;

      if (obXlEsSubFila(cabecera.cols, row)) {
        resultado.filas_ignoradas++;
        continue;
      }

      var fila = obXlTransformarFila(row, cabecera.cols, ri + 1);
      fila = obXlValidarCategoria(fila);
      fila = obXlDedupFila(fila);

      if (!fila._valida) {
        resultado.errores.push({
          fila: fila.fila, detalle: fila.detalle || '(vacío)',
          proveedor: fila.razon_social || '(vacío)', msgs: fila._errores
        });
      } else if (fila._duplicado) {
        resultado.filas_duplicadas++;
      } else {
        filasValidas.push(fila);
      }
    }

    resultado.filas_validas = filasValidas.length;

    // Contar proveedores nuevos únicos
    var provNuevosSet = {};
    filasValidas.forEach(function(f) {
      if (!f._proveedor_nuevo) return;
      var k = f.nit ? f.nit : 'RS_' + f.razon_social.toUpperCase().trim();
      provNuevosSet[k] = true;
    });
    var nProvNuevos   = Object.keys(provNuevosSet).length;
    resultado.proveedores_existentes = filasValidas.filter(function(f) { return !f._proveedor_nuevo; }).length;

    obXlProgreso(
      filasValidas.length + ' nuevas · ' + resultado.filas_duplicadas + ' duplicadas · ' +
      resultado.filas_ignoradas + ' ignoradas · ' + resultado.errores.length + ' con errores'
    );

    // ── F. LOAD ─────────────────────────────────────────────────────
    var mapaProveedores = {};

    if (filasValidas.length > 0) {
      obXlProgreso('Creando ' + nProvNuevos + ' proveedores nuevos…');
      mapaProveedores = await obXlCrearProveedores(filasValidas, obXlProgreso, resultado.errores);
      resultado.proveedores_creados = nProvNuevos;

      obXlProgreso('Creando obligaciones…');
      var resOblLoad = await obXlCrearObligaciones(filasValidas, mapaProveedores, obXlProgreso);
      resultado.obligaciones_creadas = resOblLoad.creadas;
      resultado.errores = resultado.errores.concat(resOblLoad.errores);
    }

    // ── G. AUDITORÍA ────────────────────────────────────────────────
    OB.Auditoria.registrar({
      accion:         OB.ACCIONES.CARGA_EXCEL,
      tabla_afectada: 'ob_obligaciones',
      descripcion:    'Importación Excel: ' + filename + ' · ' +
                      resultado.obligaciones_creadas + ' obligaciones · ' +
                      resultado.proveedores_creados  + ' proveedores',
      valor_nuevo: {
        archivo:   filename,
        hoja:      resultado.hoja,
        creadas:   resultado.obligaciones_creadas,
        errores:   resultado.errores.length,
      },
    }).catch(function() {}); // auditoría nunca bloquea

    resultado.ok = true;

  } catch (err) {
    resultado.ok = false;
    resultado.errores.push({
      fila: 0, detalle: 'Error crítico del parser', proveedor: '',
      msgs: [err.message || String(err)]
    });
  }

  resultado.duracion_ms = Date.now() - t0;
  OBX_RESULTADO = resultado;
  obXlCerrarProgreso();
  obXlMostrarResumen(resultado);
}

/* ══════════════════════════════════════════════════════════════════
   10. UI — MODAL DE PROGRESO
   ══════════════════════════════════════════════════════════════════ */

var _obXlProgresoTxt = null;

function obXlMostrarProgreso(msg) {
  var existing = document.getElementById('obXlProgresoModal');
  if (existing) existing.remove();

  var d = document.createElement('div');
  d.id = 'obXlProgresoModal';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(1,42,107,.6);backdrop-filter:blur(5px);' +
    'display:flex;align-items:center;justify-content:center;z-index:10001';

  d.innerHTML =
    '<div style="background:#fff;border-radius:14px;padding:32px 36px;min-width:340px;max-width:460px;' +
    'box-shadow:0 24px 64px rgba(1,42,107,.22);text-align:center">' +
    // Ícono
    '<div style="width:50px;height:50px;border-radius:50%;background:rgba(0,135,95,.1);' +
    'display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
    '<i class="ti ti-file-spreadsheet" style="font-size:24px;color:#00875F"></i></div>' +
    // Título
    '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:700;' +
    'letter-spacing:.08em;text-transform:uppercase;color:#012A6B;margin-bottom:12px">Importando Excel</div>' +
    // Spinner
    '<div style="display:flex;justify-content:center;margin:10px 0">' +
    '<div style="width:30px;height:30px;border:3px solid rgba(1,42,107,.08);border-top-color:#00875F;' +
    'border-radius:50%;animation:obXlSp .7s linear infinite"></div></div>' +
    // Mensaje
    '<div id="obXlPTxt" style="font-family:\'JetBrains Mono\',monospace;font-size:10px;' +
    'color:#6B7280;letter-spacing:.05em;margin-top:10px;min-height:16px;word-break:break-word">' +
    obXlHtmlEsc(msg) + '</div>' +
    '</div>' +
    '<style>@keyframes obXlSp{to{transform:rotate(360deg)}}</style>';

  document.body.appendChild(d);
  _obXlProgresoTxt = document.getElementById('obXlPTxt');
}

function obXlProgreso(msg) {
  if (_obXlProgresoTxt) _obXlProgresoTxt.textContent = msg;
}

function obXlCerrarProgreso() {
  var el = document.getElementById('obXlProgresoModal');
  if (el) el.remove();
  _obXlProgresoTxt = null;
}

/* ══════════════════════════════════════════════════════════════════
   11. UI — MODAL DE RESUMEN
   ══════════════════════════════════════════════════════════════════ */

function obXlHtmlEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function obXlMostrarResumen(r) {
  var existing = document.getElementById('obXlResumenModal');
  if (existing) existing.remove();

  var ok         = r.ok && r.errores.filter(function(e) { return e.fila === 0; }).length === 0;
  var statusColor = r.obligaciones_creadas > 0 ? '#00875F' : (ok ? '#D97706' : '#DC2626');
  var statusIco   = r.obligaciones_creadas > 0 ? 'ti-circle-check' : (ok ? 'ti-info-circle' : 'ti-alert-circle');
  var statusTxt   =
    r.obligaciones_creadas > 0 ? 'Importación completada' :
    r.filas_duplicadas > 0     ? 'Todo ya estaba importado' :
    ok                         ? 'Sin obligaciones nuevas' :
                                 'Importación con errores';

  // KPIs
  var kpiData = [
    { v: r.filas_leidas,            l: 'Filas leídas',           c: '#012A6B' },
    { v: r.filas_ignoradas,         l: 'Sub-filas ignoradas',     c: '#9CA3AF' },
    { v: r.filas_duplicadas,        l: 'Ya existentes',           c: '#D97706' },
    { v: r.errores.length,          l: 'Con errores',             c: r.errores.length > 0 ? '#DC2626' : '#9CA3AF' },
    { v: r.proveedores_creados,     l: 'Proveedores creados',     c: '#00875F' },
    { v: r.obligaciones_creadas,    l: 'Obligaciones creadas',    c: '#00875F' },
  ];

  var kpiHtml = kpiData.map(function(k) {
    return '<div style="background:#F9FAFC;border-radius:10px;padding:12px 8px;text-align:center">' +
      '<div style="font-family:\'Anton\',sans-serif;font-size:28px;color:' + k.c + ';line-height:1">' + k.v + '</div>' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:8.5px;color:#6B7280;' +
      'text-transform:uppercase;letter-spacing:.07em;margin-top:4px;line-height:1.2">' + obXlHtmlEsc(k.l) + '</div>' +
      '</div>';
  }).join('');

  // Tabla de errores
  var errHtml = '';
  if (r.errores.length > 0) {
    var errItems = r.errores.slice(0, 25).map(function(e) {
      var msgsHtml = e.msgs.map(function(m) { return obXlHtmlEsc(m); }).join(' · ');
      return '<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(1,42,107,.05)">' +
        '<span style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:#DC2626;' +
        'background:rgba(220,38,38,.07);border-radius:3px;padding:2px 5px;flex-shrink:0;white-space:nowrap;align-self:flex-start">' +
        'F.' + obXlHtmlEsc(String(e.fila || '—')) + '</span>' +
        '<div><div style="font-size:11px;font-weight:600;color:#1F2937">' + obXlHtmlEsc(e.proveedor || '—') + '</div>' +
        '<div style="font-size:10px;color:#6B7280;margin-top:1px">' + msgsHtml + '</div></div></div>';
    }).join('');

    var masLabel = r.errores.length > 25
      ? '<div style="text-align:center;font-size:10px;color:#6B7280;padding:6px">…y ' + (r.errores.length - 25) + ' más</div>'
      : '';

    errHtml = '<div style="margin-top:16px">' +
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;' +
      'letter-spacing:.06em;text-transform:uppercase;color:#DC2626;margin-bottom:8px">' +
      '<i class="ti ti-alert-triangle" style="margin-right:4px"></i>' + r.errores.length + ' error(es)</div>' +
      '<div style="max-height:180px;overflow-y:auto;border:1px solid rgba(220,38,38,.15);' +
      'border-radius:8px;padding:8px 12px;background:rgba(220,38,38,.02)">' +
      errItems + masLabel + '</div></div>';
  }

  // Próximo paso
  var nextHtml = r.obligaciones_creadas > 0
    ? '<div style="margin-top:14px;padding:10px 14px;background:rgba(0,135,95,.06);' +
      'border-radius:8px;border-left:3px solid #00875F">' +
      '<div style="font-size:11px;color:#00875F;font-weight:600">' +
      '<i class="ti ti-arrow-right" style="margin-right:4px"></i>' +
      'Próximo paso: crea o activa un período en el Panel para generar los pagos del mes.</div></div>'
    : '';

  // Botones
  var btnPrimario = r.obligaciones_creadas > 0
    ? '<button onclick="obXlCerrarResumen(true)" style="flex:2;padding:10px 16px;border:none;border-radius:8px;' +
      'background:#012A6B;color:#fff;cursor:pointer;font-family:\'Barlow Condensed\',sans-serif;' +
      'font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">' +
      '<i class="ti ti-refresh" style="margin-right:6px"></i>Recargar módulo</button>'
    : '';

  var btnSecundario = '<button onclick="obXlCerrarResumen(false)" style="flex:1;padding:10px 16px;' +
    'border:1px solid rgba(1,42,107,.16);border-radius:8px;background:#fff;color:#6B7280;cursor:pointer;' +
    'font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;' +
    'letter-spacing:.06em;text-transform:uppercase">Cerrar</button>';

  var html =
    '<div id="obXlResumenModal" style="position:fixed;inset:0;background:rgba(1,42,107,.6);' +
    'backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:10001">' +
    '<div style="background:#fff;border-radius:16px;padding:28px 30px;' +
    'width:min(520px,calc(100vw - 40px));max-height:88vh;overflow-y:auto;' +
    'box-shadow:0 28px 80px rgba(1,42,107,.22)">' +

    // Encabezado
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
    '<div style="width:42px;height:42px;border-radius:50%;flex-shrink:0;' +
    'background:' + statusColor + '1A;display:flex;align-items:center;justify-content:center">' +
    '<i class="ti ' + statusIco + '" style="font-size:20px;color:' + statusColor + '"></i></div>' +
    '<div><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;' +
    'letter-spacing:.06em;text-transform:uppercase;color:#012A6B">' + obXlHtmlEsc(statusTxt) + '</div>' +
    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:#6B7280;margin-top:3px">' +
    obXlHtmlEsc(r.archivo) + ' · hoja: ' + obXlHtmlEsc(r.hoja) + ' · ' + r.duracion_ms + 'ms</div>' +
    '</div></div>' +

    // KPIs
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px">' +
    kpiHtml + '</div>' +

    errHtml + nextHtml +

    // Botones
    '<div style="display:flex;gap:10px;margin-top:20px">' +
    btnPrimario + btnSecundario +
    '</div>' +

    '</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
}

/** Cierra el modal de resumen y opcionalmente recarga los datos del módulo. */
function obXlCerrarResumen(recargar) {
  var el = document.getElementById('obXlResumenModal');
  if (el) el.remove();
  if (recargar && typeof refresh === 'function') refresh();
}

/* ══════════════════════════════════════════════════════════════════
   12. INTEGRACIÓN CON INPUT FILE (botón alternativo al drag&drop)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Crea un <input type="file"> invisible y lo activa al hacer clic en
 * el elemento con id="btnCargarExcelAdmin" (si existe en la UI).
 * Complementa el drag&drop de obInitDragDrop() sin modificar obligaciones.html.
 */
function obXlIniciarBotonCarga() {
  var btn = document.getElementById('btnCargarExcelAdmin');
  if (!btn) return; // el botón es opcional — no es error si no existe

  // Crear input oculto
  var inp = document.createElement('input');
  inp.type    = 'file';
  inp.accept  = '.xlsx,.xls';
  inp.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0';
  inp.id      = 'obXlFileInput';
  document.body.appendChild(inp);

  btn.addEventListener('click', function() {
    if (!window.OB_IS_ADMIN) {
      if (typeof toast === 'function') toast('Solo el administrador puede importar el Excel', 'err');
      return;
    }
    inp.value = ''; // resetear para permitir re-carga del mismo archivo
    inp.click();
  });

  inp.addEventListener('change', function() {
    var file = inp.files && inp.files[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      if (typeof toast === 'function') toast('Solo se aceptan archivos .xlsx o .xls', 'err');
      return;
    }
    if (typeof obLeerExcel === 'function') {
      obLeerExcel(file); // delegamos a la función existente en obligaciones.html
    }
  });
}

/* ══════════════════════════════════════════════════════════════════
   13. PUNTO DE ENTRADA PÚBLICO
   ══════════════════════════════════════════════════════════════════ */

/**
 * Punto de entrada principal — llamado por obLeerExcel() en obligaciones.html.
 * Firma: window.OB.obParseExcel(workbook, filename)
 *
 * Verificaciones antes de lanzar el pipeline:
 *   - window.OB disponible (ob-services.js cargado)
 *   - window.XLSX disponible (SheetJS cargado)
 *   - OB_IS_ADMIN === true (solo admin puede importar)
 */
function obParseExcel(wb, filename) {
  if (!window.OB) {
    obXlMostrarProgreso('Error: ob-services.js no está cargado.');
    return;
  }
  if (!window.XLSX) {
    obXlMostrarProgreso('Error: SheetJS (XLSX) no está disponible. Verifica el CDN.');
    return;
  }
  if (!window.OB_IS_ADMIN) {
    if (typeof toast === 'function') toast('Solo el administrador puede importar el Excel', 'err');
    return;
  }
  obXlEjecutarImportacion(wb, filename || 'Excel').catch(function(err) {
    obXlCerrarProgreso();
    if (typeof toast === 'function') toast('Error inesperado en el parser: ' + err.message, 'err');
  });
}

// ── Registrar en window.OB ──────────────────────────────────────────
// Se hace en DOMContentLoaded para garantizar que ob-services.js ya
// terminó de ejecutarse (ambos scripts cargados en orden secuencial).
document.addEventListener('DOMContentLoaded', function() {
  if (window.OB) {
    window.OB.obParseExcel = obParseExcel;
  }
  // Activar botón de carga si existe en la UI
  obXlIniciarBotonCarga();
});

// Alias global de respaldo
window.obParseExcel = obParseExcel;
