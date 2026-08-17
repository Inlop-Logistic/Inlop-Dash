/**
 * KARAM · views/dashboard.js
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, formatNumber, todayKey } = KaramUtils;
  const { capitalOverview, sumBy } = KaramCalc;

  window.KaramViews.dashboard = async function (main) {
    const [sales, orders, expenses, cashMovements, settings, ingredients] = await Promise.all([
      KaramRepo.sales.all(), KaramRepo.orders.all(), KaramRepo.expenses.all(),
      KaramRepo.cashMovements.all(), KaramRepo.getSettings(), KaramRepo.ingredients.all(),
    ]);

    const today = todayKey();
    const salesToday = sales.filter((s) => todayKey(s.date) === today);
    const ordersToday = orders.filter((o) => todayKey(o.createdAt) === today);
    const expensesToday = expenses.filter((e) => todayKey(e.date) === today);

    const ventasHoy = sumBy(salesToday, (s) => s.total);
    const costoVentasHoy = sumBy(salesToday, (s) => s.cost);
    const margenBruto = ventasHoy - costoVentasHoy;
    const margenPct = ventasHoy > 0 ? (margenBruto / ventasHoy) * 100 : 0;
    const productosVendidos = sumBy(salesToday.flatMap((s) => s.items || []), (i) => i.qty);
    const gastosHoy = sumBy(expensesToday, (e) => e.amount);

    const cap = capitalOverview({ cashMovements, expenses, settings });
    const lowStock = ingredients.filter((i) => Number(i.stock) <= Number(i.minStock || 0));

    const semColor = { green: '#1D8A55', yellow: '#C7A44A', red: '#B3261E' }[cap.semaforo];
    const semLabel = { green: '🟢 Disponible', yellow: '🟡 Precaución', red: '🔴 No retirar' }[cap.semaforo];

    const pctTarget = settings.dailySalesTarget > 0 ? Math.min(100, (ventasHoy / settings.dailySalesTarget) * 100) : 0;

    main.innerHTML = `
      <div class="view-header">
        <h1>Hola 👋</h1>
        <p class="muted">Resumen del día · ${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div class="progress-card card">
        <div class="progress-head">
          <span>Meta diaria</span>
          <span>${formatCOP(ventasHoy)} / ${formatCOP(settings.dailySalesTarget)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pctTarget}%"></div></div>
      </div>

      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Ventas del día</div><div class="stat-value">${formatCOP(ventasHoy)}</div></div>
        <div class="stat-card"><div class="stat-label">Pedidos</div><div class="stat-value">${ordersToday.length}</div></div>
        <div class="stat-card"><div class="stat-label">Productos vendidos</div><div class="stat-value">${formatNumber(productosVendidos)}</div></div>
        <div class="stat-card"><div class="stat-label">Costo de ventas</div><div class="stat-value">${formatCOP(costoVentasHoy)}</div></div>
        <div class="stat-card"><div class="stat-label">Margen bruto</div><div class="stat-value">${formatCOP(margenBruto)}<span class="stat-sub">${margenPct.toFixed(1)}%</span></div></div>
        <div class="stat-card"><div class="stat-label">Gastos del día</div><div class="stat-value">${formatCOP(gastosHoy)}</div></div>
      </div>

      <h3 class="section-title">Salud financiera</h3>
      <div class="finance-card card">
        <div class="finance-row"><span>Caja total</span><b>${formatCOP(cap.cajaTotal)}</b></div>
        <div class="finance-row"><span>Capital protegido</span><b>${formatCOP(cap.capitalProtegido)}</b></div>
        <div class="finance-row"><span>Gastos pendientes</span><b>${formatCOP(cap.gastosPendientes)}</b></div>
        <div class="finance-row"><span>Reserva</span><b>${formatCOP(cap.reserva)}</b></div>
        <div class="finance-row finance-total"><span>Dinero disponible</span><b>${formatCOP(cap.disponible)}</b></div>
        <div class="semaforo" style="--sc:${semColor}">${semLabel}</div>
      </div>

      <h3 class="section-title">Alertas</h3>
      <div class="card alerts-card">
        ${lowStock.length === 0 ? '<p class="muted">Sin alertas de inventario 🎉</p>' :
          lowStock.map((i) => `<div class="alert-row">⚠️ <b>${i.name}</b> bajo mínimo (${formatNumber(i.stock)} ${i.unit} / mín. ${formatNumber(i.minStock)} ${i.unit})</div>`).join('')}
        ${cap.semaforo === 'red' ? '<div class="alert-row alert-danger">🔴 Dinero disponible negativo: evita retiros.</div>' : ''}
        ${cap.gastosPendientes > 0 ? `<div class="alert-row">🧾 Tienes ${formatCOP(cap.gastosPendientes)} en gastos pendientes de pago.</div>` : ''}
      </div>
    `;
  };
})();
