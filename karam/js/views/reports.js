/**
 * KARAM · views/reports.js — Reportes simples + exportación CSV
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatDate, toCSV, downloadCSV, escapeHtml } = KaramUtils;
  const { sumBy } = KaramCalc;

  window.KaramViews.reportes = async function (main) {
    main.innerHTML = `
      <div class="view-header"><h1>Reportes</h1><p class="muted">Exporta cualquier módulo a CSV.</p></div>
      <div class="report-grid" id="reportGrid"></div>
      <h3 class="section-title">Rentabilidad por producto</h3>
      <div class="card" id="repByProduct"></div>
      <h3 class="section-title">Rentabilidad por promoción</h3>
      <div class="card" id="repByPromo"></div>
    `;

    const reports = [
      { key: 'sales', label: 'Ventas', icon: '💰' },
      { key: 'orders', label: 'Pedidos', icon: '🧾' },
      { key: 'purchases', label: 'Compras', icon: '🛒' },
      { key: 'expenses', label: 'Gastos', icon: '💸' },
      { key: 'cash', label: 'Caja', icon: '🏦' },
      { key: 'inventory', label: 'Inventario', icon: '📦' },
    ];
    main.querySelector('#reportGrid').innerHTML = reports.map((r) => `
      <button class="report-tile" data-key="${r.key}">
        <span class="report-icon">${r.icon}</span>
        <span>${r.label}</span>
        <small>Exportar CSV</small>
      </button>`).join('');

    main.querySelector('#reportGrid').addEventListener('click', async (e) => {
      const key = e.target.closest('.report-tile')?.dataset.key;
      if (key) await exportReport(key);
    });

    // Rentabilidad por producto
    const [sales, products, promotions] = await Promise.all([KaramRepo.sales.all(), KaramRepo.products.all(), KaramRepo.promotions.all()]);
    const activeSales = sales.filter((s) => !s.voided);
    const byProduct = {};
    activeSales.forEach((s) => (s.items || []).forEach((i) => {
      byProduct[i.productId] = byProduct[i.productId] || { name: i.name, qty: 0, revenue: 0 };
      byProduct[i.productId].qty += i.qty;
      byProduct[i.productId].revenue += i.lineTotal;
    }));
    main.querySelector('#repByProduct').innerHTML = Object.keys(byProduct).length
      ? Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).map((p) => `<div class="finance-row"><span>${escapeHtml(p.name)} ×${p.qty}</span><b>${formatCOP(p.revenue)}</b></div>`).join('')
      : '<p class="muted">Sin datos aún</p>';

    const byPromo = {};
    activeSales.forEach((s) => (s.items || []).forEach((i) => {
      if (!i.promotionId) return;
      byPromo[i.promotionId] = byPromo[i.promotionId] || { qty: 0, revenue: 0 };
      byPromo[i.promotionId].qty += i.qty;
      byPromo[i.promotionId].revenue += i.lineTotal;
    }));
    const promosById = new Map(promotions.map((p) => [p.id, p]));
    main.querySelector('#repByPromo').innerHTML = Object.keys(byPromo).length
      ? Object.entries(byPromo).map(([id, v]) => `<div class="finance-row"><span>${escapeHtml(promosById.get(id)?.name || id)} ×${v.qty}</span><b>${formatCOP(v.revenue)}</b></div>`).join('')
      : '<p class="muted">Ninguna venta con promoción aplicada aún</p>';
  };

  async function exportReport(key) {
    if (key === 'sales') {
      const rows = (await KaramRepo.sales.all()).filter((s) => !s.voided);
      downloadCSV('reporte_ventas.csv', toCSV(rows, [
        { label: 'Fecha', value: (r) => formatDate(r.date) }, { label: 'Total', value: 'total' },
        { label: 'Costo', value: 'cost' }, { label: 'Margen', value: (r) => r.total - r.cost }, { label: 'Método', value: 'paymentMethod' },
      ]));
    } else if (key === 'orders') {
      const rows = await KaramRepo.orders.all();
      downloadCSV('reporte_pedidos.csv', toCSV(rows, [
        { label: 'Fecha', value: (r) => formatDate(r.createdAt) }, { label: 'Cliente', value: 'customerName' },
        { label: 'Teléfono', value: 'phone' }, { label: 'Total', value: 'total' }, { label: 'Estado', value: 'status' },
      ]));
    } else if (key === 'purchases') {
      const rows = await KaramRepo.purchases.all();
      downloadCSV('reporte_compras.csv', toCSV(rows, [
        { label: 'Fecha', value: (r) => formatDate(r.date) }, { label: 'Proveedor', value: 'supplier' },
        { label: 'Total', value: 'total' }, { label: 'Método', value: 'paymentMethod' },
      ]));
    } else if (key === 'expenses') {
      const rows = await KaramRepo.expenses.all();
      downloadCSV('reporte_gastos.csv', toCSV(rows, [
        { label: 'Fecha', value: (r) => formatDate(r.date) }, { label: 'Categoría', value: 'category' },
        { label: 'Concepto', value: 'concept' }, { label: 'Valor', value: 'amount' }, { label: 'Método', value: 'paymentMethod' },
      ]));
    } else if (key === 'cash') {
      const rows = await KaramRepo.cashMovements.all();
      downloadCSV('reporte_caja.csv', toCSV(rows, [
        { label: 'Fecha', value: (r) => formatDate(r.date) }, { label: 'Tipo', value: 'type' },
        { label: 'Concepto', value: 'concept' }, { label: 'Valor', value: 'amount' }, { label: 'Método', value: 'method' },
      ]));
    } else if (key === 'inventory') {
      const rows = await KaramRepo.ingredients.all();
      downloadCSV('reporte_inventario.csv', toCSV(rows, [
        { label: 'Ingrediente', value: 'name' }, { label: 'Unidad', value: 'unit' },
        { label: 'Costo/u', value: 'costPerUnit' }, { label: 'Stock', value: 'stock' }, { label: 'Mínimo', value: 'minStock' },
      ]));
    }
    KaramUtils.toast('CSV descargado ✅');
  }
})();
