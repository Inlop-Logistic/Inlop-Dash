/**
 * KARAM · views/promotions.js — Promociones configurables por día
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatDate, escapeHtml, toast, confirmAction, DAY_NAMES } = KaramUtils;

  window.KaramViews.promociones = async function (main) {
    const [promotions, products] = await Promise.all([KaramRepo.promotions.all(), KaramRepo.products.all()]);
    const productsById = new Map(products.map((p) => [p.id, p]));

    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Promociones</h1>
        <button class="btn btn-primary btn-sm" id="btnNewPromo">+ Nueva promoción</button>
      </div>
      <div class="list" id="promoList">
        ${promotions.length ? promotions.map((p) => card(p, productsById)).join('') : '<p class="muted empty-state">Sin promociones configuradas.</p>'}
      </div>
    `;

    main.querySelector('#btnNewPromo').addEventListener('click', () => openModal(null, products));
    main.querySelector('#promoList').addEventListener('click', async (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (!id) return;
      if (e.target.closest('.js-edit')) return openModal(id, products);
      if (e.target.closest('.js-toggle')) {
        const promo = await KaramRepo.promotions.get(id);
        await KaramRepo.promotions.update(id, { active: !promo.active });
        window.KaramApp.refresh();
      }
      if (e.target.closest('.js-del')) {
        const ok = await confirmAction('¿Eliminar esta promoción?');
        if (!ok) return;
        await KaramRepo.promotions.remove(id);
        toast('Promoción eliminada');
        window.KaramApp.refresh();
      }
    });
  };

  function card(p, productsById) {
    const prods = (p.productIds || []).map((id) => productsById.get(id)?.name).filter(Boolean).join(', ');
    const days = (p.days || []).map((d) => DAY_NAMES[d]).join(', ');
    return `
      <div class="list-card">
        <div class="row-between"><b>${escapeHtml(p.name)}</b><span class="badge ${p.active ? 'badge-entregado' : 'badge-cancelado'}">${p.active ? 'Activa' : 'Inactiva'}</span></div>
        <div class="muted small">${escapeHtml(prods)} · ${formatCOP(p.price)} por ${p.qty || 1}</div>
        <div class="muted small">Días: ${escapeHtml(days) || 'todos'}${p.startDate ? ` · Desde ${formatDate(p.startDate)}` : ''}${p.endDate ? ` hasta ${formatDate(p.endDate)}` : ''}</div>
        <div class="card-actions">
          <button class="btn btn-sm btn-ghost js-edit" data-id="${p.id}">Editar</button>
          <button class="btn btn-sm btn-ghost js-toggle" data-id="${p.id}">${p.active ? 'Desactivar' : 'Activar'}</button>
          <button class="btn btn-sm btn-danger-ghost js-del" data-id="${p.id}">Eliminar</button>
        </div>
      </div>`;
  }

  async function openModal(id, products) {
    let promo = { name: '', productIds: [], price: 0, qty: 2, days: [2, 3, 4], startDate: '', endDate: '', active: true };
    if (id) promo = await KaramRepo.promotions.get(id);
    const body = `
      <form id="promoForm" class="form">
        <label>Nombre <input type="text" id="pfName" value="${escapeHtml(promo.name)}" required></label>
        <label>Productos incluidos
          <select id="pfProducts" multiple size="${Math.min(6, Math.max(3, products.length))}">
            ${products.map((p) => `<option value="${p.id}" ${promo.productIds.includes(p.id) ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </label>
        <div class="two-col">
          <label>Precio combo <input type="number" id="pfPrice" value="${promo.price}" min="0" required></label>
          <label>Cantidad del combo <input type="number" id="pfQty" value="${promo.qty || 1}" min="1" required></label>
        </div>
        <label>Días de aplicación</label>
        <div class="chip-row" id="pfDays">
          ${DAY_NAMES.map((n, i) => `<label class="day-chip"><input type="checkbox" value="${i}" ${promo.days?.includes(i) ? 'checked' : ''}> ${n.slice(0, 3)}</label>`).join('')}
        </div>
        <div class="two-col">
          <label>Fecha inicio (opcional) <input type="date" id="pfStart" value="${promo.startDate || ''}"></label>
          <label>Fecha fin (opcional) <input type="date" id="pfEnd" value="${promo.endDate || ''}"></label>
        </div>
        <label class="checkbox-label"><input type="checkbox" id="pfActive" ${promo.active ? 'checked' : ''}> Activa</label>
        <button type="submit" class="btn btn-primary btn-block">Guardar</button>
      </form>`;
    KaramModal.open(id ? 'Editar promoción' : 'Nueva promoción', body, {
      large: true,
      onMount: (root) => {
        root.querySelector('#promoForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const productIds = [...root.querySelector('#pfProducts').selectedOptions].map((o) => o.value);
          const days = [...root.querySelectorAll('#pfDays input:checked')].map((c) => Number(c.value));
          const data = {
            name: root.querySelector('#pfName').value.trim(),
            productIds,
            price: Number(root.querySelector('#pfPrice').value) || 0,
            qty: Number(root.querySelector('#pfQty').value) || 1,
            days,
            startDate: root.querySelector('#pfStart').value || null,
            endDate: root.querySelector('#pfEnd').value || null,
            active: root.querySelector('#pfActive').checked,
          };
          if (id) await KaramRepo.promotions.update(id, data);
          else await KaramRepo.promotions.create(data);
          KaramModal.close();
          toast('Promoción guardada ✅');
          window.KaramApp.refresh();
        });
      },
    });
  }
})();
