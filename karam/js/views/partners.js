/**
 * KARAM · views/partners.js — Socios, aportes, retiros y sueldos.
 * V1: NO se calcula reparto automático de utilidades (regla explícita
 * del brief) hasta que exista configuración de participación.
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatDate, escapeHtml, toast, todayKey } = KaramUtils;
  const TYPES = [
    { v: 'contribution', l: 'Aporte' },
    { v: 'withdrawal', l: 'Retiro' },
    { v: 'salary', l: 'Sueldo' },
  ];

  window.KaramViews.socios = async function (main) {
    const [partners, withdrawals] = await Promise.all([KaramRepo.partners.all(), KaramRepo.withdrawals.all()]);
    const partnersById = new Map(partners.map((p) => [p.id, p]));
    const sorted = withdrawals.sort((a, b) => new Date(b.date) - new Date(a.date));

    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Socios</h1>
        <button class="btn btn-ghost btn-sm" id="btnNewPartner">+ Socio</button>
      </div>
      <div class="chip-row" id="partnerChips">
        ${partners.map((p) => `<span class="chip">${escapeHtml(p.name)}</span>`).join('') || '<span class="muted">Sin socios registrados</span>'}
      </div>
      <button class="btn btn-primary btn-block mt12" id="btnNewMovement">+ Aporte / Retiro / Sueldo</button>
      <h3 class="section-title">Historial</h3>
      <div class="list" id="wList">
        ${sorted.length ? sorted.map((w) => `
          <div class="list-card">
            <div class="row-between"><b>${escapeHtml(partnersById.get(w.partnerId)?.name || '—')}</b><b>${TYPES.find((t) => t.v === w.type)?.l}: ${formatCOP(w.amount)}</b></div>
            <div class="muted small">${formatDate(w.date)}${w.concept ? ' · ' + escapeHtml(w.concept) : ''}</div>
          </div>`).join('') : '<p class="muted empty-state">Sin movimientos de socios.</p>'}
      </div>
    `;

    main.querySelector('#btnNewPartner').addEventListener('click', () => {
      const body = `<form id="pForm" class="form"><label>Nombre <input type="text" id="pfName" required></label><button class="btn btn-primary btn-block">Guardar</button></form>`;
      KaramModal.open('Nuevo socio', body, {
        onMount: (root) => root.querySelector('#pForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          await KaramRepo.partners.create({ name: root.querySelector('#pfName').value.trim() });
          KaramModal.close();
          toast('Socio agregado ✅');
          window.KaramApp.refresh();
        }),
      });
    });

    main.querySelector('#btnNewMovement').addEventListener('click', () => openMovementModal(partners));
  };

  function openMovementModal(partners) {
    if (!partners.length) return KaramUtils.toast('Registra un socio primero', 'error');
    const body = `
      <form id="wForm" class="form">
        <label>Socio
          <select id="wfPartner">${partners.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select>
        </label>
        <label>Tipo
          <select id="wfType">${TYPES.map((t) => `<option value="${t.v}">${t.l}</option>`).join('')}</select>
        </label>
        <label>Fecha <input type="date" id="wfDate" value="${todayKey()}" required></label>
        <label>Valor <input type="number" id="wfAmount" min="0" required></label>
        <label>Concepto <input type="text" id="wfConcept"></label>
        <div class="form-error" id="wfError" hidden></div>
        <button type="submit" class="btn btn-primary btn-block">Guardar</button>
      </form>`;
    KaramModal.open('Aporte / Retiro / Sueldo', body, {
      onMount: (root) => {
        root.querySelector('#wForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const type = root.querySelector('#wfType').value;
          const amount = Number(root.querySelector('#wfAmount').value) || 0;
          const partnerId = root.querySelector('#wfPartner').value;
          const concept = root.querySelector('#wfConcept').value.trim();
          const date = root.querySelector('#wfDate').value;

          if (type === 'withdrawal' || type === 'salary') {
            const [cashMovements, expenses, settings] = await Promise.all([KaramRepo.cashMovements.all(), KaramRepo.expenses.all(), KaramRepo.getSettings()]);
            const cap = KaramCalc.capitalOverview({ cashMovements, expenses, settings });
            if (amount > cap.disponible) {
              const ok = await KaramUtils.confirmAction(`El retiro (${formatCOP(amount)}) supera el dinero disponible (${formatCOP(cap.disponible)}). ¿Continuar de todos modos?`);
              if (!ok) return;
            }
          }

          await KaramRepo.withdrawals.create({ partnerId, type, amount, date, concept });
          await KaramRepo.addCashMovement({ type, amount, concept: concept || TYPES.find((t) => t.v === type)?.l, reference: partnerId });
          KaramModal.close();
          toast('Movimiento registrado ✅');
          window.KaramApp.refresh();
        });
      },
    });
  }
})();
