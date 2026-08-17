/**
 * KARAM · views/inventory.js — Inventario de ingredientes y movimientos.
 * El stock vive en "ingredients"; aquí se listan existencias, alertas y
 * el historial de "inventory_movements" (entradas/consumo/ajustes/merma).
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatNumber, formatDateTime, escapeHtml, toast } = KaramUtils;

  const TYPE_LABEL = { entrada: 'Entrada', consumo: 'Consumo', ajuste: 'Ajuste', merma: 'Merma' };

  window.KaramViews.inventario = async function (main) {
    const [ingredients, movements] = await Promise.all([KaramRepo.ingredients.all(), KaramRepo.inventoryMovements.all()]);
    const sortedMoves = movements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 60);
    const ingById = new Map(ingredients.map((i) => [i.id, i]));

    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Inventario</h1>
        <button class="btn btn-primary btn-sm" id="btnAdjust">Ajustar / Merma</button>
      </div>
      <div class="list" id="stockList">
        ${ingredients.length ? ingredients.map(stockCard).join('') : '<p class="muted empty-state">Sin ingredientes registrados.</p>'}
      </div>
      <h3 class="section-title">Movimientos recientes</h3>
      <div class="list">
        ${sortedMoves.length ? sortedMoves.map((m) => `
          <div class="list-card">
            <div class="row-between"><b>${escapeHtml(ingById.get(m.ingredientId)?.name || '—')}</b><span class="badge">${TYPE_LABEL[m.type] || m.type}</span></div>
            <div class="muted small">${m.qty > 0 ? '+' : ''}${formatNumber(m.qty)} · ${formatDateTime(m.date)}${m.note ? ' · ' + escapeHtml(m.note) : ''}</div>
          </div>`).join('') : '<p class="muted empty-state">Sin movimientos.</p>'}
      </div>
    `;

    main.querySelector('#btnAdjust').addEventListener('click', () => openAdjustModal(ingredients));

    function stockCard(i) {
      const low = Number(i.stock) <= Number(i.minStock || 0);
      return `
        <div class="list-card ${low ? 'stock-low' : ''}">
          <div class="row-between"><b>${escapeHtml(i.name)}</b>${low ? '<span class="badge badge-cancelado">Bajo mínimo</span>' : ''}</div>
          <div class="row-between mt8"><span class="muted small">Existencia</span><b>${formatNumber(i.stock)} ${escapeHtml(i.unit)}</b></div>
          <div class="row-between"><span class="muted small">Mínimo</span><span>${formatNumber(i.minStock)} ${escapeHtml(i.unit)}</span></div>
        </div>`;
    }
  };

  function openAdjustModal(ingredients) {
    const body = `
      <form id="adjForm" class="form">
        <label>Ingrediente
          <select id="adjIng">${ingredients.map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('')}</select>
        </label>
        <label>Tipo de movimiento
          <select id="adjType">
            <option value="ajuste">Ajuste (+/-)</option>
            <option value="merma">Merma (resta)</option>
            <option value="entrada">Entrada manual (+)</option>
          </select>
        </label>
        <label>Cantidad <input type="number" id="adjQty" step="any" required></label>
        <label>Nota <input type="text" id="adjNote" placeholder="Motivo"></label>
        <div class="form-error" id="adjError" hidden></div>
        <button type="submit" class="btn btn-primary btn-block">Guardar movimiento</button>
      </form>`;
    KaramModal.open('Ajustar inventario', body, {
      onMount: (root) => {
        root.querySelector('#adjForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const ingredientId = root.querySelector('#adjIng').value;
          const type = root.querySelector('#adjType').value;
          let qty = Number(root.querySelector('#adjQty').value) || 0;
          if (type === 'merma') qty = -Math.abs(qty);
          const note = root.querySelector('#adjNote').value.trim();
          await KaramRepo.adjustIngredientStock(ingredientId, qty);
          await KaramRepo.addInventoryMovement({ ingredientId, type, qty, note });
          KaramModal.close();
          toast('Movimiento registrado ✅');
          window.KaramApp.refresh();
        });
      },
    });
  }
})();
