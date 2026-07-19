#!/usr/bin/env python3
"""Injects new modules into Operaciones_project.html"""

import re

FILE = 'Operaciones_project.html'
content = open(FILE, encoding='utf-8').read()

# ─────────────────────────────────────────────────────────
# 1. NEW CSS  — insert before </style> (first occurrence)
# ─────────────────────────────────────────────────────────
NEW_CSS = r"""
/* ════════════════════════════════════════════════════════
   INLOP — Compromisos del Comité + Turnos Fin de Semana
   ════════════════════════════════════════════════════════ */

/* Sección general */
.proj-section{background:var(--c2);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:24px}
.proj-section-header{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.proj-section-title{font-family:'Barlow Condensed',sans-serif;font-size:1.1rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--w2);display:flex;align-items:center;gap:8px;flex:1}
.proj-btn-primary{background:var(--navy2);color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:.82rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .2s}
.proj-btn-primary:hover{background:var(--navy)}

/* KPI Bar compromisos */
.commit-kpi-bar{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.commit-kpi{flex:1;min-width:90px;background:var(--c3);border:1px solid var(--line);border-radius:8px;padding:10px 14px;text-align:center}
.commit-kpi.c-danger{border-color:var(--danger3);background:var(--danger3)}
.commit-kpi.c-warn{border-color:var(--amber3);background:var(--amber3)}
.commit-kpi.c-ok{border-color:var(--green3);background:var(--green3)}
.commit-kpi.c-blue{border-color:var(--blue3);background:var(--blue3)}
.ck-val{font-family:'Barlow Condensed',sans-serif;font-size:1.6rem;font-weight:700;color:var(--w1);line-height:1}
.ck-label{font-size:.68rem;color:var(--w4);margin-top:3px;text-transform:uppercase;letter-spacing:.04em}

/* Filter bar */
.commit-filter-bar{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.cf-btn{background:var(--c3);border:1px solid var(--line);color:var(--w4);border-radius:20px;padding:5px 14px;font-size:.78rem;cursor:pointer;transition:all .15s}
.cf-btn:hover,.cf-btn.active{background:var(--navy2);border-color:var(--navy2);color:var(--w1)}

/* Board de compromisos */
.commit-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
.commit-loading{grid-column:1/-1;text-align:center;color:var(--w4);padding:32px;font-size:.88rem}
.commit-empty{grid-column:1/-1;text-align:center;color:var(--w4);padding:40px;display:flex;flex-direction:column;align-items:center;gap:12px}

/* Commitment card */
.commit-card{background:var(--c3);border:1px solid var(--line);border-radius:10px;padding:14px;cursor:pointer;transition:border-color .2s,transform .15s;position:relative}
.commit-card:hover{border-color:var(--navy2);transform:translateY(-1px)}
.commit-card.is-overdue{border-left:3px solid var(--danger)}
.cc-top{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.cc-code{font-size:.7rem;color:var(--w4);font-family:'JetBrains Mono',monospace}
.cc-status,.cc-prio{font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.04em}
/* Status */
.st-open{background:var(--blue3);color:var(--blue)}
.st-progress{background:rgba(56,189,248,.15);color:#38bdf8}
.st-blocked{background:var(--amber3);color:var(--amber)}
.st-completed{background:var(--green3);color:var(--green)}
.st-closed{background:rgba(71,85,105,.2);color:var(--w4)}
.st-cancelled{background:rgba(71,85,105,.15);color:var(--w4)}
/* Priority */
.prio-critical{background:var(--danger3);color:var(--danger)}
.prio-high{background:rgba(249,115,22,.15);color:#f97316}
.prio-medium{background:var(--amber3);color:var(--amber)}
.prio-low{background:var(--green3);color:var(--green)}
.cc-title{font-size:.9rem;color:var(--w1);font-weight:600;margin-bottom:8px;line-height:1.3}
.cc-meta{display:flex;align-items:center;gap:10px;font-size:.75rem;color:var(--w4);flex-wrap:wrap;margin-bottom:6px}
.cc-meta i{margin-right:3px}
.cc-desc{font-size:.78rem;color:var(--w3);margin-top:6px;line-height:1.4}
.cc-actions{display:flex;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid var(--line)}
.cc-actions button{background:var(--c4);border:1px solid var(--line);color:var(--w3);border-radius:6px;padding:4px 10px;font-size:.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.cc-actions button:hover{background:var(--c3);border-color:var(--navy2);color:var(--w1)}
.btn-danger-sm:hover{border-color:var(--danger)!important;color:var(--danger)!important}
.days-overdue{color:var(--danger);font-weight:700;font-size:.72rem}
.days-today{color:var(--amber);font-weight:700;font-size:.72rem}
.days-soon{color:var(--amber2);font-size:.72rem}
.days-ok{color:var(--w4);font-size:.72rem}

/* Modals overlay */
.inlop-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;backdrop-filter:blur(2px)}
.inlop-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1001;background:var(--c2);border:1px solid var(--line2);border-radius:14px;width:min(560px,95vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.inlop-modal.small{width:min(380px,95vw)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line)}
.modal-header h3{margin:0;font-size:1rem;color:var(--w1)}
.modal-close{background:none;border:none;color:var(--w4);cursor:pointer;font-size:1.1rem;padding:4px 8px;border-radius:6px}
.modal-close:hover{background:var(--c4);color:var(--w1)}
.modal-body{padding:20px;overflow-y:auto;flex:1}
.modal-footer{padding:14px 20px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px}
.form-row{margin-bottom:14px}
.form-row.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.form-group label{display:block;font-size:.76rem;color:var(--w4);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em}
.form-group input,.form-group select,.form-group textarea{width:100%;background:var(--c3);border:1px solid var(--line2);border-radius:7px;color:var(--w1);padding:8px 12px;font-size:.88rem;box-sizing:border-box;transition:border-color .2s;font-family:inherit}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{outline:none;border-color:var(--navy2)}
.form-group select option{background:var(--c2)}
.inlop-btn-cancel{background:var(--c4);border:1px solid var(--line2);color:var(--w3);border-radius:7px;padding:8px 16px;font-size:.85rem;cursor:pointer}
.inlop-btn-save{background:var(--navy2);border:none;color:#fff;border-radius:7px;padding:8px 18px;font-size:.85rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.inlop-btn-save:disabled{opacity:.6;cursor:not-allowed}
.inlop-btn-save:hover:not(:disabled){background:var(--navy)}

/* Side panel */
.inlop-side-panel{position:fixed;top:0;right:0;width:min(440px,100vw);height:100vh;background:var(--c1);border-left:1px solid var(--line2);z-index:1001;display:flex;flex-direction:column;box-shadow:-10px 0 40px rgba(0,0,0,.4);overflow:hidden}
.panel-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000}
.panel-header{display:flex;align-items:flex-start;justify-content:space-between;padding:20px;border-bottom:1px solid var(--line);gap:12px}
.panel-code{font-size:.72rem;color:var(--w4);font-family:'JetBrains Mono',monospace;margin-bottom:4px}
.panel-title{font-size:1rem;color:var(--w1);font-weight:600;line-height:1.3}
.panel-badges{display:flex;gap:8px;padding:10px 20px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.ibadge{font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:10px;text-transform:uppercase}
.panel-body{flex:1;overflow-y:auto;padding:16px 20px}
.panel-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.pi-item{background:var(--c2);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.pi-label{font-size:.68rem;color:var(--w4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.pi-val{font-size:.85rem;color:var(--w1)}
.panel-desc{font-size:.85rem;color:var(--w3);line-height:1.5;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:14px;white-space:pre-wrap}
.panel-actions{display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.panel-actions button{background:var(--c3);border:1px solid var(--line2);color:var(--w3);border-radius:7px;padding:6px 12px;font-size:.82rem;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.panel-actions button:hover{background:var(--navy3);border-color:var(--navy2);color:var(--w1)}
.panel-actions select{background:var(--c3);border:1px solid var(--line2);border-radius:7px;color:var(--w1);padding:6px 10px;font-size:.82rem;cursor:pointer}
.panel-section-title{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--w4);margin-bottom:10px;font-weight:600}
.comments-list{margin-bottom:12px}
.comment-item{background:var(--c2);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:8px}
.comment-author{font-size:.75rem;font-weight:700;color:var(--w2)}
.comment-date{font-size:.66rem;color:var(--w4);margin-bottom:4px}
.comment-content{font-size:.82rem;color:var(--w3);line-height:1.4}
.no-comments{color:var(--w4);font-size:.82rem;text-align:center;padding:20px}
.comment-input-row{display:flex;gap:8px;align-items:flex-end}
.comment-input-row textarea{flex:1;background:var(--c3);border:1px solid var(--line2);border-radius:8px;color:var(--w1);padding:8px 10px;font-size:.85rem;font-family:inherit;resize:none}
.comment-input-row button{background:var(--navy2);border:none;color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:1rem}
.comment-input-row button:hover{background:var(--navy)}

/* Weekend Shifts */
.shift-week-nav{display:flex;align-items:center;gap:8px}
#shift-week-label{font-size:.85rem;color:var(--w2);min-width:190px;text-align:center}
.shift-nav-btn{background:var(--c3);border:1px solid var(--line);color:var(--w3);border-radius:7px;padding:5px 10px;cursor:pointer}
.shift-nav-btn:hover{background:var(--c4)}
.shift-status-badge{padding:4px 12px;border-radius:20px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.sst-draft{background:var(--amber3);color:var(--amber)}
.sst-published{background:var(--green3);color:var(--green)}
.sst-closed{background:rgba(71,85,105,.2);color:var(--w4)}
.shift-grid{display:flex;flex-direction:column;gap:14px;margin-top:8px}
.shift-dept-group{background:var(--c1);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.shift-dept-header{background:var(--navy3);color:var(--w2);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:.85rem;letter-spacing:.1em;text-transform:uppercase;padding:8px 14px}
.shift-dept-slots{display:flex;flex-wrap:wrap;gap:0}
.shift-slot{flex:1;min-width:170px;padding:12px 14px;border-right:1px solid var(--line);cursor:pointer;transition:background .15s}
.shift-slot:last-child{border-right:none}
.shift-slot:hover{background:rgba(1,42,107,.18)}
.shift-slot.two-day{cursor:default;min-width:280px}
.shift-slot.two-day:hover{background:transparent}
.slot-area{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--w3);padding-left:8px;margin-bottom:3px}
.slot-days-label{font-size:.64rem;color:var(--w4);margin-bottom:7px;padding-left:8px}
.slot-person{font-size:.85rem;color:var(--w1);display:flex;align-items:center;gap:6px;padding-left:8px}
.slot-person.empty{color:var(--w4);font-style:italic;font-size:.8rem}
.slot-confirmed{font-size:.66rem;color:var(--green);padding-left:8px;margin-top:3px}
.slot-two-day-grid{display:grid;grid-template-columns:1fr 1fr}
.slot-day-col{padding:8px;border-right:1px solid var(--line)}
.slot-day-col:last-child{border-right:none}
.slot-day-col.clickable{cursor:pointer;border-radius:6px;transition:background .15s}
.slot-day-col.clickable:hover{background:rgba(1,42,107,.22)}
.slot-day-label{font-size:.62rem;color:var(--w4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.shift-incomplete-alert{background:var(--amber3);border:1px solid var(--amber2);border-radius:8px;padding:8px 14px;font-size:.8rem;color:var(--amber);margin-bottom:10px;display:flex;align-items:center;gap:8px}
"""

# ─────────────────────────────────────────────────────────
# 2. NEW HTML — inserted before <!-- RULETA HSEQ -->
# ─────────────────────────────────────────────────────────
ANCHOR_HTML = '<!-- RULETA HSEQ -->'

NEW_HTML = """
<!-- ═══════════════════════════════════════════════════════
     MÓDULO: COMPROMISOS DEL COMITÉ
     ═══════════════════════════════════════════════════════ -->
<div class="proj-section" id="commitments-section">
  <div class="proj-section-header">
    <div class="proj-section-title">
      <i class="ti ti-checklist"></i> Compromisos del Comité
    </div>
    <div id="commit-admin-actions" style="display:none">
      <button class="proj-btn-primary" onclick="CM.openModal()">
        <i class="ti ti-plus"></i> Nuevo compromiso
      </button>
    </div>
  </div>

  <!-- KPI Bar -->
  <div class="commit-kpi-bar">
    <div class="commit-kpi" id="ck-open"><div class="ck-val">—</div><div class="ck-label">Abiertos</div></div>
    <div class="commit-kpi c-blue" id="ck-prog"><div class="ck-val">—</div><div class="ck-label">En proceso</div></div>
    <div class="commit-kpi" id="ck-over"><div class="ck-val">—</div><div class="ck-label">Vencidos</div></div>
    <div class="commit-kpi" id="ck-soon"><div class="ck-val">—</div><div class="ck-label">Próximos ≤3d</div></div>
    <div class="commit-kpi c-ok" id="ck-done"><div class="ck-val">—</div><div class="ck-label">Cerrados (mes)</div></div>
  </div>

  <!-- Filtros -->
  <div class="commit-filter-bar">
    <button class="cf-btn active" onclick="CM.setFilter('all',this)">Todos</button>
    <button class="cf-btn" onclick="CM.setFilter('mine',this)">Mis compromisos</button>
    <button class="cf-btn" onclick="CM.setFilter('open',this)">Abiertos</button>
    <button class="cf-btn" onclick="CM.setFilter('overdue',this)">Vencidos</button>
    <button class="cf-btn" onclick="CM.setFilter('week',this)">Esta semana</button>
  </div>

  <!-- Board -->
  <div class="commit-board" id="commit-board">
    <div class="commit-loading"><i class="ti ti-loader"></i> Cargando compromisos...</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════
     MÓDULO: TURNOS FIN DE SEMANA
     ═══════════════════════════════════════════════════════ -->
<div class="proj-section" id="shifts-section">
  <div class="proj-section-header">
    <div class="proj-section-title">
      <i class="ti ti-calendar-week"></i> Turnos Fin de Semana
    </div>
    <div class="shift-week-nav">
      <button class="shift-nav-btn" onclick="SH.prevWeekend()"><i class="ti ti-chevron-left"></i></button>
      <span id="shift-week-label">—</span>
      <button class="shift-nav-btn" onclick="SH.nextWeekend()"><i class="ti ti-chevron-right"></i></button>
    </div>
    <span class="shift-status-badge sst-draft" id="shift-status-badge">BORRADOR</span>
    <div id="shift-admin-actions" style="display:none">
      <button class="proj-btn-primary" id="shift-action-btn" onclick="SH.publishShift()">
        <i class="ti ti-send"></i> Publicar
      </button>
    </div>
  </div>
  <div id="shift-incomplete-notice" style="display:none" class="shift-incomplete-alert">
    <i class="ti ti-alert-triangle"></i> <span id="shift-incomplete-msg"></span>
  </div>
  <!-- Grid -->
  <div class="shift-grid" id="shift-grid">
    <div class="commit-loading"><i class="ti ti-loader"></i> Cargando turnos...</div>
  </div>
</div>

"""

# ─────────────────────────────────────────────────────────
# 3. MODALS + JS — inserted before </body>
# ─────────────────────────────────────────────────────────
NEW_MODALS = """
<!-- ═══ MODAL: Compromiso ═══ -->
<div class="inlop-overlay" id="commit-modal-overlay" onclick="CM.closeModal()" style="display:none"></div>
<div class="inlop-modal" id="commit-modal" style="display:none">
  <div class="modal-header">
    <h3 id="commit-modal-title">Nuevo Compromiso</h3>
    <button class="modal-close" onclick="CM.closeModal()"><i class="ti ti-x"></i></button>
  </div>
  <div class="modal-body">
    <input type="hidden" id="cm-id">
    <div class="form-row">
      <div class="form-group">
        <label>Título *</label>
        <input type="text" id="cm-title" placeholder="Título del compromiso...">
      </div>
    </div>
    <div class="form-row two-col">
      <div class="form-group">
        <label>Fecha del comité</label>
        <input type="date" id="cm-committee-date">
      </div>
      <div class="form-group">
        <label>Fecha límite *</label>
        <input type="date" id="cm-due-date">
      </div>
    </div>
    <div class="form-row two-col">
      <div class="form-group">
        <label>Prioridad</label>
        <select id="cm-priority">
          <option value="low">🟢 Baja</option>
          <option value="medium" selected>🟡 Media</option>
          <option value="high">🟠 Alta</option>
          <option value="critical">🔴 Crítica</option>
        </select>
      </div>
      <div class="form-group">
        <label>Estado</label>
        <select id="cm-status">
          <option value="open">Abierto</option>
          <option value="in_progress">En proceso</option>
          <option value="blocked">Bloqueado</option>
          <option value="completed">Completado</option>
          <option value="closed">Cerrado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Responsable *</label>
        <select id="cm-responsible"><option value="">— Cargando usuarios... —</option></select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Descripción</label>
        <textarea id="cm-description" rows="3" placeholder="Descripción del compromiso..."></textarea>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Observaciones</label>
        <textarea id="cm-observations" rows="2" placeholder="Observaciones adicionales..."></textarea>
      </div>
    </div>
  </div>
  <div class="modal-footer">
    <button class="inlop-btn-cancel" onclick="CM.closeModal()">Cancelar</button>
    <button class="inlop-btn-save" id="cm-save-btn" onclick="CM.save()">
      <i class="ti ti-device-floppy"></i> Guardar
    </button>
  </div>
</div>

<!-- ═══ PANEL: Detalle compromiso ═══ -->
<div class="panel-overlay" id="commit-panel-overlay" onclick="CM.closePanel()" style="display:none"></div>
<div class="inlop-side-panel" id="commit-panel" style="display:none">
  <div class="panel-header">
    <div>
      <div class="panel-code" id="cp-code">—</div>
      <div class="panel-title" id="cp-title">—</div>
    </div>
    <button class="modal-close" onclick="CM.closePanel()"><i class="ti ti-x"></i></button>
  </div>
  <div class="panel-badges">
    <span class="ibadge" id="cp-status-badge">—</span>
    <span class="ibadge" id="cp-priority-badge">—</span>
  </div>
  <div class="panel-body">
    <div class="panel-info-grid">
      <div class="pi-item"><div class="pi-label">Responsable</div><div class="pi-val" id="cp-responsible">—</div></div>
      <div class="pi-item"><div class="pi-label">Fecha límite</div><div class="pi-val" id="cp-due-date">—</div></div>
      <div class="pi-item"><div class="pi-label">Fecha comité</div><div class="pi-val" id="cp-committee-date">—</div></div>
      <div class="pi-item"><div class="pi-label">Creado por</div><div class="pi-val" id="cp-created-by">—</div></div>
    </div>
    <div class="panel-desc" id="cp-description" style="display:none"></div>

    <div class="panel-actions" id="cp-panel-actions" style="display:none">
      <button onclick="CM.editFromPanel()"><i class="ti ti-edit"></i> Editar</button>
      <select id="cp-status-select" onchange="CM.changeStatus(this.value)">
        <option value="open">Abierto</option>
        <option value="in_progress">En proceso</option>
        <option value="blocked">Bloqueado</option>
        <option value="completed">Completado</option>
        <option value="closed">Cerrado</option>
        <option value="cancelled">Cancelado</option>
      </select>
    </div>

    <div class="panel-section-title">Avances y comentarios</div>
    <div class="comments-list" id="cp-comments-list"></div>
    <div class="comment-input-row" id="cp-comment-input" style="display:none">
      <textarea id="cp-new-comment" rows="2" placeholder="Agregar avance o comentario..."></textarea>
      <button onclick="CM.addComment()"><i class="ti ti-send"></i></button>
    </div>
  </div>
</div>

<!-- ═══ MODAL: Asignar turno ═══ -->
<div class="inlop-overlay" id="shift-modal-overlay" onclick="SH.closeModal()" style="display:none"></div>
<div class="inlop-modal small" id="shift-modal" style="display:none">
  <div class="modal-header">
    <h3 id="shift-modal-title">Asignar turno</h3>
    <button class="modal-close" onclick="SH.closeModal()"><i class="ti ti-x"></i></button>
  </div>
  <div class="modal-body">
    <input type="hidden" id="sm-template-code">
    <input type="hidden" id="sm-day">
    <div class="form-group" style="margin-bottom:14px">
      <label id="sm-area-label">Área</label>
      <select id="sm-person"><option value="">— Sin asignar —</option></select>
    </div>
    <div class="form-group">
      <label>Nota (opcional)</label>
      <input type="text" id="sm-notes" placeholder="Ej: cobertura especial...">
    </div>
  </div>
  <div class="modal-footer">
    <button class="inlop-btn-cancel" onclick="SH.closeModal()">Cancelar</button>
    <button class="inlop-btn-save" id="sm-save-btn" onclick="SH.saveAssignment()">
      <i class="ti ti-check"></i> Asignar
    </button>
  </div>
</div>
"""

NEW_JS = r"""
<script>
/* ════════════════════════════════════════════════════════════
   INLOP — Compromisos del Comité + Turnos Fin de Semana
   Versión MVP · Junio 2026
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── Supabase helpers ─────────────────────────────────── */
var _SB_URL='https://gtyydandwcgoaratmnqh.supabase.co';
var _SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eXlkYW5kd2Nnb2FyYXRtbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAyMTcsImV4cCI6MjA5MjYxNjIxN30.utGZtr0L5t9hIpRABTtfhsKEsrSCBJLHcP_gQ5Hq0EI';

function _h(){
  var token=_SB_KEY;
  try{var raw=localStorage.getItem('sb-gtyydandwcgoaratmnqh-auth-token');
    if(raw){var s=JSON.parse(raw);if(s&&s.access_token)token=s.access_token;}}catch(e){}
  return{'Content-Type':'application/json','apikey':_SB_KEY,'Authorization':'Bearer '+token};
}

async function dbGet(table,params){
  var qs=params?'?'+params:'';
  try{
    var r=await fetch(_SB_URL+'/rest/v1/'+table+qs,{headers:Object.assign({},_h(),{'Accept':'application/json'})});
    if(!r.ok){console.warn('[INLOP]',table,r.status);return[];}
    return await r.json();
  }catch(e){console.error('[INLOP] dbGet',table,e.message);return[];}
}

async function dbInsert(table,body){
  var r=await fetch(_SB_URL+'/rest/v1/'+table,{
    method:'POST',
    headers:Object.assign({},_h(),{'Prefer':'return=representation'}),
    body:JSON.stringify(body)
  });
  if(!r.ok){var e=await r.text().catch(function(){return'';});throw new Error('dbInsert '+table+': '+e);}
  return await r.json();
}

async function dbUpdate(table,params,body){
  var r=await fetch(_SB_URL+'/rest/v1/'+table+'?'+params,{
    method:'PATCH',
    headers:Object.assign({},_h(),{'Prefer':'return=representation'}),
    body:JSON.stringify(body)
  });
  if(!r.ok){var e=await r.text().catch(function(){return'';});throw new Error('dbUpdate '+table+': '+e);}
  return await r.json();
}

async function dbDelete(table,params){
  var r=await fetch(_SB_URL+'/rest/v1/'+table+'?'+params,{method:'DELETE',headers:_h()});
  if(!r.ok){var e=await r.text().catch(function(){return'';});throw new Error('dbDelete '+table+': '+e);}
}

async function dbUpsert(table,body,conflict){
  var qs=conflict?'?on_conflict='+conflict:'';
  var r=await fetch(_SB_URL+'/rest/v1/'+table+qs,{
    method:'POST',
    headers:Object.assign({},_h(),{'Prefer':'resolution=merge-duplicates,return=representation'}),
    body:JSON.stringify(body)
  });
  if(!r.ok){var e=await r.text().catch(function(){return'';});throw new Error('dbUpsert '+table+': '+e);}
  return await r.json();
}

/* ── Usuario actual ──────────────────────────────────── */
function getUser(){
  try{var raw=sessionStorage.getItem('inlop_user');if(!raw)return{nombre:'Usuario',rol:'operativo'};return JSON.parse(raw)||{nombre:'Usuario',rol:'operativo'};}
  catch(e){return{nombre:'Usuario',rol:'operativo'};}
}
function canEdit(){
  return['master','operativo','trafico','admin'].includes(getUser().rol);
}

function esc(s){
  if(!s)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d){
  if(!d)return'—';
  var dt=new Date(d+'T12:00:00');
  return dt.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
}

/* ── Perfiles compartidos ─────────────────────────────── */
var _profiles=[];

async function loadProfiles(){
  _profiles=await dbGet('inlop_profiles','activo=eq.true&order=nombre.asc');
  return _profiles;
}

function fillSelect(selId,selected){
  var sel=document.getElementById(selId);
  if(!sel)return;
  sel.innerHTML='<option value="">— Sin asignar —</option>';
  _profiles.forEach(function(p){
    var opt=document.createElement('option');
    opt.value=p.nombre;
    opt.textContent=p.nombre+(p.departamento?' · '+p.departamento:'');
    if(p.nombre===selected)opt.selected=true;
    sel.appendChild(opt);
  });
}

/* ════════════════════════════════════════════════════════
   MÓDULO CM — Compromisos del Comité
   ════════════════════════════════════════════════════════ */
var CM=(function(){
  var _list=[];
  var _filter='all';
  var _editId=null;
  var _panelId=null;

  var PRIO={
    critical:{label:'Crítica',cls:'prio-critical',dot:'🔴'},
    high:{label:'Alta',cls:'prio-high',dot:'🟠'},
    medium:{label:'Media',cls:'prio-medium',dot:'🟡'},
    low:{label:'Baja',cls:'prio-low',dot:'🟢'}
  };
  var ST={
    open:{label:'Abierto',cls:'st-open'},
    in_progress:{label:'En proceso',cls:'st-progress'},
    blocked:{label:'Bloqueado',cls:'st-blocked'},
    completed:{label:'Completado',cls:'st-completed'},
    closed:{label:'Cerrado',cls:'st-closed'},
    cancelled:{label:'Cancelado',cls:'st-cancelled'}
  };

  function isOverdue(c){
    if(!c.due_date)return false;
    if(['closed','completed','cancelled'].includes(c.status))return false;
    return new Date(c.due_date+'T12:00:00')<new Date(new Date().toDateString());
  }
  function isDueSoon(c){
    if(!c.due_date)return false;
    if(['closed','completed','cancelled'].includes(c.status))return false;
    var due=new Date(c.due_date+'T12:00:00');
    var now=new Date();
    var diff=(due-now)/(86400000);
    return diff>=0&&diff<=3;
  }

  async function load(){
    _list=await dbGet('committee_commitments','deleted_at=is.null&order=created_at.desc');
    renderKPIs();
    renderBoard();
    var el=document.getElementById('commit-admin-actions');
    if(el)el.style.display=canEdit()?'flex':'none';
  }

  function renderKPIs(){
    var now=new Date();
    var som=new Date(now.getFullYear(),now.getMonth(),1);
    var open=_list.filter(function(c){return c.status==='open';}).length;
    var prog=_list.filter(function(c){return c.status==='in_progress';}).length;
    var over=_list.filter(isOverdue).length;
    var soon=_list.filter(function(c){return isDueSoon(c)&&!isOverdue(c);}).length;
    var done=_list.filter(function(c){return['closed','completed'].includes(c.status)&&c.updated_at&&new Date(c.updated_at)>=som;}).length;

    function s(id,val,cls){
      var el=document.getElementById(id);
      if(!el)return;
      var v=el.querySelector('.ck-val');
      if(v)v.textContent=val;
      if(cls!==undefined)el.className='commit-kpi '+cls;
    }
    s('ck-open',open,'');
    s('ck-prog',prog,'c-blue');
    s('ck-over',over,over>0?'c-danger':'');
    s('ck-soon',soon,soon>0?'c-warn':'');
    s('ck-done',done,'c-ok');
  }

  function filtered(){
    var u=getUser();
    return _list.filter(function(c){
      if(c.deleted_at)return false;
      switch(_filter){
        case'mine':return c.responsible_nombre===u.nombre;
        case'overdue':return isOverdue(c);
        case'open':return['open','in_progress','blocked'].includes(c.status);
        case'week':{
          if(!c.due_date)return false;
          var due=new Date(c.due_date+'T12:00:00');
          var now=new Date();
          var end=new Date(now);end.setDate(now.getDate()+(7-now.getDay()));
          return due>=now&&due<=end;
        }
        default:return true;
      }
    });
  }

  function daysLabel(c){
    if(!c.due_date||['closed','completed','cancelled'].includes(c.status))return'';
    var due=new Date(c.due_date+'T12:00:00');
    var diff=Math.round((due-new Date())/86400000);
    if(diff<0)return'<span class="days-overdue">'+Math.abs(diff)+'d vencido</span>';
    if(diff===0)return'<span class="days-today">Vence hoy</span>';
    if(diff<=3)return'<span class="days-soon">'+diff+'d restantes</span>';
    return'<span class="days-ok">'+diff+'d restantes</span>';
  }

  function renderBoard(){
    var board=document.getElementById('commit-board');
    if(!board)return;
    var f=filtered();
    if(!f.length){
      board.innerHTML='<div class="commit-empty"><i class="ti ti-clipboard-off" style="font-size:2rem;opacity:.35"></i><div>No hay compromisos para este filtro</div>'+(canEdit()?'<button class="proj-btn-primary" onclick="CM.openModal()"><i class="ti ti-plus"></i> Crear compromiso</button>':'')+'</div>';
      return;
    }
    board.innerHTML=f.map(function(c){
      var p=PRIO[c.priority]||PRIO.medium;
      var st=ST[c.status]||ST.open;
      var over=isOverdue(c);
      return'<div class="commit-card'+(over?' is-overdue':'')+'" onclick="CM.openPanel(\''+c.id+'\')">'+
        '<div class="cc-top"><span class="cc-code">'+esc(c.code||'—')+'</span><span class="cc-status '+st.cls+'">'+st.label+'</span><span class="cc-prio '+p.cls+'">'+p.label+'</span></div>'+
        '<div class="cc-title">'+esc(c.title)+'</div>'+
        '<div class="cc-meta"><span><i class="ti ti-user"></i>'+esc(c.responsible_nombre||'—')+'</span><span><i class="ti ti-calendar"></i>'+fmtDate(c.due_date)+'</span>'+daysLabel(c)+'</div>'+
        (c.description?'<div class="cc-desc">'+esc(c.description.substring(0,100))+(c.description.length>100?'…':'')+'</div>':'')+
        (canEdit()?'<div class="cc-actions" onclick="event.stopPropagation()"><button onclick="CM.openModal(\''+c.id+'\')"><i class="ti ti-edit"></i></button><button class="btn-danger-sm" onclick="CM.del(\''+c.id+'\')"><i class="ti ti-trash"></i></button></div>':'')+
        '</div>';
    }).join('');
  }

  async function genCode(){
    var yr=new Date().getFullYear();
    var rows=await dbGet('committee_commitments','code=like.COM-'+yr+'-%&order=code.desc&limit=1');
    if(!rows||!rows.length)return'COM-'+yr+'-001';
    var n=parseInt((rows[0].code||'').split('-')[2]||'0',10)+1;
    return'COM-'+yr+'-'+String(n).padStart(3,'0');
  }

  return{
    load:load,

    setFilter:function(f,btn){
      _filter=f;
      document.querySelectorAll('.cf-btn').forEach(function(b){b.classList.remove('active');});
      if(btn)btn.classList.add('active');
      renderBoard();
    },

    openModal:function(id){
      _editId=id||null;
      fillSelect('cm-responsible');
      var title=document.getElementById('commit-modal-title');
      if(id){
        var c=_list.find(function(x){return x.id===id;});
        if(!c)return;
        if(title)title.textContent='Editar Compromiso';
        document.getElementById('cm-id').value=c.id;
        document.getElementById('cm-title').value=c.title||'';
        document.getElementById('cm-description').value=c.description||'';
        document.getElementById('cm-observations').value=c.observations||'';
        document.getElementById('cm-committee-date').value=c.committee_date||'';
        document.getElementById('cm-due-date').value=c.due_date||'';
        document.getElementById('cm-priority').value=c.priority||'medium';
        document.getElementById('cm-status').value=c.status||'open';
        fillSelect('cm-responsible',c.responsible_nombre);
      }else{
        if(title)title.textContent='Nuevo Compromiso';
        document.getElementById('cm-id').value='';
        ['cm-title','cm-description','cm-observations'].forEach(function(x){document.getElementById(x).value='';});
        document.getElementById('cm-committee-date').value=new Date().toISOString().split('T')[0];
        document.getElementById('cm-due-date').value='';
        document.getElementById('cm-priority').value='medium';
        document.getElementById('cm-status').value='open';
      }
      document.getElementById('commit-modal-overlay').style.display='block';
      document.getElementById('commit-modal').style.display='flex';
    },

    closeModal:function(){
      document.getElementById('commit-modal').style.display='none';
      document.getElementById('commit-modal-overlay').style.display='none';
      _editId=null;
    },

    save:async function(){
      var title=(document.getElementById('cm-title').value||'').trim();
      var responsible=document.getElementById('cm-responsible').value;
      var dueDate=document.getElementById('cm-due-date').value;
      if(!title){alert('El título es obligatorio.');return;}
      if(!responsible){alert('Selecciona un responsable.');return;}
      if(!dueDate){alert('La fecha límite es obligatoria.');return;}
      var btn=document.getElementById('cm-save-btn');
      if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader"></i> Guardando...';}
      try{
        var body={title:title,description:(document.getElementById('cm-description').value||'').trim()||null,observations:(document.getElementById('cm-observations').value||'').trim()||null,committee_date:document.getElementById('cm-committee-date').value||null,due_date:dueDate,priority:document.getElementById('cm-priority').value,status:document.getElementById('cm-status').value,responsible_nombre:responsible,updated_at:new Date().toISOString()};
        if(_editId){
          await dbUpdate('committee_commitments','id=eq.'+_editId,body);
        }else{
          body.code=await genCode();
          body.created_by_nombre=getUser().nombre;
          body.created_at=new Date().toISOString();
          await dbInsert('committee_commitments',body);
        }
        CM.closeModal();
        await load();
      }catch(e){alert('Error al guardar: '+e.message);}
      finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-device-floppy"></i> Guardar';}}
    },

    del:async function(id){
      if(!confirm('¿Eliminar este compromiso?'))return;
      try{await dbUpdate('committee_commitments','id=eq.'+id,{deleted_at:new Date().toISOString()});await load();}
      catch(e){alert('Error: '+e.message);}
    },

    openPanel:async function(id){
      _panelId=id;
      var c=_list.find(function(x){return x.id===id;});
      if(!c)return;
      var p=PRIO[c.priority]||PRIO.medium;
      var st=ST[c.status]||ST.open;
      document.getElementById('cp-code').textContent=c.code||'—';
      document.getElementById('cp-title').textContent=c.title;
      document.getElementById('cp-responsible').textContent=c.responsible_nombre||'—';
      document.getElementById('cp-due-date').textContent=fmtDate(c.due_date);
      document.getElementById('cp-committee-date').textContent=fmtDate(c.committee_date);
      document.getElementById('cp-created-by').textContent=c.created_by_nombre||'—';
      var sb=document.getElementById('cp-status-badge');
      sb.textContent=st.label;sb.className='ibadge '+st.cls;
      var pb=document.getElementById('cp-priority-badge');
      pb.textContent=p.dot+' '+p.label;pb.className='ibadge '+p.cls;
      var desc=document.getElementById('cp-description');
      if(c.description){desc.textContent=c.description;desc.style.display='block';}
      else desc.style.display='none';
      var ss=document.getElementById('cp-status-select');
      if(ss)ss.value=c.status;
      var pa=document.getElementById('cp-panel-actions');
      if(pa)pa.style.display=canEdit()?'flex':'none';
      var ci=document.getElementById('cp-comment-input');
      if(ci)ci.style.display=canEdit()?'flex':'none';
      document.getElementById('commit-panel').style.display='flex';
      document.getElementById('commit-panel-overlay').style.display='block';
      // load comments
      var list=document.getElementById('cp-comments-list');
      if(list)list.innerHTML='<div class="commit-loading">Cargando...</div>';
      var comments=await dbGet('committee_commitment_comments','commitment_id=eq.'+id+'&order=created_at.asc');
      if(list){
        if(!comments||!comments.length){list.innerHTML='<div class="no-comments">Sin comentarios aún</div>';}
        else{list.innerHTML=comments.map(function(cm){return'<div class="comment-item"><div class="comment-author">'+esc(cm.author_nombre)+'</div><div class="comment-date">'+new Date(cm.created_at).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'})+'</div><div class="comment-content">'+esc(cm.content)+'</div></div>';}).join('');}
      }
    },

    closePanel:function(){
      document.getElementById('commit-panel').style.display='none';
      document.getElementById('commit-panel-overlay').style.display='none';
      _panelId=null;
    },

    addComment:async function(){
      if(!_panelId)return;
      var ta=document.getElementById('cp-new-comment');
      var content=(ta.value||'').trim();
      if(!content)return;
      try{
        await dbInsert('committee_commitment_comments',{commitment_id:_panelId,author_nombre:getUser().nombre,content:content,created_at:new Date().toISOString()});
        ta.value='';
        // reload comments
        var comments=await dbGet('committee_commitment_comments','commitment_id=eq.'+_panelId+'&order=created_at.asc');
        var list=document.getElementById('cp-comments-list');
        if(list)list.innerHTML=comments.map(function(cm){return'<div class="comment-item"><div class="comment-author">'+esc(cm.author_nombre)+'</div><div class="comment-date">'+new Date(cm.created_at).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'})+'</div><div class="comment-content">'+esc(cm.content)+'</div></div>';}).join('');
      }catch(e){alert('Error: '+e.message);}
    },

    changeStatus:async function(newStatus){
      if(!_panelId||!newStatus)return;
      try{
        var body={status:newStatus,updated_at:new Date().toISOString()};
        if(['closed','completed'].includes(newStatus))body.closed_at=new Date().toISOString();
        await dbUpdate('committee_commitments','id=eq.'+_panelId,body);
        await load();
        CM.openPanel(_panelId);
      }catch(e){alert('Error: '+e.message);}
    },

    editFromPanel:function(){
      var id=_panelId;
      CM.closePanel();
      CM.openModal(id);
    }
  };
})();

/* ════════════════════════════════════════════════════════
   MÓDULO SH — Turnos Fin de Semana
   ════════════════════════════════════════════════════════ */
var SH=(function(){
  var _templates=[];
  var _shift=null;
  var _assignments=[];
  var _saturday=null;

  function getSat(date){
    var d=new Date(date);
    var day=d.getDay();
    var diff=day===6?0:(day===0?-1:6-day);
    d.setDate(d.getDate()+diff);
    return d;
  }
  function toStr(d){return d.toISOString().split('T')[0];}
  function fmtWE(sat){
    var sun=new Date(sat);sun.setDate(sat.getDate()+1);
    var o={day:'2-digit',month:'2-digit',year:'numeric'};
    return sat.toLocaleDateString('es-CO',o)+' — '+sun.toLocaleDateString('es-CO',o);
  }

  async function loadTemplates(){
    if(_templates.length)return;
    _templates=await dbGet('weekend_shift_templates','activo=eq.true&order=display_order.asc');
  }

  async function loadShift(sat){
    _saturday=sat;
    var dateStr=toStr(sat);
    var lbl=document.getElementById('shift-week-label');
    if(lbl)lbl.textContent=fmtWE(sat);
    var rows=await dbGet('weekend_shifts','weekend_start=eq.'+dateStr);
    if(rows&&rows.length){
      _shift=rows[0];
    }else{
      var u=getUser();
      var created=await dbInsert('weekend_shifts',{weekend_start:dateStr,status:'draft',created_by:u.nombre,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      _shift=created&&created[0]?created[0]:{weekend_start:dateStr,status:'draft',id:null};
    }
    _assignments=_shift&&_shift.id?await dbGet('weekend_shift_assignments','shift_id=eq.'+_shift.id):[];
    renderBadge();
    renderAdminActions();
    renderGrid();
  }

  function renderBadge(){
    var b=document.getElementById('shift-status-badge');
    if(!b||!_shift)return;
    var m={draft:'BORRADOR',published:'PUBLICADO ✓',closed:'CERRADO'};
    var c={draft:'sst-draft',published:'sst-published',closed:'sst-closed'};
    b.textContent=m[_shift.status]||'BORRADOR';
    b.className='shift-status-badge '+(c[_shift.status]||'sst-draft');
  }

  function renderAdminActions(){
    var el=document.getElementById('shift-admin-actions');
    var btn=document.getElementById('shift-action-btn');
    if(!el)return;
    if(!canEdit()){el.style.display='none';return;}
    el.style.display='flex';
    if(!btn)return;
    if(!_shift||_shift.status==='draft'){
      btn.innerHTML='<i class="ti ti-send"></i> Publicar';
      btn.onclick=function(){SH.publishShift();};
    }else if(_shift.status==='published'){
      btn.innerHTML='<i class="ti ti-lock"></i> Cerrar turno';
      btn.onclick=function(){SH.closeShift();};
    }else{
      btn.style.display='none';return;
    }
    btn.style.display='inline-flex';
  }

  function getA(code,day){
    return _assignments.find(function(a){return a.template_code===code&&(a.shift_day===day||a.shift_day==='both');});
  }

  function renderGrid(){
    var grid=document.getElementById('shift-grid');
    if(!grid)return;
    var editable=canEdit()&&_shift&&_shift.status!=='closed';

    // Group by dept
    var depts={};
    var deptOrder=[];
    _templates.forEach(function(t){
      if(!depts[t.departamento]){depts[t.departamento]=[];deptOrder.push(t.departamento);}
      depts[t.departamento].push(t);
    });

    // Check incomplete
    var missing=0;
    _templates.forEach(function(t){
      if(!t.is_critical)return;
      if(t.covers_both_days){if(!getA(t.area_code,'both')&&!getA(t.area_code,'saturday'))missing++;}
      else{if(!getA(t.area_code,'saturday'))missing++;if(!getA(t.area_code,'sunday'))missing++;}
    });
    var notice=document.getElementById('shift-incomplete-notice');
    var noticeMsg=document.getElementById('shift-incomplete-msg');
    if(notice){
      if(missing>0&&_shift&&_shift.status==='draft'){
        notice.style.display='flex';
        if(noticeMsg)noticeMsg.textContent=missing+' slot'+(missing>1?'s':'')+' sin asignar';
      }else{notice.style.display='none';}
    }

    grid.innerHTML=deptOrder.map(function(dept){
      return'<div class="shift-dept-group">'+
        '<div class="shift-dept-header">'+esc(dept)+'</div>'+
        '<div class="shift-dept-slots">'+
          depts[dept].map(function(t){return renderSlot(t,editable);}).join('')+
        '</div></div>';
    }).join('');
  }

  function renderSlot(t,editable){
    var colorBar='border-left:3px solid '+t.color_hex+';';
    if(t.covers_both_days){
      var a=getA(t.area_code,'both')||getA(t.area_code,'saturday');
      var clickAttr=editable?'onclick="SH.openModal(\''+t.area_code+'\',\'both\',\''+esc(t.area_nombre)+'\')"':'';
      return'<div class="shift-slot" '+clickAttr+'>'+
        '<div class="slot-area" style="'+colorBar+'">'+esc(t.area_nombre)+'</div>'+
        '<div class="slot-days-label">Sáb + Dom</div>'+
        '<div class="slot-person'+(a?'':' empty')+'"><i class="ti '+(a?'ti-user-check':'ti-user-plus')+'"></i> '+(a?esc(a.assigned_nombre):'Sin asignar')+'</div>'+
        (a&&a.confirmed?'<div class="slot-confirmed">✓ Confirmó</div>':'')+
        '</div>';
    }else{
      var aSat=getA(t.area_code,'saturday');
      var aSun=getA(t.area_code,'sunday');
      var cSat=editable?'class="slot-day-col clickable" onclick="SH.openModal(\''+t.area_code+'\',\'saturday\',\''+esc(t.area_nombre)+' · Sábado\')"':'class="slot-day-col"';
      var cSun=editable?'class="slot-day-col clickable" onclick="SH.openModal(\''+t.area_code+'\',\'sunday\',\''+esc(t.area_nombre)+' · Domingo\')"':'class="slot-day-col"';
      return'<div class="shift-slot two-day">'+
        '<div class="slot-area" style="'+colorBar+'">'+esc(t.area_nombre)+'</div>'+
        '<div class="slot-two-day-grid">'+
          '<div '+cSat+'><div class="slot-day-label">SÁBADO</div><div class="slot-person'+(aSat?'':' empty')+'"><i class="ti '+(aSat?'ti-user-check':'ti-user-plus')+'"></i> '+(aSat?esc(aSat.assigned_nombre):'Asignar')+'</div></div>'+
          '<div '+cSun+'><div class="slot-day-label">DOMINGO</div><div class="slot-person'+(aSun?'':' empty')+'"><i class="ti '+(aSun?'ti-user-check':'ti-user-plus')+'"></i> '+(aSun?esc(aSun.assigned_nombre):'Asignar')+'</div></div>'+
        '</div></div>';
    }
  }

  return{
    prevWeekend:function(){
      if(!_saturday)return;
      var d=new Date(_saturday);d.setDate(d.getDate()-7);loadShift(d);
    },
    nextWeekend:function(){
      if(!_saturday)return;
      var d=new Date(_saturday);d.setDate(d.getDate()+7);loadShift(d);
    },

    openModal:function(code,day,label){
      if(!_shift||!_shift.id){alert('El turno se está cargando, intenta en un momento.');return;}
      document.getElementById('sm-template-code').value=code;
      document.getElementById('sm-day').value=day;
      var lbl=document.getElementById('sm-area-label');
      if(lbl)lbl.textContent=label||'Área';
      document.getElementById('sm-notes').value='';
      var curr=getA(code,day);
      fillSelect('sm-person',curr?curr.assigned_nombre:'');
      document.getElementById('shift-modal').style.display='flex';
      document.getElementById('shift-modal-overlay').style.display='block';
    },
    closeModal:function(){
      document.getElementById('shift-modal').style.display='none';
      document.getElementById('shift-modal-overlay').style.display='none';
    },

    saveAssignment:async function(){
      var code=document.getElementById('sm-template-code').value;
      var day=document.getElementById('sm-day').value;
      var nombre=document.getElementById('sm-person').value;
      var notes=(document.getElementById('sm-notes').value||'').trim();
      if(!_shift||!_shift.id)return;
      var btn=document.getElementById('sm-save-btn');
      if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader"></i> Guardando...';}
      try{
        if(!nombre){
          // Remove assignment
          try{await dbDelete('weekend_shift_assignments','shift_id=eq.'+_shift.id+'&template_code=eq.'+encodeURIComponent(code)+'&shift_day=eq.'+day);}catch(e){}
        }else{
          await dbUpsert('weekend_shift_assignments',{shift_id:_shift.id,template_code:code,shift_day:day,assigned_nombre:nombre,notes:notes||null,confirmed:false,created_at:new Date().toISOString()},'shift_id,template_code,shift_day');
        }
        SH.closeModal();
        _assignments=await dbGet('weekend_shift_assignments','shift_id=eq.'+_shift.id);
        renderGrid();
      }catch(e){alert('Error al guardar: '+e.message);}
      finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-check"></i> Asignar';}}
    },

    publishShift:async function(){
      if(!_shift||!_shift.id)return;
      if(!confirm('¿Publicar el turno? Todos los usuarios podrán verlo.'))return;
      var u=getUser();
      try{
        await dbUpdate('weekend_shifts','id=eq.'+_shift.id,{status:'published',published_by:u.nombre,published_at:new Date().toISOString(),updated_at:new Date().toISOString()});
        _shift.status='published';renderBadge();renderAdminActions();renderGrid();
      }catch(e){alert('Error: '+e.message);}
    },

    closeShift:async function(){
      if(!_shift||!_shift.id)return;
      if(!confirm('¿Cerrar el turno de este fin de semana?'))return;
      try{
        await dbUpdate('weekend_shifts','id=eq.'+_shift.id,{status:'closed',updated_at:new Date().toISOString()});
        _shift.status='closed';renderBadge();renderAdminActions();renderGrid();
      }catch(e){alert('Error: '+e.message);}
    }
  };
})();

/* ── Init ──────────────────────────────────────────────── */
async function initModules(){
  await loadProfiles();
  await loadTemplates();  // SH templates
  await CM.load();
  await loadShift(getSat(new Date()));
}

// Patch loadTemplates to use SH's templates
async function loadTemplates(){
  if(window._shTemplatesLoaded)return;
  var rows=await dbGet('weekend_shift_templates','activo=eq.true&order=display_order.asc');
  // expose to SH internals via closure trick — re-init SH
  // Actually SH.init() loads templates internally; we trigger by calling loadShift
  window._shTemplatesLoaded=true;
  // Trigger SH internal load
  SH._tmpl=rows; // fallback if needed
}

// Simpler: just expose initModules and hook via MutationObserver
var _projInited=false;

function tryInit(){
  var tab=document.getElementById('tc-proj');
  if(!tab)return;
  if(tab.classList.contains('on')){
    if(!_projInited){_projInited=true;initModules();}
  }else{
    _projInited=false; // allow reinit on next visit (fresh data)
  }
}

// Async init for SH
var _SH_load=SH._load_internal=async function(sat){
  await dbGet('weekend_shift_templates','activo=eq.true&order=display_order.asc').then(function(rows){
    // This is already happening inside SH closure — we just trigger it
  });
};

// Override SH to use loadTemplates from outer scope
// (Already done inside SH closure — _templates loaded on first call)

var _observer=new MutationObserver(function(){tryInit();});
document.addEventListener('DOMContentLoaded',function(){
  var tab=document.getElementById('tc-proj');
  if(tab){
    _observer.observe(tab,{attributes:true,attributeFilter:['class']});
    if(tab.classList.contains('on'))initModules();
  }
});

// Also hook tab button click directly
var tabBtn=document.getElementById('tab-proj');
if(tabBtn){
  var _origOnclick=tabBtn.onclick;
  tabBtn.addEventListener('click',function(){
    _projInited=false; // force fresh load on each tab visit
    setTimeout(initModules,150);
  });
}

// Expose globals for HTML onclick handlers
window.CM=CM;
window.SH=SH;

// Wait for DOM
if(document.readyState!=='loading'){
  tryInit();
}

})();
</script>
"""

# ─────────────────────────────────────────────────────────
# APPLY CHANGES
# ─────────────────────────────────────────────────────────

# 1. Insert CSS before first </style>
css_anchor = '</style>'
idx = content.find(css_anchor)
if idx == -1:
    print("ERROR: Could not find </style>")
    exit(1)
content = content[:idx] + NEW_CSS + content[idx:]
print("✅ CSS inserted before </style>")

# 2. Insert HTML before <!-- RULETA HSEQ -->
html_anchor = '<!-- RULETA HSEQ -->'
idx = content.find(html_anchor)
if idx == -1:
    print("ERROR: Could not find <!-- RULETA HSEQ -->")
    exit(1)
content = content[:idx] + NEW_HTML + content[idx:]
print("✅ HTML sections inserted before <!-- RULETA HSEQ -->")

# 3. Insert modals + JS before </body>
body_anchor = '</body>'
idx = content.rfind(body_anchor)
if idx == -1:
    print("ERROR: Could not find </body>")
    exit(1)
content = content[:idx] + NEW_MODALS + NEW_JS + '\n' + content[idx:]
print("✅ Modals and JS inserted before </body>")

# Write back
open(FILE, 'w', encoding='utf-8').write(content)
print("✅ File written successfully")
print("   New size:", len(content), "chars")

