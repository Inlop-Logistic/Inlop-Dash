/**
 * KARAM · views/expenses.js — Gastos
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatDate, escapeHtml, toast, todayKey } = KaramUtils;
  const CATEGORIES = ['gas', 'servicios', 'empaques', 'publicidad', 'mantenimiento', 'transporte', 'otros'];
  const PAY_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'crédito'];

  window.KaramViews.gastos = async function (main) {
    const expenses = (await KaramRepo.expenses.all()).sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Gastos</h1>
        <button class="btn btn-primary btn-sm" id="btnNewExpense">+ Registrar gasto</button>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Total histórico</div><div class="stat-value">${formatCOP(total)}</div></div>
        <div class="stat-card"><div class="stat-label">Pendientes de pago</div><div class="stat-value">${formatCOP(expenses.filter((e) => e.paid === false).reduce((s, e) => s + e.amount, 0))}</div></div>
      </div>
      <div class="list" id="expList">
        ${expenses.length ? expenses.map(card).join('') : '<p class="muted empty-state">Sin gastos registrados.</p>'}
      </div>
    `;

    main.querySelector('#btnNewExpense').addEventListener('click', openModal);
    main.querySelector('#expList').addEventListener('click', async (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (!id) return;
      if (e.target.closest('.js-markpaid')) {
        await KaramRepo.expenses.update(id, { paid: true });
        await KaramRepo.addCashMovement({ type: 'expense', amount: (await KaramRepo.expenses.get(id)).amount, concept: 'Pago de gasto pendiente', reference: id });
        toast('Gasto marcado como pagado');
        window.KaramApp.refresh();
      }
    });
  };

  function card(e) {
    return `
      <div class="list-card">
        <div class="row-between"><b>${escapeHtml(e.concept)}</b><b>${formatCOP(e.amount)}</b></div>
        <div class="muted small">${escapeHtml(e.category)} · ${formatDate(e.date)} · ${escapeHtml(e.paymentMethod)}</div>
        ${e.observation ? `<div class="muted small">${escapeHtml(e.observation)}</div>` : ''}
        ${e.paid === false ? `<div class="card-actions"><span class="badge badge-cancelado">Pendiente</span><button class="btn btn-sm btn-ghost js-markpaid" data-id="${e.id}">Marcar pagado</button></div>` : ''}
      </div>`;
  }

  function openModal() {
    const body = `
      <form id="expForm" class="form">
        <label>Categoría
          <select id="efCat">${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
        </label>
        <label>Concepto <input type="text" id="efConcept" required></label>
        <label>Fecha <input type="date" id="efDate" value="${todayKey()}" required></label>
        <label>Valor <input type="number" id="efAmount" min="0" required></label>
        <label>Método de pago
          <select id="efMethod">${PAY_METHODS.map((m) => `<option>${m}</option>`).join('')}</select>
        </label>
        <label class="checkbox-label"><input type="checkbox" id="efPaid" checked> Ya está pagado</label>
        <label>Observación <textarea id="efObs" rows="2"></textarea></label>
        <button type="submit" class="btn btn-primary btn-block">Registrar gasto</button>
      </form>`;
    KaramModal.open('Registrar gasto', body, {
      onMount: (root) => {
        root.querySelector('#expForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const paid = root.querySelector('#efPaid').checked;
          const amount = Number(root.querySelector('#efAmount').value) || 0;
          const expense = await KaramRepo.expenses.create({
            category: root.querySelector('#efCat').value,
            concept: root.querySelector('#efConcept').value.trim(),
            date: root.querySelector('#efDate').value,
            amount,
            paymentMethod: root.querySelector('#efMethod').value,
            paid,
            observation: root.querySelector('#efObs').value.trim(),
          });
          if (paid) {
            await KaramRepo.addCashMovement({ type: 'expense', amount, concept: expense.concept, method: expense.paymentMethod, reference: expense.id });
          }
          KaramModal.close();
          toast('Gasto registrado ✅');
          window.KaramApp.refresh();
        });
      },
    });
  }
})();
