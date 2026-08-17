/**
 * KARAM · views/cash.js — Caja y cierre diario
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatDateTime, formatDate, escapeHtml, toast, todayKey } = KaramUtils;
  const { cashBalance } = KaramCalc;

  const TYPE_LABEL = { income: 'Ingreso', purchase: 'Compra', expense: 'Gasto', withdrawal: 'Retiro', salary: 'Sueldo', contribution: 'Aporte' };
  const IN_TYPES = ['income', 'contribution'];

  window.KaramViews.caja = async function (main) {
    const [movements, closings] = await Promise.all([KaramRepo.cashMovements.all(), KaramRepo.dailyClosings.all()]);
    const sorted = movements.sort((a, b) => new Date(b.date) - new Date(a.date));
    const balance = cashBalance(movements);

    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Caja</h1>
        <button class="btn btn-primary btn-sm" id="btnClosing">Cierre diario</button>
      </div>
      <div class="finance-card card">
        <div class="finance-row finance-total"><span>Saldo de caja</span><b>${formatCOP(balance)}</b></div>
      </div>
      <h3 class="section-title">Movimientos</h3>
      <div class="list" id="movList">
        ${sorted.length ? sorted.slice(0, 80).map((m) => `
          <div class="list-card">
            <div class="row-between"><b>${escapeHtml(TYPE_LABEL[m.type] || m.type)}</b><b class="${IN_TYPES.includes(m.type) ? 'text-green' : 'text-red'}">${IN_TYPES.includes(m.type) ? '+' : '-'}${formatCOP(m.amount)}</b></div>
            <div class="muted small">${escapeHtml(m.concept || '')} · ${formatDateTime(m.date)} · ${escapeHtml(m.method || '')}</div>
          </div>`).join('') : '<p class="muted empty-state">Sin movimientos.</p>'}
      </div>
      <h3 class="section-title">Cierres diarios</h3>
      <div class="list" id="closingsList">
        ${closings.length ? closings.sort((a, b) => new Date(b.date) - new Date(a.date)).map((c) => `
          <div class="list-card">
            <div class="row-between"><b>${formatDate(c.date)}</b><span class="${c.difference === 0 ? 'text-green' : 'text-red'}">Dif: ${formatCOP(c.difference)}</span></div>
            <div class="muted small">Ventas ${formatCOP(c.sales)} · Efectivo ${formatCOP(c.cashCounted)} · Transf. ${formatCOP(c.transfers)} · Otros ${formatCOP(c.other)}</div>
            <div class="muted small">Gastos ${formatCOP(c.expenses)} · Retiros ${formatCOP(c.withdrawals)}</div>
          </div>`).join('') : '<p class="muted empty-state">Sin cierres registrados.</p>'}
      </div>
    `;

    main.querySelector('#btnClosing').addEventListener('click', () => openClosingModal(movements));
  };

  async function openClosingModal(movements) {
    const date = todayKey();
    const todays = movements.filter((m) => todayKey(m.date) === date);
    const sales = todays.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
    const expenses = todays.filter((m) => m.type === 'expense' || m.type === 'purchase').reduce((s, m) => s + m.amount, 0);
    const withdrawals = todays.filter((m) => m.type === 'withdrawal' || m.type === 'salary').reduce((s, m) => s + m.amount, 0);
    const cashByMethod = (method) => todays.filter((m) => m.type === 'income' && m.method === method).reduce((s, m) => s + m.amount, 0);

    const body = `
      <form id="closeForm" class="form">
        <div class="finance-row"><span>Ventas del día (sistema)</span><b>${formatCOP(sales)}</b></div>
        <label>Efectivo contado <input type="number" id="cfCash" value="${cashByMethod('efectivo')}" min="0"></label>
        <label>Transferencias <input type="number" id="cfTransfer" value="${cashByMethod('transferencia')}" min="0"></label>
        <label>Otros medios <input type="number" id="cfOther" value="${sales - cashByMethod('efectivo') - cashByMethod('transferencia')}" min="0"></label>
        <div class="finance-row"><span>Gastos del día</span><b>${formatCOP(expenses)}</b></div>
        <div class="finance-row"><span>Retiros del día</span><b>${formatCOP(withdrawals)}</b></div>
        <label>Notas <textarea id="cfNotes" rows="2"></textarea></label>
        <div class="form-error" id="cfError" hidden></div>
        <button type="submit" class="btn btn-primary btn-block">Guardar cierre</button>
      </form>`;
    KaramModal.open('Cierre diario · ' + date, body, {
      onMount: (root) => {
        root.querySelector('#closeForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const cashCounted = Number(root.querySelector('#cfCash').value) || 0;
          const transfers = Number(root.querySelector('#cfTransfer').value) || 0;
          const other = Number(root.querySelector('#cfOther').value) || 0;
          const declared = cashCounted + transfers + other;
          const difference = declared - sales;
          await KaramRepo.dailyClosings.create({
            date, sales, cashCounted, transfers, other, expenses, withdrawals, difference,
            notes: root.querySelector('#cfNotes').value.trim(),
          });
          KaramModal.close();
          toast(difference === 0 ? 'Cierre guardado sin diferencias ✅' : `Cierre guardado. Diferencia: ${formatCOP(difference)}`);
          window.KaramApp.refresh();
        });
      },
    });
  }
})();
