/* ================================================================
   charts.js — INLOP Business Intelligence
   Configuración compartida de Chart.js y helpers de escalas.
   ================================================================ */

/* ── Defaults globales de Chart.js ─────────────────────────────── */
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family         = "'DM Sans', sans-serif";
  Chart.defaults.color               = '#8099b8';
  Chart.defaults.responsive          = true;
  Chart.defaults.maintainAspectRatio = false;
  // IMPORTANTE: no reemplazar el objeto animation completo — solo el duration
  Chart.defaults.animation.duration  = 400;
}

/* ── Paleta de ejes y tooltips (compartida entre módulos) ──────── */
const AX      = '#a0b4cc';
const AX_GRID = 'rgba(160,180,210,.2)';
const TB_BG   = '#131b2a';
const TB_BD   = 'rgba(255,255,255,.18)';

const tip = {
  backgroundColor : TB_BG,
  borderColor     : TB_BD,
  borderWidth     : 1,
  titleColor      : '#fff',
  bodyColor       : '#c0cfe8',
  padding         : 11,
  titleFont       : { weight: '600' }
};

/* ── Escalas estándar para gráficas ────────────────────────────── */
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
      ...(min0         ? { beginAtZero: true } : {}),
      ...(yMin !== null ? { min: yMin }        : {})
    }
  };
}
