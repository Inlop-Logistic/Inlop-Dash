/* ================================================================
   utils.js — INLOP Business Intelligence
   Funciones utilitarias compartidas entre módulos.
   Cargado ANTES de operaciones.js, otif.js y app.js.

   Contiene:
     · toast()        — notificaciones visuales globales
     · fmtShort()     — formato de fecha corta
     · semToMes()     — conversión semana → mes (usado en reportes)
     · destroyChart() — destrucción segura de instancias Chart.js
   ================================================================ */

/* ── Toast / notificación visual global ─────────────────────────
   Usado por: operaciones.js, otif.js (vía typeof toast), app.js
   El <div id="toast"> existe en el HTML del view-ops.
   OTIF llama vía notif() que verifica typeof toast === 'function'.
   ──────────────────────────────────────────────────────────────── */
let _TOAST_TIMER;
function toast(msg, type = 'ok') {
  clearTimeout(_TOAST_TIMER);
  const t = document.getElementById('toast');
  if (!t) return;
  t.className = 'toast';
  t.textContent = '';
  requestAnimationFrame(() => {
    t.textContent = msg;
    t.className = 'toast show ' + type;
    _TOAST_TIMER = setTimeout(() => { t.className = 'toast'; }, 4500);
  });
}

/* ── Formato de fecha corta (para reportes Word/PDF) ────────────
   Recibe: ISO string   Devuelve: "21 abr, 14:30"
   ──────────────────────────────────────────────────────────────── */
function fmtShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

/* ── Semana → Mes (para gráficos de tendencia) ──────────────────
   Ejemplo: "S14" → "Abr"
   Tabla estática basada en el año operativo 2026.
   ──────────────────────────────────────────────────────────────── */
function semToMes(sem) {
  const MAP = {
    S1:'Ene', S2:'Ene', S3:'Ene', S4:'Ene',
    S5:'Ene', S6:'Feb', S7:'Feb', S8:'Feb',
    S9:'Feb', S10:'Mar', S11:'Mar', S12:'Mar',
    S13:'Mar', S14:'Abr', S15:'Abr', S16:'Abr',
    S17:'Abr', S18:'May', S19:'May', S20:'May'
  };
  return MAP[sem] || sem;
}

/* ── Destrucción segura de instancia Chart.js ───────────────────
   Evita el error "Canvas is already in use" al recargar datos.
   ──────────────────────────────────────────────────────────────── */
function destroyChart(instance) {
  if (instance && typeof instance.destroy === 'function') {
    try { instance.destroy(); } catch(e) { /* ignorar */ }
  }
  return null;
}
