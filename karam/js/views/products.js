/**
 * KARAM · views/products.js — Productos, receta/costeo e ingredientes maestros.
 * El costo se recalcula siempre "al vuelo" a partir del costo vigente de
 * cada ingrediente — nunca se guarda un costo congelado en el producto.
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatNumber, escapeHtml, toast, confirmAction } = KaramUtils;
  const { productCosting } = KaramCalc;

  window.KaramViews.productos = async function (main) {
    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Productos &amp; costeo</h1>
      </div>
      <div class="tabs" id="prodTabs">
        <button class="tab active" data-t="productos">Productos</button>
        <button class="tab" data-t="ingredientes">Ingredientes</button>
      </div>
      <div id="prodPanel"></div>
    `;

    const panel = main.querySelector('#prodPanel');
    async function paint(tab) {
      if (tab === 'productos') return paintProducts(panel);
      return paintIngredients(panel);
    }
    paint('productos');

    main.querySelector('#prodTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      main.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      paint(btn.dataset.t);
    });
  };

  async function paintProducts(panel) {
    const [products, recipes, ingredients] = await Promise.all([KaramRepo.products.all(), KaramRepo.recipes.all(), KaramRepo.ingredients.all()]);
    const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));

    panel.innerHTML = `
      <button class="btn btn-primary btn-sm mb12" id="btnNewProduct">+ Nuevo producto</button>
      <div class="list" id="productList"></div>
    `;
    const listEl = panel.querySelector('#productList');
    listEl.innerHTML = products.length ? products.map((p) => {
      const recipe = recipes.find((r) => r.productId === p.id);
      const c = productCosting(p, recipe, ingredientsById);
      return `
        <div class="list-card">
          <div class="row-between"><b>${escapeHtml(p.name)}</b><span class="badge ${p.active === false ? 'badge-cancelado' : 'badge-entregado'}">${p.active === false ? 'Inactivo' : 'Activo'}</span></div>
          <div class="cost-grid">
            <div><span class="muted small">Precio</span><br><b>${formatCOP(c.price)}</b></div>
            <div><span class="muted small">Promo</span><br><b>${formatCOP(c.priceProm)}</b></div>
            <div><span class="muted small">Costo</span><br><b>${formatCOP(c.cost)}</b></div>
            <div><span class="muted small">Utilidad</span><br><b>${formatCOP(c.utilidad)}</b></div>
            <div><span class="muted small">Margen</span><br><b>${c.margen.toFixed(1)}%</b></div>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm btn-ghost js-edit" data-id="${p.id}">Editar</button>
            <button class="btn btn-sm btn-danger-ghost js-del" data-id="${p.id}">Eliminar</button>
          </div>
        </div>`;
    }).join('') : '<p class="muted empty-state">Aún no hay productos.</p>';

    panel.querySelector('#btnNewProduct').addEventListener('click', () => openProductModal(null, ingredients));
    listEl.addEventListener('click', async (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (!id) return;
      if (e.target.closest('.js-edit')) return openProductModal(id, ingredients);
      if (e.target.closest('.js-del')) {
        const ok = await confirmAction('¿Eliminar este producto?');
        if (!ok) return;
        await KaramRepo.products.remove(id);
        toast('Producto eliminado');
        window.KaramApp.refresh();
      }
    });
  }

  async function openProductModal(id, ingredients) {
    let product = { name: '', priceNormal: 0, pricePromo: 0, active: true };
    let recipe = { items: [] };
    if (id) {
      product = await KaramRepo.products.get(id);
      const recipes = await KaramRepo.recipes.all();
      recipe = recipes.find((r) => r.productId === id) || recipe;
    }
    const body = `
      <form id="prodForm" class="form">
        <label>Nombre <input type="text" id="pfName" value="${escapeHtml(product.name)}" required></label>
        <div class="two-col">
          <label>Precio normal <input type="number" id="pfPrice" value="${product.priceNormal}" min="0" required></label>
          <label>Precio promo <input type="number" id="pfPromo" value="${product.pricePromo}" min="0"></label>
        </div>
        <label class="checkbox-label"><input type="checkbox" id="pfActive" ${product.active !== false ? 'checked' : ''}> Producto activo</label>
        <h4>Receta / ingredientes</h4>
        <div id="pfItems"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="pfAddItem">+ Agregar ingrediente</button>
        <div class="total-line row-between"><span>Costo total</span><b id="pfCost">${formatCOP(0)}</b></div>
        <div class="form-error" id="pfError" hidden></div>
        <button type="submit" class="btn btn-primary btn-block">Guardar</button>
      </form>`;
    KaramModal.open(id ? 'Editar producto' : 'Nuevo producto', body, {
      large: true,
      onMount: (root) => setupProductForm(root, product, recipe, ingredients, id),
    });
  }

  function ingredientRow(item, ingredients) {
    return `
      <div class="order-item-row" data-idx="${Math.random()}">
        <select class="pfIng">
          ${ingredients.map((i) => `<option value="${i.id}" ${item && item.ingredientId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (${i.unit})</option>`).join('')}
        </select>
        <input type="number" class="pfQty" min="0" step="any" value="${item ? item.qty : 0}">
        <button type="button" class="icon-btn pfRemove">✕</button>
      </div>`;
  }

  function setupProductForm(root, product, recipe, ingredients, id) {
    const itemsEl = root.querySelector('#pfItems');
    if (!ingredients.length) {
      itemsEl.innerHTML = '<p class="muted">Registra ingredientes primero en la pestaña "Ingredientes".</p>';
    } else {
      (recipe.items.length ? recipe.items : [null]).forEach((it) => itemsEl.insertAdjacentHTML('beforeend', ingredientRow(it, ingredients)));
    }
    recalc();

    root.querySelector('#pfAddItem').addEventListener('click', () => {
      if (!ingredients.length) return;
      itemsEl.insertAdjacentHTML('beforeend', ingredientRow(null, ingredients));
      recalc();
    });
    itemsEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('pfRemove')) { e.target.closest('.order-item-row').remove(); recalc(); }
    });
    itemsEl.addEventListener('input', recalc);

    const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
    function currentItems() {
      return [...itemsEl.querySelectorAll('.order-item-row')].map((row) => ({
        ingredientId: row.querySelector('.pfIng').value,
        qty: Number(row.querySelector('.pfQty').value) || 0,
      })).filter((i) => i.ingredientId && i.qty > 0);
    }
    function recalc() {
      const items = currentItems();
      const cost = items.reduce((s, it) => s + ((ingredientsById.get(it.ingredientId)?.costPerUnit || 0) * it.qty), 0);
      root.querySelector('#pfCost').textContent = formatCOP(cost);
    }

    root.querySelector('#prodForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = root.querySelector('#pfName').value.trim();
      const priceNormal = Number(root.querySelector('#pfPrice').value) || 0;
      const pricePromo = Number(root.querySelector('#pfPromo').value) || 0;
      const active = root.querySelector('#pfActive').checked;
      if (!name) return;
      let productId = id;
      if (id) {
        await KaramRepo.products.update(id, { name, priceNormal, pricePromo, active });
      } else {
        const created = await KaramRepo.products.create({ name, priceNormal, pricePromo, active });
        productId = created.id;
      }
      const items = currentItems();
      const recipes = await KaramRepo.recipes.all();
      const existing = recipes.find((r) => r.productId === productId);
      if (existing) await KaramRepo.recipes.update(existing.id, { items });
      else await KaramRepo.recipes.create({ productId, items });

      KaramModal.close();
      toast('Producto guardado ✅');
      window.KaramApp.refresh();
    });
  }

  // ---------------------------------------------------------------- Ingredientes
  async function paintIngredients(panel) {
    const ingredients = await KaramRepo.ingredients.all();
    panel.innerHTML = `
      <button class="btn btn-primary btn-sm mb12" id="btnNewIng">+ Nuevo ingrediente</button>
      <div class="list" id="ingList"></div>
    `;
    const listEl = panel.querySelector('#ingList');
    listEl.innerHTML = ingredients.length ? ingredients.map((i) => `
      <div class="list-card">
        <div class="row-between"><b>${escapeHtml(i.name)}</b><span>${formatCOP(i.costPerUnit)} / ${escapeHtml(i.unit)}</span></div>
        <div class="muted small">Stock: ${formatNumber(i.stock)} ${escapeHtml(i.unit)} · Mínimo: ${formatNumber(i.minStock)}</div>
        <div class="card-actions">
          <button class="btn btn-sm btn-ghost js-edit" data-id="${i.id}">Editar</button>
          <button class="btn btn-sm btn-danger-ghost js-del" data-id="${i.id}">Eliminar</button>
        </div>
      </div>`).join('') : '<p class="muted empty-state">Aún no hay ingredientes.</p>';

    panel.querySelector('#btnNewIng').addEventListener('click', () => openIngredientModal(null));
    listEl.addEventListener('click', async (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (!id) return;
      if (e.target.closest('.js-edit')) return openIngredientModal(id);
      if (e.target.closest('.js-del')) {
        const ok = await confirmAction('¿Eliminar este ingrediente? Puede afectar recetas existentes.');
        if (!ok) return;
        await KaramRepo.ingredients.remove(id);
        toast('Ingrediente eliminado');
        window.KaramApp.refresh();
      }
    });
  }

  async function openIngredientModal(id) {
    let ing = { name: '', unit: 'g', costPerUnit: 0, stock: 0, minStock: 0 };
    if (id) ing = await KaramRepo.ingredients.get(id);
    const body = `
      <form id="ingForm" class="form">
        <label>Nombre <input type="text" id="ifName" value="${escapeHtml(ing.name)}" required></label>
        <label>Unidad <input type="text" id="ifUnit" value="${escapeHtml(ing.unit)}" placeholder="g, ml, unidad" required></label>
        <label>Costo por unidad <input type="number" id="ifCost" value="${ing.costPerUnit}" min="0" required></label>
        <div class="two-col">
          <label>Stock actual <input type="number" id="ifStock" value="${ing.stock}" min="0"></label>
          <label>Stock mínimo <input type="number" id="ifMin" value="${ing.minStock}" min="0"></label>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Guardar</button>
      </form>`;
    KaramModal.open(id ? 'Editar ingrediente' : 'Nuevo ingrediente', body, {
      onMount: (root) => {
        root.querySelector('#ingForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const data = {
            name: root.querySelector('#ifName').value.trim(),
            unit: root.querySelector('#ifUnit').value.trim(),
            costPerUnit: Number(root.querySelector('#ifCost').value) || 0,
            stock: Number(root.querySelector('#ifStock').value) || 0,
            minStock: Number(root.querySelector('#ifMin').value) || 0,
          };
          if (id) await KaramRepo.ingredients.update(id, data);
          else await KaramRepo.ingredients.create(data);
          KaramModal.close();
          toast('Ingrediente guardado ✅ — costos recalculados');
          window.KaramApp.refresh();
        });
      },
    });
  }
})();
