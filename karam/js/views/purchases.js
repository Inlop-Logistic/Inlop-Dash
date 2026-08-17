/**
 * KARAM · views/purchases.js — Compras (actualizan inventario y caja)
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatDate, escapeHtml, toast } = KaramUtils;
  const PAY_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'crédito proveedor'];

  window.KaramViews.compras = async function (main) {
    const purchases = (await KaramRepo.purchases.all()).sort((a, b) => new Date(b.date) - new Date(a.date));

    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Compras</h1>
        <button class="btn btn-primary btn-sm" id="btnNewPurchase">+ Registrar compra</button>
      </div>
      <div class="list" id="purchList">
        ${purchases.length ? purchases.map(purchaseCard).join('') : '<p class="muted empty-state">Aún no hay compras registradas.</p>'}
      </div>
    `;

    main.querySelector('#btnNewPurchase').addEventListener('click', openPurchaseModal);
  };

  function purchaseCard(p) {
    const items = (p.items || []).map((i) => `${i.qty}× ${KaramUtils.escapeHtml(i.name)}`).join(', ');
    return `
      <div class="list-card">
        <div class="row-between"><b>${KaramUtils.escapeHtml(p.supplier)}</b><b>${formatCOP(p.total)}</b></div>
        <div class="muted small">${items}</div>
        <div class="muted small">${formatDate(p.date)} · ${KaramUtils.escapeHtml(p.paymentMethod)}${p.observations ? ' · ' + KaramUtils.escapeHtml(p.observations) : ''}</div>
      </div>`;
  }

  async function openPurchaseModal() {
    const ingredients = await KaramRepo.ingredients.all();
    const body = `
      <form id="purchForm" class="form">
        <label>Fecha <input type="date" id="pfDate" value="${KaramUtils.todayKey()}" required></label>
        <label>Proveedor <input type="text" id="pfSupplier" required></label>
        <div id="pfItems"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="pfAddItem">+ Agregar ítem</button>
        <label>Forma de pago
          <select id="pfMethod">${PAY_METHODS.map((m) => `<option>${m}</option>`).join('')}</select>
        </label>
        <label>Observaciones <textarea id="pfObs" rows="2"></textarea></label>
        <div class="total-line row-between"><span>Total</span><b id="pfTotal">${formatCOP(0)}</b></div>
        <div class="form-error" id="pfError" hidden></div>
        <button type="submit" class="btn btn-primary btn-block">Registrar compra</button>
      </form>`;
    KaramModal.open('Registrar compra', body, { large: true, onMount: (root) => setup(root, ingredients) });
  }

  function row(ingredients) {
    return `
      <div class="order-item-row three-col">
        <select class="piIng">${ingredients.map((i) => `<option value="${i.id}">${KaramUtils.escapeHtml(i.name)} (${i.unit})</option>`).join('')}</select>
        <input type="number" class="piQty" min="0" step="any" placeholder="Cant.">
        <input type="number" class="piCost" min="0" placeholder="Valor total">
        <button type="button" class="icon-btn piRemove">✕</button>
      </div>`;
  }

  function setup(root, ingredients) {
    const itemsEl = root.querySelector('#pfItems');
    if (!ingredients.length) {
      itemsEl.innerHTML = '<p class="muted">Registra ingredientes primero en Productos → Ingredientes.</p>';
    } else {
      itemsEl.insertAdjacentHTML('beforeend', row(ingredients));
    }
    root.querySelector('#pfAddItem').addEventListener('click', () => {
      if (!ingredients.length) return;
      itemsEl.insertAdjacentHTML('beforeend', row(ingredients));
    });
    itemsEl.addEventListener('click', (e) => { if (e.target.classList.contains('piRemove') && itemsEl.children.length > 1) e.target.closest('.order-item-row').remove(); recalc(); });
    itemsEl.addEventListener('input', recalc);

    function currentItems() {
      return [...itemsEl.querySelectorAll('.order-item-row')].map((r) => {
        const ingredientId = r.querySelector('.piIng').value;
        const ing = ingredients.find((i) => i.id === ingredientId);
        return { ingredientId, name: ing ? ing.name : '', qty: Number(r.querySelector('.piQty').value) || 0, total: Number(r.querySelector('.piCost').value) || 0 };
      }).filter((i) => i.ingredientId && i.qty > 0 && i.total >= 0);
    }
    function recalc() {
      root.querySelector('#pfTotal').textContent = formatCOP(currentItems().reduce((s, i) => s + i.total, 0));
    }

    root.querySelector('#purchForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = root.querySelector('#pfError');
      const items = currentItems();
      if (!items.length) { errEl.textContent = 'Agrega al menos un ítem.'; errEl.hidden = false; return; }
      const total = items.reduce((s, i) => s + i.total, 0);
      const purchase = await KaramRepo.purchases.create({
        date: root.querySelector('#pfDate').value,
        supplier: root.querySelector('#pfSupplier').value.trim(),
        items,
        total,
        paymentMethod: root.querySelector('#pfMethod').value,
        observations: root.querySelector('#pfObs').value.trim(),
      });
      for (const it of items) {
        await KaramRepo.adjustIngredientStock(it.ingredientId, it.qty);
        await KaramRepo.addInventoryMovement({ ingredientId: it.ingredientId, type: 'entrada', qty: it.qty, reference: purchase.id, note: 'Compra a ' + purchase.supplier });
        const ing = ingredients.find((i) => i.id === it.ingredientId);
        if (ing && it.qty > 0) {
          const newCost = it.total / it.qty;
          await KaramRepo.ingredients.update(it.ingredientId, { costPerUnit: Number(newCost.toFixed(2)) });
        }
      }
      await KaramRepo.addCashMovement({ type: 'purchase', amount: total, concept: 'Compra a ' + purchase.supplier, method: purchase.paymentMethod, reference: purchase.id });
      KaramModal.close();
      toast('Compra registrada ✅ · inventario y caja actualizados');
      window.KaramApp.refresh();
    });
  }
})();
