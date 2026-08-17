/**
 * KARAM · views/sales.js — Ventas (generadas automáticamente desde pedidos)
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatDateTime, todayKey, startOfWeek, toCSV, downloadCSV, escapeHtml } = KaramUtils;
  const { salesTotals, sumBy } = KaramCalc;

  window.KaramViews.ventas = async function (main) {
    const allSales = (await KaramRepo.sales.all()).filter((s) => !s.voided).sort((a, b) => new Date(b.date) - new Date(a.date));

    main.innerHTML = `
      <div class="view-header row-between">
        <h1>Ventas</h1>
        <button class="btn btn-ghost btn-sm" id="expCsv">⬇️ CSV</button>
      </div>
      <div class="tabs" id="rangeTabs">
        <button class="tab active" data-r="day">Hoy</button>
        <button class="tab" data-r="week">Semana</button>
        <button class="tab" data-r="month">Mes</button>
        <button class="tab" data-r="all">Todo</button>
      </div>
      <div class="stat-grid" id="salesStats"></div>
      <h3 class="section-title">Por método de pago</h3>
      <div class="card" id="byMethod"></div>
      <h3 class="section-title">Por producto</h3>
      <div class="card" id="byProduct"></div>
      <h3 class="section-title">Detalle</h3>
      <div class="list" id="salesList"></div>
    `;

    let current = allSales;

    function inRange(range) {
      const today = new Date();
      if (range === 'day') return allSales.filter((s) => todayKey(s.date) === todayKey());
      if (range === 'week') { const sw = startOfWeek(today); return allSales.filter((s) => new Date(s.date) >= sw); }
      if (range === 'month') return allSales.filter((s) => { const d = new Date(s.date); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(); });
      return allSales;
    }

    function paint(range) {
      current = inRange(range);
      const t = salesTotals(current);

      main.querySelector('#salesStats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Ventas</div><div class="stat-value">${formatCOP(t.total)}</div></div>
        <div class="stat-card"><div class="stat-label">Costo</div><div class="stat-value">${formatCOP(t.cost)}</div></div>
        <div class="stat-card"><div class="stat-label">Margen</div><div class="stat-value">${formatCOP(t.margin)}<span class="stat-sub">${t.marginPct.toFixed(1)}%</span></div></div>
        <div class="stat-card"><div class="stat-label"># Ventas</div><div class="stat-value">${t.count}</div></div>
      `;

      const byMethod = {};
      current.forEach((s) => { byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] || 0) + s.total; });
      main.querySelector('#byMethod').innerHTML = Object.keys(byMethod).length
        ? Object.entries(byMethod).map(([m, v]) => `<div class="finance-row"><span>${escapeHtml(m)}</span><b>${formatCOP(v)}</b></div>`).join('')
        : '<p class="muted">Sin datos</p>';

      const byProduct = {};
      current.forEach((s) => (s.items || []).forEach((i) => { byProduct[i.name] = byProduct[i.name] || { qty: 0, total: 0 }; byProduct[i.name].qty += i.qty; byProduct[i.name].total += i.lineTotal; }));
      main.querySelector('#byProduct').innerHTML = Object.keys(byProduct).length
        ? Object.entries(byProduct).map(([n, v]) => `<div class="finance-row"><span>${escapeHtml(n)} ×${v.qty}</span><b>${formatCOP(v.total)}</b></div>`).join('')
        : '<p class="muted">Sin datos</p>';

      main.querySelector('#salesList').innerHTML = current.length
        ? current.map((s) => `
          <div class="list-card">
            <div class="row-between"><b>${formatDateTime(s.date)}</b><b>${formatCOP(s.total)}</b></div>
            <div class="muted small">${(s.items || []).map((i) => `${i.qty}× ${escapeHtml(i.name)}`).join(', ')}</div>
            <div class="muted small">Método: ${escapeHtml(s.paymentMethod)} · Costo: ${formatCOP(s.cost)} · Margen: ${formatCOP(s.total - s.cost)}</div>
          </div>`).join('')
        : '<p class="muted empty-state">No hay ventas en este rango.</p>';
    }

    paint('day');
    main.querySelector('#rangeTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      main.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      paint(btn.dataset.r);
    });

    main.querySelector('#expCsv').addEventListener('click', () => {
      const csv = toCSV(current, [
        { label: 'Fecha', value: (r) => formatDateTime(r.date) },
        { label: 'Total', value: 'total' },
        { label: 'Costo', value: 'cost' },
        { label: 'Margen', value: (r) => r.total - r.cost },
        { label: 'Método', value: 'paymentMethod' },
        { label: 'Productos', value: (r) => (r.items || []).map((i) => `${i.qty}x${i.name}`).join(' | ') },
      ]);
      downloadCSV('ventas_karam.csv', csv);
    });
  };
})();
