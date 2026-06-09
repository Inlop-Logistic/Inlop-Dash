/* ════════════════════════════════════════════════════════════════════════════
   FASE 8C — Núcleo de datos: Parser · Filtros · Alertas · Runtime · refresh()
   ─────────────────────────────────────────────────────────────────────────────
   PUNTO DE INSERCIÓN EN financiero_v2.html:
     Localizar el comentario:  /* ════ FIN JAVASCRIPT FASE 8B ════ */
     Insertar INMEDIATAMENTE DESPUÉS de esa línea, antes de </script>

   DEPENDENCIAS PREVIAS (deben existir):
     Fase 8A: toast(), showView(), updateHdrChip(), FIN_DATA, FIN_FILTERS,
              FIN_META, FIN_CURRENT_VIEW, FIN_CHARTS, capitalize()
     Fase 8B: finData.saveCloud(), finData.saveMem(), finAudit.registrar(),
              sbQ(), _actualizarFooterMeta()

   Referencia canónica:
     07_Backend_Services_Financiero_V2.md  (secciones 6, 7, 8, 9, 15, 18, 19)
     03_Modelo_Datos_Financiero_V2.md      (secciones 2, 3, 6, 8)
   ════════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-1 · CATÁLOGOS Y CONSTANTES
   ══════════════════════════════════════════════════════════════════════════════ */

/*
 * LINEA_MAP — mapeo nombre de cliente normalizado → línea de negocio
 * Claves: razón social en MAYÚSCULAS, sin puntos, sin diacríticos, trim
 * 20 clientes activos · fuente: 00_CONFIG del Excel Maestro / 03_Modelo_Datos
 */
var LINEA_MAP = {
  /* CARGA LÍQUIDA (8) */
  'ATLANTIC MARINE FUELS SAS':                           'CARGA LIQUIDA',
  'FRONTERA ENERGY COLOMBIA CORP SUCURSAL COLOMBIA':     'CARGA LIQUIDA',
  'CI PRODEXPORT DE COLOMBIA SAS':                       'CARGA LIQUIDA',
  'C I PRODEXPORT DE COLOMBIA SAS':                      'CARGA LIQUIDA',
  'CI CONQUERS WORLD TRADE SAS':                         'CARGA LIQUIDA',
  'C I CONQUERS WORLD TRADE SAS':                        'CARGA LIQUIDA',
  'CI GARU INVERSIONES SAS':                             'CARGA LIQUIDA',
  'C I GARU INVERSIONES SAS':                            'CARGA LIQUIDA',
  'DEVELOPMENT OF ENERGY PROJECTS SAS':                  'CARGA LIQUIDA',
  'INDUSTRIA AMBIENTAL SAS':                             'CARGA LIQUIDA',
  'WASTE AND ENVIRONMENTAL SERVICES SAS':                'CARGA LIQUIDA',
  /* CARGA SECA (12) */
  'PRODUCTOS RAMO SAS':                                  'CARGA SECA',
  'PRODUCTOS RAMO S A S':                                'CARGA SECA',
  'QMAX SOLUTIONS COLOMBIA':                             'CARGA SECA',
  'EMPRESA COLOMBIANA DE PRODUCTOS VETERINARIOS SA':     'CARGA SECA',
  'DISTRIBUIDORA DE PAPEL JURADO TORRES SAS':            'CARGA SECA',
  'FRIGORIFICO DE LA COSTA SAS':                         'CARGA SECA',
  'KANGUPOR SAS':                                        'CARGA SECA',
  'LA FABRICA DE LA FELICIDAD SAS':                      'CARGA SECA',
  'LHOIST COLOMBIA SAS':                                 'CARGA SECA',
  'LORRY SAS':                                           'CARGA SECA',
  'LORRY S A S':                                         'CARGA SECA',
  'JEHS INGENIERIA S A S':                               'CARGA SECA',
  'EOM CONSULTING SAS':                                  'CARGA SECA',
  'LOGISTICA Y DISTRIBUCION ESPECIALIZADA L&D SAS':      'CARGA SECA',
  'LOGISTICA Y DISTRIBUCION ESPECIALIZADA LD SAS':       'CARGA SECA'
};

/*
 * ALIAS_MAP — mapeo nombre de cliente normalizado → alias de dashboard
 */
var ALIAS_MAP = {
  'ATLANTIC MARINE FUELS SAS':                           'AMF',
  'FRONTERA ENERGY COLOMBIA CORP SUCURSAL COLOMBIA':     'FRONTERA ENERGY',
  'CI PRODEXPORT DE COLOMBIA SAS':                       'CI PRODEXPORT',
  'C I PRODEXPORT DE COLOMBIA SAS':                      'CI PRODEXPORT',
  'CI CONQUERS WORLD TRADE SAS':                         'CI CONQUERS',
  'C I CONQUERS WORLD TRADE SAS':                        'CI CONQUERS',
  'CI GARU INVERSIONES SAS':                             'CI GARU',
  'C I GARU INVERSIONES SAS':                            'CI GARU',
  'DEVELOPMENT OF ENERGY PROJECTS SAS':                  'DEV ENERGY',
  'INDUSTRIA AMBIENTAL SAS':                             'IND. AMBIENTAL',
  'WASTE AND ENVIRONMENTAL SERVICES SAS':                'WASTE SERVICES',
  'PRODUCTOS RAMO SAS':                                  'RAMO',
  'PRODUCTOS RAMO S A S':                                'RAMO',
  'QMAX SOLUTIONS COLOMBIA':                             'QMAX',
  'EMPRESA COLOMBIANA DE PRODUCTOS VETERINARIOS SA':     'ECPV SA',
  'DISTRIBUIDORA DE PAPEL JURADO TORRES SAS':            'DIST. JURADO',
  'FRIGORIFICO DE LA COSTA SAS':                         'FRIGORIFICO COSTA',
  'KANGUPOR SAS':                                        'KANGUPOR',
  'LA FABRICA DE LA FELICIDAD SAS':                      'FAB. FELICIDAD',
  'LHOIST COLOMBIA SAS':                                 'LHOIST',
  'LORRY SAS':                                           'LORRY',
  'LORRY S A S':                                         'LORRY',
  'JEHS INGENIERIA S A S':                               'JEHS INGENIERIA',
  'EOM CONSULTING SAS':                                  'EOM CONSULTING',
  'LOGISTICA Y DISTRIBUCION ESPECIALIZADA L&D SAS':      'ATICA',
  'LOGISTICA Y DISTRIBUCION ESPECIALIZADA LD SAS':       'ATICA'
};

/*
 * SEMANA_MES_MAP — mapeo S01..S52 → 'YYYY-MM'
 * Fuente: 03_Modelo_Datos sección 6.5 · Calendario ISO 2026
 */
var SEMANA_MES_MAP = {
  'S01':'2026-01','S02':'2026-01','S03':'2026-01','S04':'2026-01',
  'S05':'2026-02','S06':'2026-02','S07':'2026-02','S08':'2026-02',
  'S09':'2026-02','S10':'2026-03','S11':'2026-03','S12':'2026-03',
  'S13':'2026-03','S14':'2026-03','S15':'2026-04','S16':'2026-04',
  'S17':'2026-04','S18':'2026-04','S19':'2026-05','S20':'2026-05',
  'S21':'2026-05','S22':'2026-05','S23':'2026-05','S24':'2026-06',
  'S25':'2026-06','S26':'2026-06','S27':'2026-07','S28':'2026-07',
  'S29':'2026-07','S30':'2026-07','S31':'2026-08','S32':'2026-08',
  'S33':'2026-08','S34':'2026-08','S35':'2026-08','S36':'2026-09',
  'S37':'2026-09','S38':'2026-09','S39':'2026-09','S40':'2026-10',
  'S41':'2026-10','S42':'2026-10','S43':'2026-10','S44':'2026-11',
  'S45':'2026-11','S46':'2026-11','S47':'2026-11','S48':'2026-11',
  'S49':'2026-12','S50':'2026-12','S51':'2026-12','S52':'2026-12'
};

/* NIT canónicos de clientes críticos (para alertas hard-coded) */
var NIT_CI_GARU = '901669339';

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-2 · FUNCIONES PURAS DE NORMALIZACIÓN
   Todas son síncronas y sin efectos secundarios.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * normSem — Normaliza cualquier representación de semana al formato canónico S01..S52
 * REGLA OBLIGATORIA: s1→S01  s9→S09  s23→S23  S1→S01
 */
function normSem(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  var s = String(raw).trim().toUpperCase();
  var m = s.match(/^S(\d{1,2})$/);
  if (!m) return '';
  return 'S' + String(parseInt(m[1], 10)).padStart(2, '0');
}

/**
 * normNit — Normaliza un NIT: elimina dígito de verificación, guiones, puntos y espacios
 * Ejemplos: '900614423-4' → '900614423'  '900.614.423' → '900614423'
 */
function normNit(val) {
  if (!val && val !== 0) return '';
  return String(val)
    .replace(/-\d+$/, '')      /* quitar dígito verificador: -N al final */
    .replace(/[-.\s]/g, '')    /* quitar guiones, puntos y espacios */
    .trim();
}

/**
 * normNumero — Convierte un valor del Excel a número flotante
 * Maneja strings con coma, puntos de miles, espacios y valores nulos
 * Preserva signo negativo (bancos: salidas)
 */
function normNumero(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  /* Quitar todo salvo dígitos, punto decimal y signo negativo */
  var s = String(val).trim().replace(/[^\d.,-]/g, '');
  /* Si tiene coma como decimal (ej: "1.234,56") → convertir */
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
    /* Formato europeo: 1.234,56 → 1234.56 */
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(',', '.');
  }
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * normLinea — Normaliza una cadena a los dos valores canónicos de línea de negocio
 */
function normLinea(val) {
  if (!val) return '';
  var v = String(val).toUpperCase().trim();
  if (v.indexOf('LIQUID') !== -1 || v === 'CL' || v === 'L') return 'CARGA LIQUIDA';
  if (v.indexOf('SECA')   !== -1 || v === 'CS' || v === 'S') return 'CARGA SECA';
  return '';
}

/**
 * normCliente — Normaliza la razón social para lookup en LINEA_MAP y ALIAS_MAP
 * Elimina puntos, diacríticos, normaliza espacios. Resultado en MAYÚSCULAS.
 */
function normCliente(razonSocial) {
  if (!razonSocial) return '';
  return String(razonSocial)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  /* eliminar diacríticos */
    .replace(/\./g, '')               /* quitar puntos: C.I → CI */
    .replace(/\s+/g, ' ')             /* normalizar espacios múltiples */
    .trim();
}

/**
 * parseFecha — Convierte un valor del Excel a objeto Date o null
 * Maneja: instancias Date, números seriales de Excel, strings ISO, strings DD-mon-YY
 */
function parseFecha(val) {
  if (!val && val !== 0) return null;
  /* Ya es Date (XLSX.js lo convierte automáticamente) */
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  /* Número serial de Excel (días desde 1900-01-01) */
  if (typeof val === 'number') {
    /* Corrección por el bug del año bisiesto de Excel 1900 */
    var days = val > 59 ? val - 1 : val;
    var ms   = (days - 25569) * 86400 * 1000;
    var d    = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  /* String: intentar parseo ISO primero */
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    var d2 = new Date(s);
    return isNaN(d2.getTime()) ? null : d2;
  }
  /* Formato DD/MM/YYYY o DD-MM-YYYY */
  var mDMY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mDMY) {
    var yr = parseInt(mDMY[3], 10);
    if (yr < 100) yr += 2000;
    var d3 = new Date(yr, parseInt(mDMY[2], 10) - 1, parseInt(mDMY[1], 10));
    return isNaN(d3.getTime()) ? null : d3;
  }
  /* Intentar Date.parse como último recurso */
  var d4 = new Date(s);
  return isNaN(d4.getTime()) ? null : d4;
}

/**
 * getLineaCli — Obtiene la línea de negocio de un cliente por su razón social
 */
function getLineaCli(razonSocial) {
  var k = normCliente(razonSocial);
  return LINEA_MAP[k] || '';
}

/**
 * getAliasCli — Obtiene el alias del dashboard de un cliente
 */
function getAliasCli(razonSocial) {
  var k = normCliente(razonSocial);
  return ALIAS_MAP[k] || String(razonSocial || '').trim();
}

/**
 * inferirMes — Infiere el mes (YYYY-MM) a partir de la semana canónica
 */
function inferirMes(sem) {
  return SEMANA_MES_MAP[normSem(sem)] || '';
}

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-3 · FUNCIONES DE CÁLCULO RUNTIME
   INVARIANTE: Nunca usar valores de días/estado del Excel. Siempre recalcular.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * calcDias — Días de vencimiento desde HOY (positivo = por vencer, negativo = vencido)
 * Referencia: 07_Backend_Services sección 8.4
 */
function calcDias(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  var d = parseFecha(fechaVencimiento);
  if (!d) return null;
  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - hoy.getTime()) / 86400000);
}

/**
 * bucketAging — Clasifica días en bucket de aging para cartera
 * Positivo = por vencer (vigente), Negativo = vencido (aging)
 */
function bucketAging(dias) {
  if (dias === null || dias === undefined) return 'SIN_FECHA';
  if (dias > 7)   return 'VIGENTE';
  if (dias >= 1)  return 'POR_VENCER';
  if (dias === 0) return 'HOY';
  if (dias >= -30) return 'AG_0_30';
  if (dias >= -60) return 'AG_31_60';
  return 'AG_61_90';
}

/**
 * estadoSaldo — Estado de pago de un manifiesto
 */
function estadoSaldo(dias) {
  if (dias === null || dias === undefined) return 'SIN_FECHA';
  if (dias < 0)  return 'VENCIDO';
  if (dias <= 3) return 'URGENTE';
  if (dias <= 7) return 'PRONTO';
  return 'VIGENTE';
}

/**
 * estadoAdmin — Estado de un compromiso administrativo
 */
function estadoAdmin(dias) {
  if (dias === null || dias === undefined) return 'SIN_FECHA';
  if (dias < 0)  return 'VENCIDO';
  if (dias <= 3) return 'HOY_PRONTO';
  return 'VIGENTE';
}

/**
 * montoEfectivoAdmin — Resuelve el monto real cuando VALOR puede ser null
 * Caso MI PLANILLA: valor_cop=0 pero provision_cop=$27.3M
 */
function montoEfectivoAdmin(r) {
  if (!r) return 0;
  return (r.valor_cop && r.valor_cop > 0) ? r.valor_cop : (r.provision_cop || 0);
}

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-4 · FIN.Format — Utilidades de formato para display
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * fmtCOP — Número como pesos COP con separadores de miles
 */
function fmtCOP(n) {
  if (isNaN(n) || n === null || n === undefined) return '$0';
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/**
 * shortN — Número abreviado con sufijo (para KPIs)
 * >= 1B → '$1.8B'  >= 1M → '$2.5M'  >= 1K → '$78K'
 */
function shortN(n) {
  if (isNaN(n) || n === null || n === undefined) return '$0';
  var abs = Math.abs(n);
  var sign = n < 0 ? '-' : '';
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(1).replace('.0','')  + 'B';
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(1).replace('.0','')  + 'M';
  if (abs >= 1e3)  return sign + '$' + (abs / 1e3).toFixed(1).replace('.0','')  + 'K';
  return sign + '$' + Math.round(abs).toLocaleString('es-CO');
}

/**
 * fmtFecha — Fecha a string para display (DD-mmm-AA)
 */
function fmtFecha(d) {
  if (!d) return '—';
  var dt = parseFecha(d);
  if (!dt) return '—';
  var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return String(dt.getDate()).padStart(2,'0') + '-' +
         meses[dt.getMonth()] + '-' +
         String(dt.getFullYear()).slice(-2);
}

/**
 * fmtFechaCompacta — Para nombres de archivo: 20260606-1432
 */
function fmtFechaCompacta() {
  return new Date().toISOString().slice(0,16).replace(/[-:T]/g,'').replace('T','-');
}

/**
 * formatMes — 'YYYY-MM' → 'Enero 2026'
 */
function formatMes(mesId) {
  if (!mesId) return '—';
  var nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var parts = mesId.split('-');
  var idx = parseInt(parts[1], 10) - 1;
  return (nombres[idx] || mesId) + ' ' + (parts[0] || '');
}

/**
 * pctFmt — 0.553 → '55.3%'
 */
function pctFmt(n, dec) {
  if (isNaN(n) || n === null) return '—';
  return (n * 100).toFixed(dec !== undefined ? dec : 1) + '%';
}

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-5 · FIN.Parser — Procesamiento del Excel Maestro
   ══════════════════════════════════════════════════════════════════════════════ */

var finParser = {

  /* ────────────────────────────────────────────────────────────────────────────
   * detectSemana — Detecta la semana operativa activa del workbook
   * Intenta primero 00_CONFIG, luego la semana más alta en 01_FACTURACION
   * ────────────────────────────────────────────────────────────────────────── */
  detectSemana: function(wb) {
    var hojas = wb.SheetNames || [];

    /* Intento 1: 00_CONFIG — buscar celda con 'SEMANA ACTIVA' o similar */
    if (hojas.indexOf('00_CONFIG') !== -1) {
      var ws  = wb.Sheets['00_CONFIG'];
      var arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      for (var r = 0; r < arr.length; r++) {
        for (var c = 0; c < arr[r].length; c++) {
          var cell = String(arr[r][c] || '').toUpperCase().trim();
          if (cell === 'SEMANA ACTIVA' || cell === 'SEMANA ACTUAL') {
            /* El valor está en la siguiente columna o fila */
            var v = arr[r][c + 1] || (arr[r + 1] && arr[r + 1][c]) || '';
            var s = normSem(v);
            if (s) return s;
          }
          /* Buscar patrón S+dígito(s) directamente en la celda */
          var mSem = cell.match(/^S(\d{1,2})$/);
          if (mSem) {
            /* Validar que la celda anterior o etiqueta indique semana activa */
            var prev = String(arr[r][c - 1] || '').toUpperCase();
            if (prev.indexOf('ACTIV') !== -1 || prev.indexOf('ACTUAL') !== -1) {
              return normSem(cell);
            }
          }
        }
      }
    }

    /* Intento 2: semana máxima en 01_FACTURACION */
    if (hojas.indexOf('01_FACTURACION') !== -1) {
      var ws2 = wb.Sheets['01_FACTURACION'];
      var arr2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
      var maxN = 0;
      for (var i = 0; i < arr2.length; i++) {
        var celda = normSem(arr2[i][0]);
        if (celda) {
          var n = parseInt(celda.slice(1), 10);
          if (n > maxN) maxN = n;
        }
      }
      if (maxN > 0) return 'S' + String(maxN).padStart(2, '0');
    }

    return '';
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * _toRows — Convierte una hoja a array de objetos usando la primera fila de
   *           encabezados encontrada (detecta automáticamente la fila de cabecera)
   * ────────────────────────────────────────────────────────────────────────── */
  _toRows: function(ws, cabeceraBuscar) {
    if (!ws) return [];
    /* Convertir con encabezados como primera fila */
    var raw = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
    /* Si raw tiene registros con la clave esperada, retornar directamente */
    if (raw.length > 0 && cabeceraBuscar) {
      var keys = Object.keys(raw[0]);
      var found = keys.some(function(k) {
        return k.trim().toUpperCase().indexOf(cabeceraBuscar.toUpperCase()) !== -1;
      });
      if (found) return raw;
    }
    /* Si no, buscar la fila de encabezados manualmente */
    var arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    var headerIdx = -1;
    for (var i = 0; i < Math.min(arr.length, 10); i++) {
      var row = arr[i] || [];
      var hits = row.filter(function(c) {
        return c && typeof c === 'string' &&
               (c.toUpperCase().indexOf('SEMANA') !== -1 ||
                c.toUpperCase().indexOf('CLIENTE') !== -1 ||
                c.toUpperCase().indexOf('VALOR') !== -1);
      }).length;
      if (hits >= 2) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return raw; /* fallback al resultado original */
    var headers = arr[headerIdx].map(function(h) { return String(h || '').trim(); });
    var result = [];
    for (var j = headerIdx + 1; j < arr.length; j++) {
      var rowArr = arr[j] || [];
      /* Saltar filas completamente vacías */
      var nonEmpty = rowArr.filter(function(c) { return c !== null && c !== ''; }).length;
      if (nonEmpty === 0) continue;
      var obj = {};
      headers.forEach(function(h, idx) { obj[h] = rowArr[idx] !== undefined ? rowArr[idx] : null; });
      result.push(obj);
    }
    return result;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * _col — Helper seguro para leer una columna de una fila con múltiples aliases
   * ────────────────────────────────────────────────────────────────────────── */
  _col: function(row, aliases) {
    if (!row) return null;
    for (var i = 0; i < aliases.length; i++) {
      var k = aliases[i];
      if (row[k] !== undefined && row[k] !== null) return row[k];
      /* Búsqueda case-insensitive */
      var rowKeys = Object.keys(row);
      for (var j = 0; j < rowKeys.length; j++) {
        if (rowKeys[j].trim().toUpperCase() === k.trim().toUpperCase()) {
          return row[rowKeys[j]];
        }
      }
    }
    return null;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * parseFact — Hoja 01_FACTURACION
   * INVARIANTE: valor_cop > 0, sem canónico, NIT normalizado
   * ────────────────────────────────────────────────────────────────────────── */
  parseFact: function(ws) {
    var rows = this._toRows(ws, 'SEMANA');
    var result = [];
    var c = this._col.bind(this);

    rows.forEach(function(row, idx) {
      var sem = normSem(c(row, ['SEMANA']));
      if (!sem) return;

      var valor = normNumero(c(row, ['VALOR (COP)', 'VALOR COP', 'VALOR']));
      if (valor <= 0) return; /* INVARIANTE: solo registros con valor positivo */

      var clienteRaw = String(c(row, ['CLIENTE (LEGAL)', 'CLIENTE LEGAL', 'CLIENTE']) || '').trim();
      var nit        = normNit(c(row, ['NIT']));
      var lineaRaw   = String(c(row, ['LÍNEA NEGOCIO', 'LINEA NEGOCIO', 'LINEA']) || '').trim();
      var linea      = normLinea(lineaRaw) || getLineaCli(clienteRaw);
      var alias      = String(c(row, ['CLIENTE ALIAS', 'ALIAS']) || '').trim() || getAliasCli(clienteRaw);
      var mesRaw     = String(c(row, ['Mes', 'MES', 'mes']) || '').trim();
      var mes        = mesRaw || inferirMes(sem);
      var factura    = String(c(row, ['NRO. FACTURA', 'NRO FACTURA', 'FACTURA', 'N° FACTURA']) || '').trim();
      var comprobante= String(c(row, ['NRO. COMPROBANTE', 'NRO COMPROBANTE', 'COMPROBANTE']) || '').trim();
      var referencia = String(c(row, ['REFERENCIA / REMESA', 'REFERENCIA/REMESA', 'REFERENCIA', 'REMESA']) || '').trim();
      var fecha      = parseFecha(c(row, ['FECHA']));

      result.push({
        id:          sem + '-' + factura + '-' + idx,
        sem:         sem,
        mes:         mes,
        fecha:       fecha ? fecha.toISOString().slice(0, 10) : null,
        linea:       linea,
        cliente:     clienteRaw,
        alias:       alias,
        nit:         nit,
        comprobante: comprobante,
        factura:     factura,
        referencia:  referencia,
        valor_cop:   valor
      });
    });

    /* Ordenar: por semana ASC (numérico), luego fecha ASC */
    result.sort(function(a, b) {
      var na = parseInt(a.sem.slice(1), 10), nb = parseInt(b.sem.slice(1), 10);
      if (na !== nb) return na - nb;
      if (a.fecha && b.fecha) return a.fecha < b.fecha ? -1 : 1;
      return 0;
    });
    return result;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * parseCartera — Hoja 02_CARTERA
   * CRÍTICO: NUNCA leer DÍAS del Excel — siempre null al parsear, calcular en runtime
   * CRÍTICO: campos AGING pueden venir como texto "31-60 Dias"
   * ────────────────────────────────────────────────────────────────────────── */
  parseCartera: function(ws) {
    var rows = this._toRows(ws, 'SEMANA');
    var result = [];
    var c = this._col.bind(this);

    /* Helper: normalizar valores de aging (pueden venir como texto) */
    function parseAging(val) {
      if (!val && val !== 0) return 0;
      var s = String(val).replace(/[^\d.]/g, '');
      var n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    }

    rows.forEach(function(row, idx) {
      var sem = normSem(c(row, ['SEMANA']));
      if (!sem) return;

      var clienteRaw = String(c(row, ['CLIENTE (LEGAL)', 'CLIENTE LEGAL', 'CLIENTE']) || '').trim();
      if (!clienteRaw) return;

      var nit   = normNit(c(row, ['NIT']));
      var alias = String(c(row, ['CLIENTE ALIAS', 'ALIAS']) || '').trim() || getAliasCli(clienteRaw);
      var linea = normLinea(c(row, ['LÍNEA NEGOCIO', 'LINEA NEGOCIO', 'LINEA'])) || getLineaCli(clienteRaw);
      var factura = String(c(row, ['FACTURA', 'NRO. FACTURA', 'NRO FACTURA']) || '').trim();
      var fechaVcto = parseFecha(c(row, ['F. VENCIMIENTO', 'FECHA VENCIMIENTO', 'F VENCIMIENTO']));
      var semVcto   = String(c(row, ['SEM. VCTO.', 'SEM VCTO', 'SEMANA VCTO']) || '').trim();

      /* INVARIANTE: dias_vencido = null al parsear. Se calcula en runtime. */
      var total     = normNumero(c(row, ['TOTAL CARTERA', 'TOTAL']));
      var porVencer = normNumero(c(row, ['POR VENCER']));
      var ag030     = parseAging(c(row, ['AGING 0-30', 'AGING 0_30', '0-30 Dias', '0-30 DIAS']));
      var ag3160    = parseAging(c(row, ['AGING 31-60', 'AGING 31_60', '31-60 Dias', '31-60 DIAS']));
      var ag6190    = parseAging(c(row, ['AGING 61-90', 'AGING 61_90', '61-90 Dias', '61-90 DIAS',
                                         'AGING 61-90+', 'AGING +90']));

      var enNeg = !!(FIN_DATA.flags && FIN_DATA.flags.ci_garu_negociacion && nit === NIT_CI_GARU);

      result.push({
        id:                sem + '-' + factura + '-' + idx,
        sem:               sem,
        linea:             linea,
        cliente_alias:     alias,
        cliente_nit:       nit,
        cliente:           clienteRaw,
        nro_factura:       factura,
        fecha_vencimiento: fechaVcto ? fechaVcto.toISOString() : null,
        semana_vencimiento:normSem(semVcto) || semVcto,
        dias_vencido:      null,   /* calculado en runtime — NUNCA del Excel */
        total_cop:         total,
        por_vencer_cop:    porVencer,
        aging_0_30_cop:    ag030,
        aging_31_60_cop:   ag3160,
        aging_61_90_cop:   ag6190,
        en_negociacion:    enNeg
      });
    });

    return result;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * parseBancos — Hoja 03_BANCOS
   * CRÍTICO: Columna C (a veces etiquetada LÍNEA NEGOCIO) contiene 'Salida'/'Entrada'
   *          que es el TIPO de movimiento, NO la línea de negocio
   * Preservar signo negativo en valor_cop (salidas < 0)
   * ────────────────────────────────────────────────────────────────────────── */
  parseBancos: function(ws) {
    var rows = this._toRows(ws, 'FECHA');
    var result = [];
    var c = this._col.bind(this);

    rows.forEach(function(row, idx) {
      var sem   = normSem(c(row, ['SEMANA']));
      if (!sem) return;
      var fecha = parseFecha(c(row, ['FECHA']));

      /*
       * TIPO DE MOVIMIENTO: puede estar en 'TIPO' (col D) o en la col C
       * que el Excel etiqueta como 'LÍNEA NEGOCIO' pero contiene 'Salida'/'Entrada'
       */
      var tipoRaw = String(c(row, ['TIPO', 'TIPO MOVIMIENTO']) || '').trim().toUpperCase();
      if (!tipoRaw || (tipoRaw !== 'ENTRADA' && tipoRaw !== 'SALIDA')) {
        /* Intentar desde col C (etiquetada erróneamente) */
        var colC = String(c(row, ['LÍNEA NEGOCIO', 'LINEA NEGOCIO', 'LINEA']) || '').trim().toUpperCase();
        if (colC === 'ENTRADA' || colC.indexOf('ENTR') !== -1) tipoRaw = 'ENTRADA';
        else if (colC === 'SALIDA' || colC.indexOf('SAL') !== -1) tipoRaw = 'SALIDA';
      }

      var valor       = normNumero(c(row, ['VALOR (COP)', 'VALOR COP', 'VALOR']));
      var terceroAlias= String(c(row, ['TERCERO ALIAS', 'ALIAS']) || '').trim();
      var terceroNom  = String(c(row, ['TERCERO (COMPLETO)', 'TERCERO COMPLETO', 'TERCERO', 'NOMBRE']) || '').trim();
      var concepto    = String(c(row, ['CONCEPTO']) || '').trim();

      /* Inferir tipo desde signo si aún no está definido */
      if (!tipoRaw) tipoRaw = valor >= 0 ? 'ENTRADA' : 'SALIDA';

      /* Garantizar coherencia signo / tipo */
      if (tipoRaw === 'ENTRADA' && valor < 0) valor = Math.abs(valor);
      if (tipoRaw === 'SALIDA'  && valor > 0) valor = -valor;

      /* Inferir línea de negocio desde el nombre del tercero */
      var linea = getLineaCli(terceroNom) || getLineaCli(terceroAlias);

      result.push({
        id:             sem + '-' + idx,
        sem:            sem,
        fecha:          fecha ? fecha.toISOString().slice(0, 10) : null,
        tipo_movimiento:tipoRaw || 'SALIDA',
        tercero_alias:  terceroAlias,
        tercero_nombre: terceroNom,
        concepto:       concepto,
        valor_cop:      valor,
        linea:          linea
      });
    });

    return result;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * parseSaldos — Hoja 04_SALDOS
   * CRÍTICO: NUNCA leer DÍAS ni ESTADO del Excel
   * ────────────────────────────────────────────────────────────────────────── */
  parseSaldos: function(ws) {
    var rows = this._toRows(ws, 'MANIFIESTO');
    var result = [];
    var c = this._col.bind(this);

    rows.forEach(function(row) {
      var sem = normSem(c(row, ['SEMANA']));
      if (!sem) return;

      var manifiesto = String(c(row, ['MANIFIESTO', 'NRO MANIFIESTO', 'NRO. MANIFIESTO']) || '').trim();
      if (!manifiesto) return;

      var clienteRaw = String(c(row, ['CLIENTE (LEGAL)', 'CLIENTE LEGAL', 'CLIENTE']) || '').trim();
      var linea      = normLinea(c(row, ['LÍNEA NEGOCIO', 'LINEA NEGOCIO', 'LINEA'])) || getLineaCli(clienteRaw);
      var alias      = String(c(row, ['CLIENTE ALIAS', 'ALIAS']) || '').trim() || getAliasCli(clienteRaw);
      var poseedor   = String(c(row, ['POSEEDOR']) || '').trim();
      var ccPoseedor = normNit(c(row, ['CC POSEEDOR', 'CC_POSEEDOR', 'IDENTIFICACION POSEEDOR']));
      var placa      = String(c(row, ['VEHÍCULO', 'VEHICULO', 'PLACA']) || '').trim().toUpperCase();
      var origen     = String(c(row, ['ORIGEN']) || '').trim();
      var destino    = String(c(row, ['DESTINO']) || '').trim();
      var fEmision   = parseFecha(c(row, ['F. EMISIÓN', 'FECHA EMISION', 'F EMISION', 'F. EMISION']));
      var fVcto      = parseFecha(c(row, ['F. VENCIMIENTO', 'FECHA VENCIMIENTO', 'F VENCIMIENTO']));
      var valor      = normNumero(c(row, ['VALOR (COP)', 'VALOR COP', 'VALOR']));

      /* INVARIANTE: dias_para_pago = null, estado_pago = null → calculados en runtime */
      result.push({
        id:                manifiesto,
        sem:               sem,
        linea:             linea,
        cliente_alias:     alias,
        cliente:           clienteRaw,
        poseedor_nombre:   poseedor,
        poseedor_id:       ccPoseedor,
        placa_vehiculo:    placa,
        origen:            origen,
        destino:           destino,
        fecha_emision:     fEmision   ? fEmision.toISOString() : null,
        fecha_vencimiento: fVcto      ? fVcto.toISOString()    : null,
        dias_para_pago:    null,   /* runtime */
        estado_pago:       null,   /* runtime */
        valor_cop:         valor
      });
    });

    return result;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * parseAdmin — Hoja 05_ADMINISTRATIVOS
   * CRÍTICO: valor_cop puede ser null → usar provision_cop
   * CRÍTICO: estado y días siempre calculados en runtime
   * ────────────────────────────────────────────────────────────────────────── */
  parseAdmin: function(ws) {
    var rows = this._toRows(ws, 'BENEFICIARIO');
    var result = [];
    var c = this._col.bind(this);

    rows.forEach(function(row, idx) {
      var sem = normSem(c(row, ['SEMANA']));
      if (!sem) return;

      var beneficiario = String(c(row, ['BENEFICIARIO']) || '').trim();
      if (!beneficiario) return;

      /* Saltar filas que son etiquetas de estado (cols 0-1 tienen 'HOY/PRONTO', etc.) */
      var b_up = beneficiario.toUpperCase();
      if (b_up === 'HOY/PRONTO' || b_up === 'VIGENTE' || b_up === 'VENCIDO' ||
          b_up === 'ESTADO' || b_up === 'BENEFICIARIO') return;

      var identificacion = String(c(row, ['IDENTIFICACIÓN', 'IDENTIFICACION', 'NIT', 'CC']) || '').trim();
      var tipoPago       = String(c(row, ['TIPO PAGO', 'TIPO DE PAGO', 'TIPO']) || 'ADMINISTRATIVO').trim();
      var fVcto          = parseFecha(c(row, ['F. VENCIMIENTO', 'FECHA VENCIMIENTO', 'F VENCIMIENTO', 'F. VENCTO']));
      var valor          = normNumero(c(row, ['VALOR (COP)', 'VALOR COP', 'VALOR']));
      var provision      = normNumero(c(row, ['PROVISIÓN', 'PROVISION']));
      var diferencia     = normNumero(c(row, ['DIFERENCIA']));
      var medioPago      = String(c(row, ['MEDIO PAGO', 'MEDIO DE PAGO']) || 'TRANSFERENCIA').trim();
      var observaciones  = String(c(row, ['OBSERVACIONES']) || '').trim();

      result.push({
        id:                sem + '-' + normNit(identificacion) + '-' + idx,
        sem:               sem,
        beneficiario:      beneficiario,
        identificacion:    identificacion,
        tipo_pago:         tipoPago,
        fecha_vencimiento: fVcto ? fVcto.toISOString() : null,
        valor_cop:         valor,
        provision_cop:     provision,
        diferencia_cop:    diferencia || (valor - provision),
        medio_pago:        medioPago,
        observaciones:     observaciones,
        estado:            null,        /* runtime */
        dias_para_pago:    null         /* runtime */
      });
    });

    return result;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * parseBalance — Hoja 06_BALANCE
   * No tiene cabecera estándar. Se parsea buscando patrones de campo/valor.
   * Retorna objeto plano con todos los campos del balance consolidado.
   * ────────────────────────────────────────────────────────────────────────── */
  parseBalance: function(ws) {
    if (!ws) return {};
    var arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    var balance = {};

    /* Mapas de campos: etiqueta (parcial, mayúsculas) → clave del objeto */
    var CAMPO_MAP = {
      'CARTERA LIQUIDA':           'cartera_liquida_total_cop',
      'CARTERA SECA':              'cartera_seca_total_cop',
      'CARTERA TOTAL':             'cartera_total_cop',
      'CARTERA VENCIDA LIQUIDA':   'cartera_vencida_liquida_cop',
      'CARTERA VENCIDA SECA':      'cartera_vencida_seca_cop',
      'CARTERA VENCIDA TOTAL':     'cartera_vencida_total_cop',
      'SALDOS LIQUIDA':            'saldos_liquida_cop',
      'SALDOS SECA':               'saldos_seca_cop',
      'SALDOS TOTAL':              'saldos_total_cop',
      'SALDOS VENCIDOS':           'saldos_vencidos_cop',
      'BANCOS ENTRADAS':           'bancos_entradas_cop',
      'BANCOS SALIDAS':            'bancos_salidas_cop',
      'BANCOS NETO':               'bancos_neto_cop',
      'GASTOS ADMIN':              'gastos_admin_cop'
    };

    arr.forEach(function(row) {
      if (!row) return;
      for (var ci = 0; ci < row.length - 1; ci++) {
        var label = String(row[ci] || '').toUpperCase().trim();
        var val   = normNumero(row[ci + 1]);
        for (var k in CAMPO_MAP) {
          if (label.indexOf(k) !== -1) {
            balance[CAMPO_MAP[k]] = val;
            break;
          }
        }
      }
    });

    return balance;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * parseFlujo — Hoja 07_FLUJO_CAJA
   * Columnas: SEMANA · FECHA · CLASIFICACIÓN · CUENTAS · CONCEPTO · DESCRIPCIÓN · VALOR
   * ────────────────────────────────────────────────────────────────────────── */
  parseFlujo: function(ws) {
    var rows = this._toRows(ws, 'CLASIFICACI');
    var result = [];
    var c = this._col.bind(this);

    rows.forEach(function(row, idx) {
      var clasificacion = String(c(row, ['CLASIFICACIÓN', 'CLASIFICACION']) || '').trim().toUpperCase();
      if (clasificacion !== 'ACTIVOS' && clasificacion !== 'PASIVOS') return;

      var sem         = normSem(c(row, ['SEMANA']));
      var fecha       = parseFecha(c(row, ['FECHA']));
      var cuentas     = String(c(row, ['CUENTAS', 'CUENTA']) || '').trim().toUpperCase();
      var concepto    = String(c(row, ['CONCEPTO']) || '').trim();
      var descripcion = String(c(row, ['DESCRIPCIÓN', 'DESCRIPCION']) || '').trim();
      var valor       = normNumero(c(row, ['VALOR', 'VALOR (COP)', 'VALOR COP']));

      /* Detectar si es subtotal o KPI */
      var esSubtotal = !cuentas && !concepto && valor !== 0;
      var esKpi = concepto &&
                  (concepto.toUpperCase().indexOf('LIQUIDEZ') !== -1 ||
                   concepto.toUpperCase().indexOf('COBERTURA') !== -1 ||
                   concepto.toUpperCase().indexOf('PRESIÓN') !== -1 ||
                   concepto.toUpperCase().indexOf('PRESION') !== -1 ||
                   concepto.toUpperCase().indexOf('DEUDA') !== -1 ||
                   concepto.toUpperCase().indexOf('POSICI') !== -1);

      result.push({
        id:            sem + '-' + clasificacion + '-' + idx,
        sem:           sem,
        fecha:         fecha ? fecha.toISOString().slice(0, 10) : null,
        clasificacion: clasificacion,
        cuentas:       cuentas,
        concepto:      concepto,
        descripcion:   descripcion,
        valor_cop:     valor,
        es_subtotal:   !!esSubtotal,
        es_kpi:        !!esKpi,
        orden:         idx
      });
    });

    return result;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * validarIntegridad — Verifica que el workbook procesado cumple los requisitos
   * V1 es bloqueante, V2-V4 son advertencias
   * ────────────────────────────────────────────────────────────────────────── */
  validarIntegridad: function() {
    /* V1 (BLOQUEANTE): debe haber al menos 1 factura */
    if (!FIN_DATA.fact || FIN_DATA.fact.length === 0) {
      toast('⚠ No se encontraron facturas (01_FACTURACION). Verifica el archivo.', 'err');
      return false;
    }
    /* V2 (ADVERTENCIA): semana activa detectada */
    if (!FIN_DATA.semanaActual) {
      toast('⚠ No se detectó semana activa. Verifica 00_CONFIG.', 'warn');
    }
    /* V3 (ADVERTENCIA): al menos 4 hojas con datos */
    var hojasCargadas = ['fact','cartera','bancos','saldos','adm','flujo']
      .filter(function(k) {
        var v = FIN_DATA[k];
        return v && (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0);
      }).length;
    if (hojasCargadas < 4) {
      toast('⚠ Solo ' + hojasCargadas + ' hojas con datos. Verifica el Maestro.', 'warn');
    }
    /* V4 (ADVERTENCIA): tamaño del payload */
    var bytes = JSON.stringify({ fin: FIN_DATA, meta: FIN_META }).length;
    if (bytes > 8000000) {
      toast('⚠ Payload > 8 MB (' + Math.round(bytes/1e6) + ' MB). Considera fragmentar.', 'warn');
    }
    return true;
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * archivarBalance — Guarda snapshot del balance en el historial acumulado
   * Idempotente: reemplaza si ya existe la semana
   * ────────────────────────────────────────────────────────────────────────── */
  archivarBalance: function(semana) {
    if (!FIN_DATA.historico_balance) FIN_DATA.historico_balance = [];
    var existeIdx = FIN_DATA.historico_balance.findIndex
      ? FIN_DATA.historico_balance.findIndex(function(h) { return h.semana === semana; })
      : -1;
    var entry = { semana: semana, balance: JSON.parse(JSON.stringify(FIN_DATA.balance)) };
    if (existeIdx >= 0) {
      FIN_DATA.historico_balance[existeIdx] = entry;
    } else {
      FIN_DATA.historico_balance.push(entry);
    }
    /* Mantener solo las últimas 52 entradas */
    if (FIN_DATA.historico_balance.length > 52) {
      FIN_DATA.historico_balance = FIN_DATA.historico_balance.slice(-52);
    }
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * procesarMaestro — Orquestador principal del pipeline de parsing
   * Referencia: 07_Backend_Services sección 15 (11 pasos)
   * ────────────────────────────────────────────────────────────────────────── */
  procesarMaestro: function(wb, nombreArchivo) {
    var self = this;
    toast('Procesando hojas…', 'info');

    /* PASO 1: Detectar semana activa */
    var semana = self.detectSemana(wb);
    FIN_DATA.semanaActual = semana;

    var hojas = wb.SheetNames || [];

    /* PASO 2: Parsear las 7 hojas transaccionales */
    FIN_DATA.fact    = hojas.indexOf('01_FACTURACION')   !== -1 ? self.parseFact(wb.Sheets['01_FACTURACION'])   : [];
    FIN_DATA.cartera = hojas.indexOf('02_CARTERA')       !== -1 ? self.parseCartera(wb.Sheets['02_CARTERA'])     : [];
    FIN_DATA.bancos  = hojas.indexOf('03_BANCOS')        !== -1 ? self.parseBancos(wb.Sheets['03_BANCOS'])       : [];
    FIN_DATA.saldos  = hojas.indexOf('04_SALDOS')        !== -1 ? self.parseSaldos(wb.Sheets['04_SALDOS'])       : [];
    FIN_DATA.adm     = hojas.indexOf('05_ADMINISTRATIVOS')!== -1? self.parseAdmin(wb.Sheets['05_ADMINISTRATIVOS']): [];
    FIN_DATA.balance = hojas.indexOf('06_BALANCE')       !== -1 ? self.parseBalance(wb.Sheets['06_BALANCE'])     : {};
    FIN_DATA.flujo   = hojas.indexOf('07_FLUJO_CAJA')    !== -1 ? self.parseFlujo(wb.Sheets['07_FLUJO_CAJA'])    : [];

    /* Nombres de hoja alternativos (algunos archivos usan variantes) */
    if (FIN_DATA.fact.length    === 0 && hojas.indexOf('FACTURACION')    !== -1)
      FIN_DATA.fact    = self.parseFact(wb.Sheets['FACTURACION']);
    if (FIN_DATA.cartera.length === 0 && hojas.indexOf('CARTERA')        !== -1)
      FIN_DATA.cartera = self.parseCartera(wb.Sheets['CARTERA']);
    if (FIN_DATA.bancos.length  === 0 && hojas.indexOf('BANCOS')         !== -1)
      FIN_DATA.bancos  = self.parseBancos(wb.Sheets['BANCOS']);
    if (FIN_DATA.saldos.length  === 0 && hojas.indexOf('SALDOS')         !== -1)
      FIN_DATA.saldos  = self.parseSaldos(wb.Sheets['SALDOS']);
    if (FIN_DATA.adm.length     === 0 && hojas.indexOf('ADMINISTRATIVOS') !== -1)
      FIN_DATA.adm     = self.parseAdmin(wb.Sheets['ADMINISTRATIVOS']);

    /* PASO 3: Construir índice de semanas únicas ordenadas */
    var semSet = {};
    FIN_DATA.fact.forEach(function(r) { if (r.sem) semSet[r.sem] = 1; });
    FIN_DATA.semanas = Object.keys(semSet).sort(function(a, b) {
      return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
    });

    /* PASO 4: Archivar balance */
    self.archivarBalance(semana);

    /* PASO 5: Validar integridad (bloqueante si V1 falla) */
    if (!self.validarIntegridad()) return false;

    /* PASO 6: Construir metadata */
    FIN_META = {
      updatedAt:       new Date().toISOString(),
      src:             'excel',
      version:         'v2',
      totalFacturas:   FIN_DATA.fact.length,
      semanaDetectada: semana,
      archivoCargado:  nombreArchivo || ''
    };

    /* PASO 7: Persistir en localStorage (siempre) */
    finData.saveMem();

    /* PASO 8: Persistir en Supabase (solo si puede editar) */
    if (FIN_CAN_EDIT) {
      FIN_SRC = 'supabase';
      finData.saveCloud({ fin: FIN_DATA, meta: FIN_META });
    } else {
      FIN_SRC = 'local';
    }

    /* PASO 9: Actualizar UI */
    updateHdrChip(FIN_SRC);
    if (typeof _actualizarFooterMeta === 'function') _actualizarFooterMeta();
    finFilter.rebuild();
    finAlerts.detectar();
    refresh();

    /* PASO 10: Auditoría B01 */
    finAudit.registrar('B01', {
      archivo:   nombreArchivo || '',
      semana:    semana,
      registros: {
        fact:    FIN_DATA.fact.length,
        cartera: FIN_DATA.cartera.length,
        bancos:  FIN_DATA.bancos.length,
        saldos:  FIN_DATA.saldos.length,
        adm:     FIN_DATA.adm.length
      },
      bytes: JSON.stringify({ fin: FIN_DATA, meta: FIN_META }).length
    });

    /* Actualizar subtítulo del header */
    var sub = document.getElementById('finHdrSub');
    if (sub && semana) sub.textContent = 'Módulo financiero · ' + semana;

    toast('✓ S' + semana + ' procesado · ' + FIN_DATA.fact.length + ' facturas', 'ok');

    /* Cerrar modal si está abierto */
    var modalBg  = document.getElementById('finModalBg');
    var modalMae = document.getElementById('finModalMaestro');
    if (modalBg)  modalBg.classList.remove('show');
    if (modalMae) modalMae.style.display = 'none';

    return true;
  }
};

/* Alias de compatibilidad */
function abrirModalMaestro() {
  if (!FIN_CAN_EDIT) { toast('Sin permisos para cargar datos', 'warn'); return; }
  var bg  = document.getElementById('finModalBg');
  var mod = document.getElementById('finModalMaestro');
  if (bg && mod) {
    bg.querySelectorAll('.fin-modal').forEach(function(m) { m.style.display = 'none'; });
    mod.style.display = '';
    bg.classList.add('show');
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-6 · FIN.Filter — Gestión de filtros globales
   ══════════════════════════════════════════════════════════════════════════════ */

var finFilter = {

  /**
   * apply — Filtra cualquier array de registros según FIN_FILTERS activos
   * Función pura: no muta el array original
   */
  apply: function(arr) {
    if (!arr || !arr.length) return [];
    var f = FIN_FILTERS;
    return arr.filter(function(r) {
      /* Filtro línea */
      if (f.linea !== 'TODOS') {
        var rLinea = r.linea || r.linea_negocio_id || '';
        if (rLinea && rLinea !== f.linea) return false;
      }
      /* Filtro mes — solo aplica a registros que tienen campo mes */
      if (f.mes !== 'TODOS' && r.mes !== undefined) {
        if (r.mes && r.mes !== f.mes) return false;
      }
      /* Filtro semana */
      if (f.sem !== 'TODOS') {
        var rSem = r.sem || '';
        if (rSem && rSem !== f.sem) return false;
      }
      /* Filtro cliente */
      if (f.cli !== 'TODOS') {
        var rAlias  = r.alias || r.cliente_alias || '';
        var rCliente = r.cliente || r.cliente_razon_social || '';
        if (rAlias !== f.cli && rCliente !== f.cli) return false;
      }
      return true;
    });
  },

  /**
   * applyGlobal — Lee selectores del DOM, actualiza FIN_FILTERS, dispara refresh
   * Incluye debounce de 200ms para evitar renders múltiples en cambios rápidos
   */
  applyGlobal: function() {
    clearTimeout(FIN_DEBOUNCE_T);
    FIN_DEBOUNCE_T = setTimeout(function() {
      var selLinea = document.getElementById('finFilGLinea');
      var selMes   = document.getElementById('finFilGMes');
      var selSem   = document.getElementById('finFilGSem');
      var selCli   = document.getElementById('finFilGCli');

      FIN_FILTERS.linea = (selLinea && selLinea.value) ? selLinea.value : 'TODOS';
      FIN_FILTERS.mes   = (selMes   && selMes.value)   ? selMes.value   : 'TODOS';
      FIN_FILTERS.sem   = (selSem   && selSem.value)   ? selSem.value   : 'TODOS';
      FIN_FILTERS.cli   = (selCli   && selCli.value)   ? selCli.value   : 'TODOS';

      /* Mostrar/ocultar botón de limpiar */
      var hasFilter = FIN_FILTERS.linea !== 'TODOS' || FIN_FILTERS.mes  !== 'TODOS' ||
                      FIN_FILTERS.sem   !== 'TODOS' || FIN_FILTERS.cli  !== 'TODOS';
      var resetBtn = document.getElementById('finGfReset');
      if (resetBtn) resetBtn.style.display = hasFilter ? 'inline-flex' : 'none';

      /* Si el mes cambió, reconstruir las semanas disponibles para ese mes */
      finFilter.rebuild();
      refresh();
    }, 200);
  },

  /**
   * resetFilters — Limpia todos los filtros activos
   */
  resetFilters: function() {
    FIN_FILTERS = { linea: 'TODOS', mes: 'TODOS', sem: 'TODOS', cli: 'TODOS' };
    ['finFilGLinea','finFilGMes','finFilGSem','finFilGCli'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = 'TODOS';
    });
    var resetBtn = document.getElementById('finGfReset');
    if (resetBtn) resetBtn.style.display = 'none';
    refresh();
  },

  /**
   * rebuild — Reconstruye las opciones dinámicas de Mes, Semana y Cliente
   * basándose en los datos actuales de FIN_DATA
   */
  rebuild: function() {
    /* MESES: únicos y ordenados desde fact[] */
    var mesesSet = {};
    (FIN_DATA.fact || []).forEach(function(r) {
      if (r.mes) mesesSet[r.mes] = 1;
    });
    var meses = Object.keys(mesesSet).sort();
    var selMes = document.getElementById('finFilGMes');
    if (selMes) {
      var prevMes = selMes.value;
      selMes.innerHTML = '<option value="TODOS">Todos los meses</option>';
      meses.forEach(function(m) {
        var opt = document.createElement('option');
        opt.value = m;
        opt.textContent = formatMes(m);
        selMes.appendChild(opt);
      });
      if (prevMes && meses.indexOf(prevMes) !== -1) selMes.value = prevMes;
    }

    /* SEMANAS: únicas y ordenadas desde FIN_DATA.semanas */
    /* Si hay un mes activo, filtrar solo semanas de ese mes */
    var semanasDisp = (FIN_DATA.semanas || []).filter(function(s) {
      if (FIN_FILTERS.mes === 'TODOS') return true;
      return SEMANA_MES_MAP[s] === FIN_FILTERS.mes;
    });
    var selSem = document.getElementById('finFilGSem');
    if (selSem) {
      var prevSem = selSem.value;
      selSem.innerHTML = '<option value="TODOS">Todas las semanas</option>';
      semanasDisp.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        selSem.appendChild(opt);
      });
      if (prevSem && semanasDisp.indexOf(prevSem) !== -1) selSem.value = prevSem;
      else if (prevSem !== 'TODOS') selSem.value = 'TODOS';
    }

    /* CLIENTES: únicos, ordenados A-Z desde fact[] */
    var cliSet = {};
    (FIN_DATA.fact || []).forEach(function(r) {
      var a = r.alias || r.cliente || '';
      if (a) cliSet[a] = 1;
    });
    var clientes = Object.keys(cliSet).sort();
    var selCli = document.getElementById('finFilGCli');
    if (selCli) {
      var prevCli = selCli.value;
      selCli.innerHTML = '<option value="TODOS">Todos los clientes</option>';
      clientes.forEach(function(a) {
        var opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        selCli.appendChild(opt);
      });
      if (prevCli && clientes.indexOf(prevCli) !== -1) selCli.value = prevCli;
    }

    /* Actualizar contador de registros */
    var gfInfo = document.getElementById('finGfInfo');
    if (gfInfo) {
      var n = finFilter.apply(FIN_DATA.fact || []).length;
      gfInfo.textContent = n.toLocaleString('es-CO') + ' registros';
    }
  },

  /**
   * getGlobal — Retorna una copia del estado actual de los filtros
   */
  getGlobal: function() {
    return JSON.parse(JSON.stringify(FIN_FILTERS));
  }
};

/* Alias globales para compatibilidad con listeners HTML inline */
function fApplyGlobal()   { finFilter.applyGlobal(); }
function fResetFilters()  { finFilter.resetFilters(); }

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-7 · FIN.Alerts — Sistema de detección y notificación de alertas
   ══════════════════════════════════════════════════════════════════════════════ */

var finAlerts = {

  /**
   * detectar — Punto de entrada: analiza FIN_DATA y actualiza todos los indicadores
   * Llamado al final de refresh()
   */
  detectar: function() {
    var cartCrit = finAlerts.detectarCarteraCritica();
    var saldVenc = finAlerts.detectarSaldos();
    var admVenc  = finAlerts.detectarAdministrativos();
    finAlerts.notifyHeader(cartCrit, saldVenc, admVenc);
  },

  /**
   * detectarCarteraCritica — Facturas en aging 61-90+ días (excluye negociación)
   */
  detectarCarteraCritica: function() {
    var count = 0;
    (FIN_DATA.cartera || []).forEach(function(r) {
      /* Excluir CI GARU si está marcado en negociación */
      if (r.en_negociacion) return;
      if (r.aging_61_90_cop && r.aging_61_90_cop > 0) count++;
      else {
        /* Calcular en runtime si no viene del Excel */
        var dias = calcDias(r.fecha_vencimiento);
        if (dias !== null && dias <= -61) count++;
      }
    });
    finAlerts._setBadge('finSbCartAlert', count);
    /* Activar banner CI GARU si tiene facturas críticas */
    var ciGaruTotal = (FIN_DATA.cartera || []).reduce(function(sum, r) {
      return r.cliente_nit === NIT_CI_GARU ? sum + (r.total_cop || 0) : sum;
    }, 0);
    var alertCiGaru = document.getElementById('finCarteraAlertCiGaru');
    if (alertCiGaru) {
      if (ciGaruTotal > 0 && !((FIN_DATA.flags || {}).ci_garu_negociacion)) {
        alertCiGaru.style.display = '';
        var descEl = document.getElementById('finCiGaruAlertBody');
        if (descEl) descEl.textContent =
          'CI GARU acumula ' + shortN(ciGaruTotal) +
          ' en cartera sin cobrar · Aging crítico · Riesgo MUY ALTO';
      } else {
        alertCiGaru.style.display = 'none';
      }
    }
    return count;
  },

  /**
   * detectarSaldos — Manifiestos con fecha de vencimiento pasada
   */
  detectarSaldos: function() {
    var count = 0;
    (FIN_DATA.saldos || []).forEach(function(r) {
      var dias = calcDias(r.fecha_vencimiento);
      if (dias !== null && dias < 0) count++;
    });
    finAlerts._setBadge('finSbSaldAlert', count);
    /* Banner dentro de vista Saldos */
    var alertSald = document.getElementById('finSaldosAlertBanner');
    if (alertSald) {
      if (count > 0) {
        alertSald.style.display = '';
        var txtEl = document.getElementById('finSaldosAlertTxt');
        if (txtEl) txtEl.textContent =
          count + ' manifiesto' + (count !== 1 ? 's' : '') + ' vencido' + (count !== 1 ? 's' : '');
      } else {
        alertSald.style.display = 'none';
      }
    }
    return count;
  },

  /**
   * detectarAdministrativos — Compromisos con estado VENCIDO
   */
  detectarAdministrativos: function() {
    var count = 0;
    (FIN_DATA.adm || []).forEach(function(r) {
      var dias = calcDias(r.fecha_vencimiento);
      if (dias !== null && dias < 0) count++;
    });
    finAlerts._setBadge('finSbAdmAlert', count);
    /* Banner dentro de vista Admin */
    var alertAdm = document.getElementById('finAdminAlertBanner');
    if (alertAdm) {
      if (count > 0) {
        alertAdm.style.display = '';
        var bodyEl = document.getElementById('finAdminAlertBody');
        if (bodyEl) bodyEl.textContent =
          count + ' compromiso' + (count !== 1 ? 's' : '') + ' vencido' + (count !== 1 ? 's' : '') +
          ' · Requieren atención inmediata';
      } else {
        alertAdm.style.display = 'none';
      }
    }
    return count;
  },

  /**
   * notifyHeader — Actualiza el alert pill del header y badge global
   */
  notifyHeader: function(cartCrit, saldVenc, admVenc) {
    var total = cartCrit + saldVenc + admVenc;

    /* Badge de resumen ejecutivo */
    finAlerts._setBadge('finSbResAlert', total);

    /* Alert pill del header */
    var pill    = document.getElementById('finHdrAlertPill');
    var pillTxt = document.getElementById('finHdrAlertTxt');
    if (pill) {
      if (total > 0) {
        pill.style.display = 'inline-flex';
        if (pillTxt) pillTxt.textContent =
          total + ' alerta' + (total !== 1 ? 's' : '') + ' crítica' + (total !== 1 ? 's' : '');
      } else {
        pill.style.display = 'none';
      }
    }

    /* Banner de resumen ejecutivo */
    var resBanner = document.getElementById('finResumenAlertBanner');
    if (resBanner) {
      if (total > 0) {
        resBanner.style.display = '';
        var resTxt = document.getElementById('finResumenAlertTxt');
        if (resTxt) {
          var partes = [];
          if (cartCrit > 0) partes.push(cartCrit + ' en cartera');
          if (saldVenc > 0) partes.push(saldVenc + ' saldo' + (saldVenc!==1?'s':'') + ' vencido');
          if (admVenc  > 0) partes.push(admVenc  + ' compromiso' + (admVenc!==1?'s':'') + ' vencido');
          resTxt.textContent = partes.join(' · ');
        }
      } else {
        resBanner.style.display = 'none';
      }
    }
  },

  /**
   * _setBadge — Muestra u oculta un badge numérico del sidebar
   */
  _setBadge: function(id, count) {
    var el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.style.display  = 'inline-flex';
      el.textContent    = count > 9 ? '9+' : String(count);
    } else {
      el.style.display  = 'none';
      el.textContent    = '';
    }
  }
};

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-8 · refresh() — Único ciclo oficial de render
   Referencia: 07_Backend_Services sección 3.2
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * refresh — Punto de control único del ciclo visual.
 * Precondición: FIN_DATA puede estar vacío (se maneja internamente).
 * NO renderiza KPIs, tablas ni gráficos — eso corresponde a Fases D–F.
 * SÍ actualiza: header, filtros, alertas, datos calculados, footer, empty states.
 */
function refresh() {
  /* 1. ¿Hay datos mínimos? */
  var hayDatos = (FIN_DATA.fact    && FIN_DATA.fact.length    > 0) ||
                 (FIN_DATA.cartera && FIN_DATA.cartera.length > 0) ||
                 (FIN_DATA.balance && Object.keys(FIN_DATA.balance).length > 0);

  var emptyEl = document.getElementById('finEmpty');

  if (!hayDatos) {
    if (emptyEl) emptyEl.style.display = 'flex';
    /* Asegurarse de que todas las vistas están ocultas */
    document.querySelectorAll('.fin-view').forEach(function(v) {
      v.style.display = 'none';
    });
    return;
  }

  /* 2. Ocultar empty state global */
  if (emptyEl) emptyEl.style.display = 'none';

  /* 3. Actualizar subtítulo del header con semana activa */
  var sub = document.getElementById('finHdrSub');
  if (sub) {
    sub.textContent = 'Módulo financiero' +
                      (FIN_DATA.semanaActual ? ' · ' + FIN_DATA.semanaActual : '');
  }

  /* 4. Reconstruir filtros (preserva selección si sigue siendo válida) */
  finFilter.rebuild();

  /* 5. Actualizar contador de registros en filter bar */
  var gfInfo = document.getElementById('finGfInfo');
  if (gfInfo) {
    var n = finFilter.apply(FIN_DATA.fact || []).length;
    gfInfo.textContent = n.toLocaleString('es-CO') + ' registros';
  }

  /* 6. Calcular y enriquecer registros con valores de runtime
        (días, estado, monto efectivo) — sin modificar los datos originales,
        se calculan aquí para que los renderers los encuentren listos */
  var _hoy = new Date(); _hoy.setHours(0,0,0,0);
  (FIN_DATA.cartera || []).forEach(function(r) {
    r.dias_vencido = calcDias(r.fecha_vencimiento);
    r.bucket       = bucketAging(r.dias_vencido);
  });
  (FIN_DATA.saldos || []).forEach(function(r) {
    r.dias_para_pago = calcDias(r.fecha_vencimiento);
    r.estado_pago    = estadoSaldo(r.dias_para_pago);
  });
  (FIN_DATA.adm || []).forEach(function(r) {
    r.dias_para_pago  = calcDias(r.fecha_vencimiento);
    r.estado          = estadoAdmin(r.dias_para_pago);
    r.monto_efectivo  = montoEfectivoAdmin(r);
  });

  /* 7. Detectar alertas y actualizar indicadores */
  finAlerts.detectar();

  /* 8. Mostrar la vista activa (solo si el contenedor es correcto) */
  var target = document.getElementById('finView' + capitalize(FIN_CURRENT_VIEW));
  if (target) {
    /* Ocultar todas las demás vistas */
    document.querySelectorAll('.fin-view').forEach(function(v) {
      v.style.display = 'none';
    });
    target.style.display = 'block';
  }

  /* 9. Actualizar footer */
  if (typeof _actualizarFooterMeta === 'function') _actualizarFooterMeta();

  /* 10. Delegar a los renderers de vista si ya existen (Fases D–F) */
  var vistasRender = {
    'resumen':     typeof renderResumen     === 'function' ? renderResumen     : null,
    'balance':     typeof renderBalance     === 'function' ? renderBalance     : null,
    'flujo':       typeof renderFlujo       === 'function' ? renderFlujo       : null,
    'facturacion': typeof renderFacturacion === 'function' ? renderFacturacion : null,
    'cartera':     typeof renderCartera     === 'function' ? renderCartera     : null,
    'bancos':      typeof renderBancos      === 'function' ? renderBancos      : null,
    'saldos':      typeof renderSaldos      === 'function' ? renderSaldos      : null,
    'admin':       typeof renderAdmin       === 'function' ? renderAdmin       : null,
    'ia':          typeof renderIA          === 'function' ? renderIA          : null
  };
  var renderFn = vistasRender[FIN_CURRENT_VIEW];
  if (typeof renderFn === 'function') {
    try { renderFn(); } catch(e) {
      /* Atrapar errores del renderer sin romper el ciclo */
      console && console.error && console.error('[INLOP FIN] Error en renderer ' + FIN_CURRENT_VIEW + ':', e);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   BLOQUE C-9 · Integración Excel (file input + drag & drop)
   Reemplaza los stubs de Fase 8A con lógica real
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * _leerArchivoExcel — Lee un File object con FileReader y llama al parser
 */
function _leerArchivoExcel(file) {
  if (!file) return;

  /* Validación de tipo */
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    toast('❌ Solo se aceptan archivos .xlsx', 'err');
    return;
  }
  /* Validación de tamaño (15 MB máx) */
  if (file.size > 15 * 1024 * 1024) {
    toast('❌ El archivo supera 15 MB', 'err');
    return;
  }

  toast('Leyendo archivo…', 'info');

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
      finParser.procesarMaestro(wb, file.name);
    } catch(err) {
      toast('❌ No se pudo leer el archivo: ' + err.message, 'err');
    }
  };
  reader.onerror = function() {
    toast('❌ Error al leer el archivo', 'err');
  };
  reader.readAsBinaryString(file);
}

/* Registrar listeners de file input y drag & drop en DOMContentLoaded */
document.addEventListener('DOMContentLoaded', function() {

  /* ── File input del modal ────────────────────────────────── */
  var fileInput = document.getElementById('finFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      var f = e.target.files && e.target.files[0];
      if (f) _leerArchivoExcel(f);
      /* Resetear el input para permitir cargar el mismo archivo de nuevo */
      this.value = '';
    });
  }

  /* ── Click en drop zone → activa file input ─────────────── */
  var dropZone = document.getElementById('finDropZone');
  if (dropZone) {
    dropZone.addEventListener('click', function() {
      var fi = document.getElementById('finFileInput');
      if (fi) fi.click();
    });
    dropZone.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var fi = document.getElementById('finFileInput');
        if (fi) fi.click();
      }
    });
    /* Drag sobre la drop zone */
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) _leerArchivoExcel(f);
    });
  }

  /* ── Drag & drop global (sobre cualquier parte de la ventana) ─ */
  /* Reemplaza el stub de Fase 8A */
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    if (!FIN_CAN_EDIT) return;
    var ov = document.getElementById('finDragOv');
    if (ov) ov.classList.add('show');
  });
  document.addEventListener('dragleave', function(e) {
    if (!e.relatedTarget || !document.body.contains(e.relatedTarget)) {
      var ov = document.getElementById('finDragOv');
      if (ov) ov.classList.remove('show');
    }
  });
  document.addEventListener('drop', function(e) {
    e.preventDefault();
    var ov = document.getElementById('finDragOv');
    if (ov) ov.classList.remove('show');
    if (!FIN_CAN_EDIT) {
      toast('Solo editores y administradores pueden cargar datos', 'warn');
      return;
    }
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) _leerArchivoExcel(f);
  });

  /* ── Botón Procesar en el modal ──────────────────────────── */
  var btnProcesar = document.getElementById('finBtnProcesar');
  if (btnProcesar) {
    btnProcesar.addEventListener('click', function() {
      /* En Fase C el procesamiento ocurre directamente al seleccionar el archivo.
         Este botón queda como confirm secundario si se implementa preview en Fase D. */
      var fi = document.getElementById('finFileInput');
      if (fi) fi.click();
    });
  }

  /* ── Actualizar filtros al cambiar selectores ─────────────── */
  ['finFilGLinea','finFilGMes','finFilGSem','finFilGCli'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      /* Remover cualquier listener previo reemplazando con uno nuevo */
      el.addEventListener('change', function() { fApplyGlobal(); });
    }
  });

  /* ── Botón de reseteo de filtros ─────────────────────────── */
  var resetBtn = document.getElementById('finGfReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() { fResetFilters(); });
  }

  /* ── Botón Sincronizar ───────────────────────────────────── */
  var btnSync = document.getElementById('finBtnSync');
  if (btnSync) {
    /* Reasignar para usar la implementación de Fase 8B/C */
    btnSync.onclick = function() { finDataSync(); };
  }

  /* ── Botón Cargar Maestro ────────────────────────────────── */
  var btnMaestro = document.getElementById('finBtnCargarMaestro');
  if (btnMaestro) {
    btnMaestro.onclick = function() { abrirModalMaestro(); };
  }

  /* ── Cerrar modal al hacer click en X o cancelar ──────────── */
  ['finModalMaestroCerrar','finModalMaestroCancelar'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.onclick = function() {
        var bg  = document.getElementById('finModalBg');
        var mod = document.getElementById('finModalMaestro');
        if (bg)  bg.classList.remove('show');
        if (mod) mod.style.display = 'none';
      };
    }
  });

}); /* /DOMContentLoaded Fase 8C */

/* ════════════════════════════════════════════════════════════════════════════
   FIN JAVASCRIPT FASE 8C
   ════════════════════════════════════════════════════════════════════════════ */
