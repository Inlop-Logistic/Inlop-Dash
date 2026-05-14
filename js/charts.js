/* ================================================================
   charts.js — INLOP Business Intelligence
   Configuración compartida de Chart.js y helpers de escalas.
   Cargado DESPUÉS de Chart.js CDN y ANTES de operaciones.js / otif.js.

   Contiene:
     · Defaults globales de Chart.js
     · Constantes de paleta (AX, AX_GRID, tip)
     · chartScales() — escalas estándar para gráficas de operaciones
   NOTA: Las funciones buildTrend(), buildHisCharts(), ohRenderTrend()
         etc. permanecen en sus módulos porque usan variables de estado
         locales (WKS, oData, etc.). Este archivo solo provee config
         y helpers reutilizables.
   ================================================================ */

/* ── Defaults globales de Chart.js ─────────────────────────────── */
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family  = "'DM Sans', sans-serif";
  Chart.defaults.color        = '#8099b8';
  Chart.defaults.responsive   = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation    = { duration: 400 };
}

/* ── Paleta de ejes y tooltips (compartida entre módulos) ──────── */
const AX       = '#a0b4cc';
const AX_GRID  = 'rgba(160,180,210,.2)';
const TB_BG    = '#131b2a';
const TB_BD    = 'rgba(255,255,255,.18)';

/** Objeto de opciones de tooltip estándar INLOP */
const tip = {
  backgroundColor : TB_BG,
  borderColor     : TB_BD,
  borderWidth     : 1,
  titleColor      : '#fff',
  bodyColor       : '#c0cfe8',
  padding         : 11,
  titleFont       : { weight: '600' }
};

/* ── Escalas estándar para gráficas de operaciones ─────────────── */
/**
 * @param {boolean} min0   - Si true, el eje Y empieza en 0
 * @param {number|null} yMin - Valor mínimo manual del eje Y
 * @returns {object} Configuración de escalas para Chart.js
 */
function chartScales(min0 = false, yMin = null) {
  return {
    x: {
      grid  : { color: AX_GRID, drawBorder: true, borderColor: AX, tickColor: AX },
      ticks : { color: AX, font: { size: 11, weight: '500' } },
      border: { color: AX }
    },
    y: {
      grid  : { color: AX_GRID, drawBorder: true, borderColor: AX, tickColor: AX },
      ticks : { color: AX, font: { size: 11, weight: '500' } },
      border: { color: AX },
      ...(min0  ? { beginAtZero: true } : {}),
      ...(yMin !== null ? { min: yMin } : {})
    }
  };
}
