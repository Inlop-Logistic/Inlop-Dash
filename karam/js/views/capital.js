/**
 * KARAM · views/capital.js — Capital del negocio y semáforo de disponibilidad
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { formatCOP, toast } = KaramUtils;
  const { capitalOverview } = KaramCalc;

  window.KaramViews.capital = async function (main) {
    const [cashMovements, expenses, settings] = await Promise.all([
      KaramRepo.cashMovements.all(), KaramRepo.expenses.all(), KaramRepo.getSettings(),
    ]);
    const cap = capitalOverview({ cashMovements, expenses, settings });
    const semColor = { green: '#1D8A55', yellow: '#C7A44A', red: '#B3261E' }[cap.semaforo];
    const semLabel = { green: '🟢 Disponible', yellow: '🟡 Precaución', red: '🔴 No retirar' }[cap.semaforo];

    main.innerHTML = `
      <div class="view-header"><h1>Capital del negocio</h1>
        <p class="muted">Caja total ≠ utilidad ≠ dinero disponible. Aquí se separan.</p></div>

      <div class="finance-card card">
        <div class="finance-row"><span>Caja total</span><b>${formatCOP(cap.cajaTotal)}</b></div>
        <div class="finance-row"><span>− Capital protegido para producción</span><b>${formatCOP(cap.capitalProtegido)}</b></div>
        <div class="finance-row"><span>− Gastos pendientes</span><b>${formatCOP(cap.gastosPendientes)}</b></div>
        <div class="finance-row"><span>− Reserva</span><b>${formatCOP(cap.reserva)}</b></div>
        <div class="finance-row finance-total"><span>= Dinero disponible</span><b>${formatCOP(cap.disponible)}</b></div>
        <div class="semaforo" style="--sc:${semColor}">${semLabel}</div>
      </div>

      <h3 class="section-title">Configuración</h3>
      <form id="capForm" class="form card">
        <label>Capital mínimo protegido para producción
          <input type="number" id="cfCapital" value="${settings.capitalProtected}" min="0">
        </label>
        <label>Reserva
          <input type="number" id="cfReserve" value="${settings.reserveAmount}" min="0">
        </label>
        <button type="submit" class="btn btn-primary btn-block">Guardar configuración</button>
      </form>
    `;

    main.querySelector('#capForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await KaramRepo.updateSettings({
        capitalProtected: Number(main.querySelector('#cfCapital').value) || 0,
        reserveAmount: Number(main.querySelector('#cfReserve').value) || 0,
      });
      toast('Configuración de capital guardada ✅');
      window.KaramApp.refresh();
    });
  };
})();
