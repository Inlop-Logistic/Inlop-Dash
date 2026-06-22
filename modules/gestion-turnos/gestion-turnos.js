'use strict';
/**
 * gestion-turnos.js — Controlador del módulo Gestión de Turnos.
 * Depende de: TurnosService (services/turnos.service.js)
 * Se expone como window.GestionTurnos para bindings desde el HTML.
 */

(function () {

// ─── FESTIVOS COLOMBIA 2026 ────────────────────────────────────────────────
const FESTIVOS = new Map([
  ['2026-01-01', 'Año Nuevo'],
  ['2026-01-12', 'Reyes Magos'],
  ['2026-03-23', 'San José'],
  ['2026-04-02', 'Jueves Santo'],
  ['2026-04-03', 'Viernes Santo'],
  ['2026-05-01', 'Día del Trabajo'],
  ['2026-05-18', 'Ascensión del Señor'],
  ['2026-06-08', 'Corpus Christi'],
  ['2026-06-15', 'Sagrado Corazón'],
  ['2026-06-29', 'San Pedro y San Pablo'],
  ['2026-07-20', 'Independencia de Colombia'],
  ['2026-08-07', 'Batalla de Boyacá'],
  ['2026-08-17', 'Asunción de la Virgen'],
  ['2026-10-12', 'Día de la Raza'],
  ['2026-11-02', 'Todos los Santos'],
  ['2026-11-16', 'Independencia de Cartagena'],
  ['2026-12-08', 'Inmaculada Concepción'],
  ['2026-12-25', 'Navidad'],
]);

// ─── ESTADO ───────────────────────────────────────────────────────────────
const state = {
  weekOffset:     0,
  turnos:         [],
  profiles:       [],
  selectedId:     null,
  filterArea:     '',
  filterSearch:   '',
};

// ─── FECHA HELPERS ────────────────────────────────────────────────────────
function toISO(d) { return d.toISOString().slice(0, 10); }

function getWeekRange(offset) {
  const now = new Date();
  const dow = now.getDay(); // 0=Dom
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { from: mon, to: sun };
}

function getDatesInRange(from, to) {
  const dates = [];
  const cur = new Date(from);
  while (cur <= to) {
    const d = cur.getDay();
    const iso = toISO(cur);
    if (d === 0 || d === 6 || FESTIVOS.has(iso)) {
      dates.push({
        fecha: iso,
        tipo: d === 6 ? 'sabado' : d === 0 ? 'domingo' : 'festivo',
        nombre: FESTIVOS.get(iso) || null,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function fmtShort(iso) {
  const [, m, d] = iso.split('-');
  return d + '/' + m;
}

function fmtLong(iso) {
  const dt = new Date(iso + 'T12:00:00');
  const DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return DAYS[dt.getDay()] + ', ' + dt.getDate() + ' de ' + MONTHS[dt.getMonth()] + ' de ' + dt.getFullYear();
}

function fmtCell(iso) {
  const dt = new Date(iso + 'T12:00:00');
  const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const [, m, d] = iso.split('-');
  return DAYS[dt.getDay()] + ' ' + d + '/' + m;
}

function getWeekLabel(offset) {
  const { from, to } = getWeekRange(offset);
  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return from.getDate() + ' ' + MONTHS[from.getMonth()] + ' – ' + to.getDate() + ' ' + MONTHS[to.getMonth()] + ', ' + to.getFullYear();
}

// ─── ÁREA HELPERS ─────────────────────────────────────────────────────────
const AREA_COLORS = {
  gerencia:      { text: '#7ab4f0', bg: 'rgba(1,42,107,.25)',    dot: '#3b82f6' },
  aprobaciones:  { text: '#fbbf24', bg: 'rgba(217,119,6,.2)',    dot: '#d97706' },
  'tráfico':     { text: '#00d97e', bg: 'rgba(0,217,126,.15)',   dot: '#00a860' },
  trafico:       { text: '#00d97e', bg: 'rgba(0,217,126,.15)',   dot: '#00a860' },
  operaciones:   { text: '#c084fc', bg: 'rgba(124,58,237,.18)',  dot: '#7c3aed' },
};

function areaStyle(area) {
  return AREA_COLORS[(area || '').toLowerCase()] || { text: '#e8eef8', bg: 'rgba(255,255,255,.08)', dot: '#8099b8' };
}

function initials(nombre) {
  if (!nombre) return '?';
  const parts = nombre.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase();
}

// ─── TOAST ────────────────────────────────────────────────────────────────
function toast(msg, type) {
  const el = document.getElementById('gt-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + (type || 'info') + ' show';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3800);
}

// ─── DOM HELPER ───────────────────────────────────────────────────────────
function $id(id) { return document.getElementById(id); }

function setLoading(on) {
  const el = $id('gt-loading');
  if (el) el.style.display = on ? 'flex' : 'none';
}

// ─── CARGA DE DATOS ───────────────────────────────────────────────────────
async function loadData() {
  setLoading(true);
  try {
    const { from, to } = getWeekRange(state.weekOffset);
    const [profiles, turnos] = await Promise.all([
      TurnosService.getProfiles(),
      TurnosService.getTurnos(toISO(from), toISO(to)),
    ]);
    state.profiles = profiles || [];
    state.turnos   = turnos   || [];
    render();
  } catch (err) {
    console.error('[GestionTurnos] loadData:', err);
    toast('Error cargando datos. Verifica tu sesión.', 'err');
  } finally {
    setLoading(false);
  }
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────
function render() {
  renderWeekLabel();
  renderKPIs();
  renderTable();
  const sel = state.selectedId && state.turnos.find(t => t.id === state.selectedId);
  if (sel) renderDetail(sel); else clearDetail();
}

function renderWeekLabel() {
  const el = $id('gt-week-label');
  if (el) el.textContent = getWeekLabel(state.weekOffset);
}

// ─── KPIs ─────────────────────────────────────────────────────────────────
function renderKPIs() {
  const { from, to } = getWeekRange(state.weekOffset);
  const dates    = getDatesInRange(from, to);
  const festivos = dates.filter(d => d.tipo === 'festivo');
  const filtered = filteredTurnos();

  const pairs    = new Set(state.turnos.map(t => t.area + '|' + t.subarea));
  const assigned = filtered.filter(t => t.profile_id).length;
  const pending  = Math.max(0, pairs.size * dates.length - state.turnos.filter(t => t.profile_id).length);
  const nextFest = festivos[0];

  _setKpi('gt-kpi-activos',    filtered.length,  'Esta semana');
  _setKpi('gt-kpi-asignados',  assigned,          assigned === filtered.length ? 'Cobertura completa' : 'Con responsable');
  _setKpi('gt-kpi-pendientes', pending,            pending > 0 ? 'Sin asignación' : 'Todo cubierto');
  _setKpi('gt-kpi-festivos',   festivos.length,   nextFest ? nextFest.nombre : 'Ninguno esta semana');
}

function _setKpi(id, val, sub) {
  const el = $id(id);
  if (!el) return;
  const v = el.querySelector('.kpi-val');
  const s = el.querySelector('.kpi-sub');
  if (v) v.textContent = val !== undefined ? val : '—';
  if (s && sub) s.textContent = sub;
}

// ─── FILTRO ───────────────────────────────────────────────────────────────
function filteredTurnos() {
  return state.turnos.filter(t => {
    if (state.filterArea) {
      if (t.area.toLowerCase() !== state.filterArea.toLowerCase()) return false;
    }
    if (state.filterSearch) {
      const q = state.filterSearch.toLowerCase();
      const nombre  = (t.profile?.nombre  || '').toLowerCase();
      const subarea = (t.subarea || '').toLowerCase();
      if (!nombre.includes(q) && !subarea.includes(q)) return false;
    }
    return true;
  });
}

// ─── TABLA DINÁMICA ───────────────────────────────────────────────────────
function renderTable() {
  const { from, to } = getWeekRange(state.weekOffset);
  const dates    = getDatesInRange(from, to);
  const filtered = filteredTurnos();

  const thead = $id('gt-thead');
  const tbody = $id('gt-tbody');
  if (!thead || !tbody) return;

  // Grupos área → Set(subarea)
  const groups = {};
  state.turnos.forEach(t => {
    if (!groups[t.area]) groups[t.area] = new Set();
    groups[t.area].add(t.subarea);
  });

  // Lookup por área|subarea|fecha → turno (solo filtrados)
  const lkp = {};
  filtered.forEach(t => { lkp[t.area + '|' + t.subarea + '|' + t.fecha] = t; });

  // Festivo chip
  const fest = dates.filter(d => d.tipo === 'festivo');
  const chipWrap = $id('gt-festivo-chip-wrap');
  if (chipWrap) {
    chipWrap.innerHTML = fest.length
      ? `<span class="badge-festivo-chip"><i class="ti ti-flag"></i>${fest.length} festivo${fest.length > 1 ? 's' : ''}</span>`
      : '';
  }

  // — THEAD —
  let th = '<tr>';
  th += '<th rowspan="2" class="th-sticky" style="min-width:110px;background:var(--navy)">Área</th>';
  th += '<th rowspan="2" class="th-sticky2" style="min-width:140px;background:var(--navy)">Subárea</th>';
  dates.forEach(d => {
    const isFest = d.tipo === 'festivo';
    const label  = d.tipo === 'sabado' ? 'Sábado' : d.tipo === 'domingo' ? 'Domingo' : (d.nombre || 'Festivo');
    th += `<th class="th-date${isFest ? ' th-festivo' : ''}">
      ${label}${isFest ? '<span class="badge-festivo">Festivo</span>' : ''}
      <br><small>${fmtShort(d.fecha)}/${d.fecha.slice(0, 4)}</small>
    </th>`;
  });
  th += '<th>Responsable General</th>';
  th += '<th style="width:90px;text-align:center">Contacto</th>';
  th += '</tr>';
  thead.innerHTML = th;

  // — TBODY vacío —
  if (!Object.keys(groups).length) {
    tbody.innerHTML = `<tr><td colspan="${4 + dates.length}" class="tbl-empty">
      <i class="ti ti-calendar-off"></i>
      <span>No hay turnos para esta semana.</span>
      <a href="#" class="link-crear" onclick="GestionTurnos.openModalNuevo();return false;">+ Crear primer turno</a>
    </td></tr>`;
    _updateFooter(0, 0, dates.length);
    return;
  }

  // — TBODY filas —
  let rows = '';
  const areas = Object.keys(groups).sort();
  let totalAssigned = 0;
  let totalPairs    = 0;

  areas.forEach(area => {
    const subareas = [...groups[area]].sort();
    const ac = areaStyle(area);
    subareas.forEach((sub, idx) => {
      totalPairs++;
      let respGeneral = null;
      dates.forEach(d => {
        const t = lkp[area + '|' + sub + '|' + d.fecha];
        if (t?.profile) respGeneral = t.profile;
        if (t?.profile_id) totalAssigned++;
      });

      rows += '<tr>';

      if (idx === 0) {
        rows += `<td rowspan="${subareas.length}" class="td-area" style="vertical-align:middle">
          <span class="area-pill" style="color:${ac.text};background:${ac.bg}">${area}</span>
        </td>`;
      }

      rows += `<td class="td-sub">${sub}</td>`;

      dates.forEach(d => {
        const t = lkp[area + '|' + sub + '|' + d.fecha];
        if (t?.profile) {
          const ini = initials(t.profile.nombre);
          rows += `<td class="td-date" onclick="GestionTurnos.selectTurno('${t.id}')">
            <div class="cell-assigned">
              <div class="cell-av" style="background:${ac.dot}">${ini}</div>
              <span class="cell-name">${t.profile.nombre.split(' ').slice(0, 2).join(' ')}</span>
            </div>
          </td>`;
        } else {
          rows += `<td class="td-date td-vacant" onclick="GestionTurnos.openModalNuevo('${_esc(area)}','${_esc(sub)}','${d.fecha}')">
            <div class="cell-vacant"><i class="ti ti-user-x"></i>Vacante</div>
          </td>`;
        }
      });

      const tel = respGeneral?.telefono;
      rows += `<td class="td-sub">${respGeneral ? respGeneral.nombre : '<span class="no-data">—</span>'}</td>`;
      rows += `<td style="text-align:center">`;
      rows += tel
        ? `<button class="wa-btn" onclick="GestionTurnos.openWhatsapp('${tel}')" title="${tel}"><i class="ti ti-brand-whatsapp"></i></button>`
        : `<span class="no-data">—</span>`;
      rows += `</td></tr>`;
    });
  });

  tbody.innerHTML = rows;
  _updateFooter(totalPairs, totalAssigned, dates.length);
}

function _esc(s) { return (s || '').replace(/'/g, "\\'"); }

function _updateFooter(pairs, assigned, days) {
  const el = $id('gt-tbl-footer');
  if (!el) return;
  const vac = Math.max(0, pairs * days - assigned);
  el.innerHTML = `${pairs} subáreas · <strong>${assigned}</strong> personas asignadas · <strong>${days}</strong> días · <strong>${vac}</strong> vacantes`;
}

// ─── PANEL DE DETALLE ─────────────────────────────────────────────────────
function selectTurno(id) {
  const t = state.turnos.find(t => t.id === id);
  if (!t) return;
  state.selectedId = id;
  renderDetail(t);
  // highlight row
  document.querySelectorAll('.gt-tbl td.td-date').forEach(td => td.classList.remove('selected'));
}

function renderDetail(t) {
  const panel = $id('gt-detail');
  if (panel) panel.style.display = '';

  const p  = t.profile || {};
  const ac = areaStyle(t.area || '');
  const ini = initials(p.nombre || '?');

  _setText('gt-det-area',  t.area    || '—');
  _setText('gt-det-sub',   t.subarea || '—');
  _setText('gt-det-fecha', fmtLong(t.fecha));
  _setText('gt-det-tipo',
    t.tipo_dia === 'festivo' ? (t.nombre_festivo || 'Festivo')
    : t.tipo_dia === 'sabado'  ? 'Sábado'
    : t.tipo_dia === 'domingo' ? 'Domingo' : '—'
  );
  _setText('gt-det-cargo', p.cargo || '—');
  _setText('gt-det-obs',   t.observaciones || '—');

  const respEl = $id('gt-det-resp');
  if (respEl) {
    respEl.innerHTML = p.nombre
      ? `<div class="det-person">
           <div class="cell-av" style="width:28px;height:28px;font-size:11px;background:${ac.dot}">${ini}</div>
           <span>${p.nombre}</span>
         </div>`
      : '<span class="no-data">Sin asignar</span>';
  }

  const telEl = $id('gt-det-tel');
  if (telEl) {
    telEl.innerHTML = p.telefono
      ? `<span class="mono">${p.telefono}</span>
         <button class="wa-pill" onclick="GestionTurnos.openWhatsapp('${p.telefono}')">
           <i class="ti ti-brand-whatsapp"></i>WhatsApp
         </button>`
      : '<span class="no-data">—</span>';
  }

  const editBtn = $id('gt-det-edit-btn');
  const delBtn  = $id('gt-det-del-btn');
  const dupBtn  = $id('gt-det-dup-btn');
  if (editBtn) editBtn.onclick = () => openModalEditar(t);
  if (delBtn)  delBtn.onclick  = () => confirmDelete(t.id);
  if (dupBtn)  dupBtn.onclick  = () => _duplicateTurno(t);
}

function clearDetail() {
  state.selectedId = null;
  const panel = $id('gt-detail');
  if (panel) panel.style.display = 'none';
}

function _setText(id, txt) {
  const el = $id(id);
  if (el) el.textContent = txt;
}

// ─── MODAL NUEVO TURNO ────────────────────────────────────────────────────
function openModalNuevo(area, subarea, fecha) {
  _fillProfileSelect('gt-modal-profile', null);
  _setVal('gt-modal-area',   area   || '');
  _setVal('gt-modal-subarea',subarea|| '');
  _setVal('gt-modal-fecha',  fecha  || '');
  _setVal('gt-modal-obs',    '');
  $id('gt-modal-nuevo').classList.add('show');
}

function closeModalNuevo() {
  $id('gt-modal-nuevo').classList.remove('show');
}

async function submitNuevo() {
  const area     = ($id('gt-modal-area')?.value     || '').trim();
  const subarea  = ($id('gt-modal-subarea')?.value  || '').trim();
  const fecha    = $id('gt-modal-fecha')?.value     || '';
  const profId   = $id('gt-modal-profile')?.value   || '';
  const obs      = ($id('gt-modal-obs')?.value      || '').trim();

  if (!area || !subarea || !fecha) {
    toast('Área, subárea y fecha son obligatorios.', 'err'); return;
  }
  const dt  = new Date(fecha + 'T12:00:00');
  const dow = dt.getDay();
  const tipo = FESTIVOS.has(fecha) ? 'festivo' : dow === 6 ? 'sabado' : dow === 0 ? 'domingo' : null;
  if (!tipo) { toast('Solo sábados, domingos y festivos.', 'err'); return; }

  const data = {
    area, subarea, fecha,
    tipo_dia:      tipo,
    nombre_festivo: FESTIVOS.get(fecha) || null,
    profile_id:    profId || null,
    observaciones: obs || null,
  };
  const uid = _currentUserId();
  if (uid) data.created_by = uid;

  const btn = $id('gt-modal-nuevo-submit');
  _setBtnLoading(btn, true, 'Guardando...');
  try {
    await TurnosService.createTurno(data);
    closeModalNuevo();
    toast('Turno creado.', 'ok');
    await loadData();
  } catch (err) {
    console.error('[GestionTurnos] createTurno:', err);
    toast('Error al guardar: ' + err.message, 'err');
  } finally {
    _setBtnLoading(btn, false, 'Guardar Turno');
  }
}

// ─── MODAL EDITAR TURNO ───────────────────────────────────────────────────
function openModalEditar(t) {
  _fillProfileSelect('gt-edit-profile', t.profile_id);
  _setVal('gt-edit-id',     t.id);
  _setVal('gt-edit-area',   t.area     || '');
  _setVal('gt-edit-subarea',t.subarea  || '');
  _setVal('gt-edit-fecha',  t.fecha    || '');
  _setVal('gt-edit-obs',    t.observaciones || '');

  const p   = t.profile || {};
  const ac  = areaStyle(t.area || '');
  const ini = initials(p.nombre || '?');
  const chip = $id('gt-edit-chip');
  if (chip) {
    chip.innerHTML = `<div class="edit-chip">
      <div class="cell-av" style="width:30px;height:30px;font-size:11px;background:${ac.dot}">${ini}</div>
      <div>
        <div class="chip-title">${t.area} · ${t.subarea} · ${fmtCell(t.fecha)}</div>
        <div class="chip-sub">Actual: ${p.nombre || 'Sin asignar'}</div>
      </div>
      <span class="chip-status"><i class="ti ti-check"></i> Asignado</span>
    </div>`;
  }
  $id('gt-modal-editar').classList.add('show');
}

function closeModalEditar() {
  $id('gt-modal-editar').classList.remove('show');
}

async function submitEditar() {
  const id      = $id('gt-edit-id')?.value     || '';
  const area    = ($id('gt-edit-area')?.value   || '').trim();
  const subarea = ($id('gt-edit-subarea')?.value|| '').trim();
  const fecha   = $id('gt-edit-fecha')?.value   || '';
  const profId  = $id('gt-edit-profile')?.value || '';
  const obs     = ($id('gt-edit-obs')?.value    || '').trim();

  if (!id || !area || !subarea || !fecha) {
    toast('Campos obligatorios incompletos.', 'err'); return;
  }

  const patch = {
    area, subarea, fecha,
    profile_id:    profId || null,
    observaciones: obs || null,
    updated_at:    new Date().toISOString(),
  };
  const uid = _currentUserId();
  if (uid) patch.updated_by = uid;

  const btn = $id('gt-edit-submit');
  _setBtnLoading(btn, true, 'Guardando...');
  try {
    await TurnosService.updateTurno(id, patch);
    closeModalEditar();
    toast('Turno actualizado.', 'ok');
    await loadData();
  } catch (err) {
    console.error('[GestionTurnos] updateTurno:', err);
    toast('Error al actualizar: ' + err.message, 'err');
  } finally {
    _setBtnLoading(btn, false, 'Actualizar Turno');
  }
}

// ─── ELIMINAR ────────────────────────────────────────────────────────────
async function confirmDelete(id) {
  if (!confirm('¿Eliminar esta asignación? Esta acción no se puede deshacer.')) return;
  try {
    await TurnosService.deleteTurno(id);
    clearDetail();
    toast('Turno eliminado.', 'ok');
    await loadData();
  } catch (err) {
    console.error('[GestionTurnos] deleteTurno:', err);
    toast('Error al eliminar: ' + err.message, 'err');
  }
}

// ─── DUPLICAR ────────────────────────────────────────────────────────────
function _duplicateTurno(t) {
  openModalNuevo(t.area, t.subarea, '');
  setTimeout(() => {
    _setVal('gt-modal-profile', t.profile_id || '');
    _setVal('gt-modal-obs',     t.observaciones || '');
  }, 30);
}

// ─── NAVEGACIÓN SEMANA ────────────────────────────────────────────────────
function prevWeek() { state.weekOffset--; clearDetail(); loadData(); }
function nextWeek() { state.weekOffset++; clearDetail(); loadData(); }
function goToday()  { state.weekOffset = 0; clearDetail(); loadData(); }

// ─── FILTROS ─────────────────────────────────────────────────────────────
function setFilterArea(v) { state.filterArea = v; renderTable(); renderKPIs(); }
function setFilterSearch(v) { state.filterSearch = v; renderTable(); renderKPIs(); }

// ─── WHATSAPP ────────────────────────────────────────────────────────────
function openWhatsapp(tel) {
  const clean = (tel || '').replace(/\D/g, '');
  const num   = clean.startsWith('57') ? clean : '57' + clean;
  window.open('https://wa.me/' + num, '_blank', 'noopener');
}

// ─── UTILIDADES INTERNAS ──────────────────────────────────────────────────
function _fillProfileSelect(selId, selectedId) {
  const sel = $id(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sin asignar —</option>';
  state.profiles.forEach(p => {
    const opt     = document.createElement('option');
    opt.value     = p.id;
    opt.textContent = p.nombre + (p.cargo ? ' · ' + p.cargo : '');
    if (p.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function _setVal(id, val) {
  const el = $id(id);
  if (el) el.value = val;
}

function _setBtnLoading(btn, on, label) {
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = label;
}

function _currentUserId() {
  try {
    const raw = localStorage.getItem('sb-gtyydandwcgoaratmnqh-auth-token');
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p?.user?.id || null;
  } catch (_) { return null; }
}

// ─── INIT ────────────────────────────────────────────────────────────────
function init() {
  // Semana nav
  _on('gt-week-prev',  'click', prevWeek);
  _on('gt-week-next',  'click', nextWeek);
  _on('gt-week-today', 'click', goToday);

  // Filtros
  const areaSel = $id('gt-filter-area');
  if (areaSel) areaSel.addEventListener('change', e => setFilterArea(e.target.value));
  const srchInp = $id('gt-filter-search');
  if (srchInp)  srchInp.addEventListener('input',  e => setFilterSearch(e.target.value));

  // Botones Nuevo Turno (header + sidebar)
  _on('gt-btn-nuevo',  'click', () => openModalNuevo());
  _on('gt-sb-nuevo',   'click', () => openModalNuevo());

  // Modal Nuevo
  _on('gt-modal-nuevo-cancel', 'click', closeModalNuevo);
  _on('gt-modal-nuevo-submit', 'click', submitNuevo);
  _on('gt-modal-nuevo', 'click', e => { if (e.target === e.currentTarget) closeModalNuevo(); });

  // Modal Editar
  _on('gt-edit-cancel', 'click', closeModalEditar);
  _on('gt-edit-submit', 'click', submitEditar);
  _on('gt-modal-editar', 'click', e => { if (e.target === e.currentTarget) closeModalEditar(); });

  // ESC cierra modales
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeModalNuevo();
    closeModalEditar();
  });

  loadData();
}

function _on(id, ev, fn) {
  const el = $id(id);
  if (el) el.addEventListener(ev, fn);
}

// ─── API PÚBLICA ─────────────────────────────────────────────────────────
window.GestionTurnos = { init, loadData, openModalNuevo, openModalEditar, selectTurno, openWhatsapp, prevWeek, nextWeek, goToday };

document.addEventListener('DOMContentLoaded', init);

})();
