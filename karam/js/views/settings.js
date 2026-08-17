/**
 * KARAM · views/settings.js — Configuración general y cuenta
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { toast, escapeHtml, DAY_NAMES } = KaramUtils;

  window.KaramViews.configuracion = async function (main) {
    const settings = await KaramRepo.getSettings();
    const session = KaramAuth.getSession();

    main.innerHTML = `
      <div class="view-header"><h1>Configuración</h1></div>

      <form id="genForm" class="form card">
        <h4>Negocio y datos iniciales</h4>
        <label>Nombre del negocio <input type="text" id="sfName" value="${escapeHtml(settings.businessName)}"></label>
        <div class="two-col">
          <label>Precio normal <input type="number" id="sfPrice" value="${settings.priceNormal}" min="0"></label>
          <label>Precio promoción <input type="number" id="sfPromo" value="${settings.pricePromo}" min="0"></label>
        </div>
        <div class="two-col">
          <label>Cantidad promo (ej: 2×1) <input type="number" id="sfPromoQty" value="${settings.promoQty}" min="1"></label>
          <label>Costo aprox. por producto <input type="number" id="sfCost" value="${settings.costPerProduct}" min="0"></label>
        </div>
        <label>Venta promedio diaria objetivo <input type="number" id="sfTarget" value="${settings.dailySalesTarget}" min="0"></label>
        <label>Días de operación</label>
        <div class="chip-row">
          ${DAY_NAMES.map((n, i) => `<label class="day-chip"><input type="checkbox" class="opDay" value="${i}" ${settings.operatingDays?.includes(i) ? 'checked' : ''}> ${n.slice(0, 3)}</label>`).join('')}
        </div>
        <label>Días de promoción por defecto</label>
        <div class="chip-row">
          ${DAY_NAMES.map((n, i) => `<label class="day-chip"><input type="checkbox" class="promoDay" value="${i}" ${settings.promoDays?.includes(i) ? 'checked' : ''}> ${n.slice(0, 3)}</label>`).join('')}
        </div>
        <button type="submit" class="btn btn-primary btn-block">Guardar</button>
      </form>

      <form id="pwdForm" class="form card">
        <h4>Cambiar contraseña</h4>
        <label>Nueva contraseña <input type="password" id="pwNew" minlength="4" required></label>
        <label>Confirmar contraseña <input type="password" id="pwConfirm" minlength="4" required></label>
        <div class="form-error" id="pwError" hidden></div>
        <button type="submit" class="btn btn-primary btn-block">Actualizar contraseña</button>
      </form>

      <div class="card">
        <h4>Acerca de</h4>
        <p class="muted small">KARAM · Panel administrativo V1 — PWA local, funciona sin conexión. Datos guardados en este dispositivo (IndexedDB).</p>
      </div>
    `;

    main.querySelector('#genForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const operatingDays = [...main.querySelectorAll('.opDay:checked')].map((c) => Number(c.value));
      const promoDays = [...main.querySelectorAll('.promoDay:checked')].map((c) => Number(c.value));
      await KaramRepo.updateSettings({
        businessName: main.querySelector('#sfName').value.trim(),
        priceNormal: Number(main.querySelector('#sfPrice').value) || 0,
        pricePromo: Number(main.querySelector('#sfPromo').value) || 0,
        promoQty: Number(main.querySelector('#sfPromoQty').value) || 1,
        costPerProduct: Number(main.querySelector('#sfCost').value) || 0,
        dailySalesTarget: Number(main.querySelector('#sfTarget').value) || 0,
        operatingDays, promoDays,
      });
      toast('Configuración guardada ✅');
      window.KaramApp.refresh();
    });

    main.querySelector('#pwdForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = main.querySelector('#pwError');
      const p1 = main.querySelector('#pwNew').value;
      const p2 = main.querySelector('#pwConfirm').value;
      if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden'; errEl.hidden = false; return; }
      await KaramAuth.changePassword(session.userId, p1);
      errEl.hidden = true;
      toast('Contraseña actualizada ✅');
      main.querySelector('#pwdForm').reset();
    });
  };
})();
