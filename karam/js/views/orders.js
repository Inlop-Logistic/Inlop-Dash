/**
 * KARAM · views/orders.js — Pedidos y transición a venta.
 * -----------------------------------------------------------------------
 * PEDIDO ≠ VENTA: crear un pedido NO registra una venta. La venta
 * (con su costo, movimiento de caja y consumo de inventario) se genera
 * únicamente cuando el pedido pasa a "confirmado" — la primera acción
 * explícita que compromete producción/cobro. Se guarda `order.saleId`
 * como bandera de idempotencia: aunque el pedido cambie de estado varias
 * veces (preparando → listo → entregado), la venta solo se crea una vez.
 * Si se cancela un pedido que aún no tiene `saleId` (pendiente), no hay
 * nada que revertir: nunca afectó ventas ni utilidad. Si ya tenía
 * `saleId`, cancelar anula la venta y revierte caja + inventario.
 * -----------------------------------------------------------------------
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatDateTime, escapeHtml, waLink, toast, confirmAction, nowISO } = KaramUtils;
  const { activePromotionForProduct, lineTotal, productCost } = KaramCalc;

  const STATUSES = ['pendiente', 'confirmado', 'preparando', 'listo', 'entregado', 'cancelado'];
  const STATUS_LABEL = { pendiente: 'Pendiente', confirmado: 'Confirmado', preparando: 'Preparando', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' };
  const PAY_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];
  // Estado en el que un pedido se convierte en venta real (una sola vez).
  const SALE_TRIGGER_STATUS = 'confirmado';

  window.KaramViews.orders = async function (main) {
    const orders = (await KaramRepo.orders.all()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Pedidos</h1>
        <button class="btn btn-primary" id="btnNewOrderTop">+ Nuevo pedido</button>
      </div>
      <div class="tabs" id="orderTabs">
        <button class="tab active" data-f="todos">Todos</button>
        ${STATUSES.map((s) => `<button class="tab" data-f="${s}">${STATUS_LABEL[s]}</button>`).join('')}
      </div>
      <div id="ordersList" class="list"></div>
    `;

    const listEl = main.querySelector('#ordersList');
    function paint(filter) {
      const rows = filter === 'todos' ? orders : orders.filter((o) => o.status === filter);
      listEl.innerHTML = rows.length ? rows.map(orderCard).join('') : '<p class="muted empty-state">No hay pedidos aún.</p>';
    }
    paint('todos');

    main.querySelector('#orderTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      main.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      paint(btn.dataset.f);
    });

    main.querySelector('#btnNewOrderTop').addEventListener('click', openNewOrderModal);

    listEl.addEventListener('click', async (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (!id) return;
      if (e.target.closest('.js-wa')) return sendWhatsApp(id);
      if (e.target.closest('.js-status')) return changeStatus(id, e.target.closest('.js-status').dataset.status);
      if (e.target.closest('.js-cancel')) return cancelOrder(id);
    });

    function orderCard(o) {
      const itemsTxt = o.items.map((i) => `${i.qty}× ${escapeHtml(i.name)}`).join(', ');
      const nextActions = STATUSES.filter((s) => s !== o.status && s !== 'cancelado')
        .map((s) => `<button class="chip js-status" data-id="${o.id}" data-status="${s}">${STATUS_LABEL[s]}</button>`).join('');
      return `
        <div class="list-card order-card status-${o.status}">
          <div class="row-between">
            <b>${escapeHtml(o.customerName)}</b>
            <span class="badge badge-${o.status}">${STATUS_LABEL[o.status]}</span>
          </div>
          <div class="muted small">${itemsTxt}</div>
          <div class="row-between mt8">
            <span class="muted small">${formatDateTime(o.createdAt)} · ${o.paymentMethod}${o.saleId ? ' · venta registrada' : ' · aún no es venta'}</span>
            <b>${formatCOP(o.total)}</b>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm btn-ghost js-wa" data-id="${o.id}">📲 WhatsApp</button>
            ${o.status !== 'cancelado' && o.status !== 'entregado' ? `<button class="btn btn-sm btn-danger-ghost js-cancel" data-id="${o.id}">Cancelar</button>` : ''}
          </div>
          ${o.status !== 'cancelado' ? `<div class="chip-row">${nextActions}</div>` : ''}
        </div>`;
    }

    async function changeStatus(id, status) {
      await advanceOrderStatus(id, status);
      toast('Pedido actualizado a ' + STATUS_LABEL[status]);
      window.KaramApp.refresh();
    }

    async function cancelOrder(id) {
      const order = await KaramRepo.orders.get(id);
      const msg = order && order.saleId
        ? '¿Cancelar este pedido? Ya generó una venta: se anulará y se revertirá inventario y caja.'
        : '¿Cancelar este pedido? Aún no había generado una venta, así que no afecta ventas ni utilidad.';
      const ok = await confirmAction(msg);
      if (!ok) return;
      await voidOrder(id);
      toast('Pedido cancelado');
      window.KaramApp.refresh();
    }

    async function sendWhatsApp(id) {
      const order = await KaramRepo.orders.get(id);
      const settings = await KaramRepo.getSettings();
      const lines = order.items.map((i) => `• ${i.qty} × ${i.name} — ${formatCOP(i.lineTotal)}`).join('\n');
      const pay = settings.payment || {};
      let payInfo = '';
      if (pay.bank || pay.accountNumber) {
        payInfo = `\n\n💳 Datos de pago:\nBanco: ${pay.bank || '-'}\nCuenta ${pay.accountType || ''}: ${pay.accountNumber || '-'}\nTitular: ${pay.holder || '-'}`;
      }
      const msg = `Hola ${order.customerName}! 👋 Este es el resumen de tu pedido en *KARAM Shawarma & Grill*:\n\n${lines}\n\n*Total: ${formatCOP(order.total)}*\nMétodo de pago: ${order.paymentMethod}${payInfo}\n\n¡Gracias por tu compra! 🙌`;
      const phone = order.phone || settings.whatsappNumber;
      window.open(waLink(phone, msg), '_blank');
    }

    async function openNewOrderModal() {
      const [products, promotions] = await Promise.all([KaramRepo.products.all(), KaramRepo.promotions.all()]);
      const activeProducts = products.filter((p) => p.active !== false);
      const body = `
        <form id="orderForm" class="form">
          <label>Cliente <input type="text" id="ofCustomer" required></label>
          <label>Teléfono (WhatsApp) <input type="tel" id="ofPhone" placeholder="573001234567" required></label>
          <div id="ofItems" class="order-items"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="ofAddItem">+ Agregar producto</button>
          <label>Método de pago
            <select id="ofPayment">${PAY_METHODS.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
          </label>
          <div class="total-line row-between"><span>Total</span><b id="ofTotal">${formatCOP(0)}</b></div>
          <p class="muted small">El pedido se crea como <b>pendiente</b>. La venta se registra al confirmarlo.</p>
          <div class="form-error" id="ofError" hidden></div>
          <button type="submit" class="btn btn-primary btn-block">Crear pedido</button>
        </form>`;
      KaramModal.open('Nuevo pedido', body, {
        onMount: (root) => setupOrderForm(root, activeProducts, promotions),
      });
    }

    function itemRow(idx, products) {
      return `
        <div class="order-item-row" data-idx="${idx}">
          <select class="ofProduct">
            ${products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
          <input type="number" class="ofQty" min="1" value="1">
          <button type="button" class="icon-btn ofRemove">✕</button>
        </div>`;
    }

    function setupOrderForm(root, products, promotions) {
      const itemsEl = root.querySelector('#ofItems');
      let idx = 0;
      function addRow() {
        itemsEl.insertAdjacentHTML('beforeend', itemRow(idx++, products));
        recalc();
      }
      addRow();

      root.querySelector('#ofAddItem').addEventListener('click', addRow);
      itemsEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('ofRemove')) {
          if (itemsEl.children.length > 1) e.target.closest('.order-item-row').remove();
          recalc();
        }
      });
      itemsEl.addEventListener('input', recalc);

      function recalc() {
        let total = 0;
        itemsEl.querySelectorAll('.order-item-row').forEach((row) => {
          const productId = row.querySelector('.ofProduct').value;
          const qty = Number(row.querySelector('.ofQty').value) || 0;
          const product = products.find((p) => p.id === productId);
          if (!product) return;
          const promo = activePromotionForProduct(productId, promotions);
          const { total: lt } = lineTotal(product, promo, qty);
          total += lt;
        });
        root.querySelector('#ofTotal').textContent = formatCOP(total);
      }

      root.querySelector('#orderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = root.querySelector('#ofError');
        errEl.hidden = true;
        const customerName = root.querySelector('#ofCustomer').value.trim();
        const phone = root.querySelector('#ofPhone').value.trim();
        const paymentMethod = root.querySelector('#ofPayment').value;
        const rows = [...itemsEl.querySelectorAll('.order-item-row')];
        const items = [];
        for (const row of rows) {
          const productId = row.querySelector('.ofProduct').value;
          const qty = Number(row.querySelector('.ofQty').value) || 0;
          if (qty <= 0) continue;
          const product = products.find((p) => p.id === productId);
          const promo = activePromotionForProduct(productId, promotions);
          const { total: lt, promoApplied } = lineTotal(product, promo, qty);
          items.push({ productId, name: product.name, qty, unitPrice: product.priceNormal, lineTotal: lt, promoApplied, promotionId: promo ? promo.id : null });
        }
        if (!customerName || items.length === 0) {
          errEl.textContent = 'Completa cliente y al menos un producto.';
          errEl.hidden = false;
          return;
        }
        try {
          await createOrder({ customerName, phone, items, paymentMethod });
          KaramModal.close();
          toast('Pedido creado ✅ (pendiente — aún no es venta)');
          window.KaramApp.refresh();
        } catch (err) {
          errEl.textContent = 'Error: ' + err.message;
          errEl.hidden = false;
        }
      });
    }
  };

  // -------------------------------------------------------------- lógica de negocio

  // Crear pedido: NO genera venta, NO toca caja, NO consume inventario.
  async function createOrder({ customerName, phone, items, paymentMethod }) {
    const total = items.reduce((s, i) => s + i.lineTotal, 0);
    const order = await KaramRepo.orders.create({ customerName, phone, items, total, paymentMethod, status: 'pendiente', saleId: null });
    return { order };
  }

  // Registra la venta real: costo, consumo de inventario y movimiento de
  // caja. Idempotente vía `order.saleId` — nunca se llama dos veces para
  // el mismo pedido aunque cambie de estado varias veces.
  async function registerSale(order) {
    if (order.saleId) return order; // ya convertido en venta, no duplicar

    const [recipes, ingredientsList] = await Promise.all([KaramRepo.recipes.all(), KaramRepo.ingredients.all()]);
    const ingredientsById = new Map(ingredientsList.map((i) => [i.id, i]));
    let cost = 0;
    for (const item of order.items) {
      const recipe = recipes.find((r) => r.productId === item.productId);
      const unitCost = productCost(recipe, ingredientsById);
      cost += unitCost * item.qty;
      if (recipe) {
        for (const ri of recipe.items) {
          const consume = ri.qty * item.qty;
          await KaramRepo.adjustIngredientStock(ri.ingredientId, -consume);
          await KaramRepo.addInventoryMovement({ ingredientId: ri.ingredientId, type: 'consumo', qty: -consume, reference: order.id, note: 'Consumo por confirmación de pedido' });
        }
      }
    }

    const sale = await KaramRepo.sales.create({ orderId: order.id, date: nowISO(), total: order.total, cost, paymentMethod: order.paymentMethod, items: order.items, voided: false });
    await KaramRepo.addCashMovement({ type: 'income', amount: order.total, concept: 'Venta pedido ' + order.customerName, method: order.paymentMethod, reference: order.id });
    return KaramRepo.orders.update(order.id, { saleId: sale.id });
  }

  // Avanza el estado del pedido. Si el nuevo estado es el disparador de
  // venta (confirmado) y todavía no existe saleId, registra la venta.
  async function advanceOrderStatus(orderId, status) {
    const order = await KaramRepo.orders.get(orderId);
    if (!order) return;
    let updated = await KaramRepo.orders.update(orderId, { status });
    if (status === SALE_TRIGGER_STATUS || (!updated.saleId && ['preparando', 'listo', 'entregado'].includes(status))) {
      updated = await registerSale(updated);
    }
    return updated;
  }

  // Cancelar: si el pedido nunca llegó a generar venta (sin saleId), solo
  // se marca cancelado — nunca afectó ventas ni utilidad. Si ya tenía
  // venta, se anula y se revierte caja + inventario.
  async function voidOrder(orderId) {
    const order = await KaramRepo.orders.get(orderId);
    if (!order || order.status === 'cancelado') return;

    if (order.saleId) {
      const sale = await KaramRepo.sales.get(order.saleId);
      if (sale && !sale.voided) {
        await KaramRepo.sales.update(sale.id, { voided: true });
        await KaramRepo.addCashMovement({ type: 'withdrawal', amount: sale.total, concept: 'Reverso venta cancelada — ' + order.customerName, method: order.paymentMethod, reference: order.id });
        const recipes = await KaramRepo.recipes.all();
        for (const item of order.items) {
          const recipe = recipes.find((r) => r.productId === item.productId);
          if (recipe) {
            for (const ri of recipe.items) {
              const restock = ri.qty * item.qty;
              await KaramRepo.adjustIngredientStock(ri.ingredientId, restock);
              await KaramRepo.addInventoryMovement({ ingredientId: ri.ingredientId, type: 'ajuste', qty: restock, reference: order.id, note: 'Reverso por cancelación de pedido' });
            }
          }
        }
      }
    }
    await KaramRepo.orders.update(orderId, { status: 'cancelado' });
  }

  window.KaramOrders = { createOrder, registerSale, advanceOrderStatus, voidOrder, STATUSES, STATUS_LABEL, PAY_METHODS, SALE_TRIGGER_STATUS };
})();
