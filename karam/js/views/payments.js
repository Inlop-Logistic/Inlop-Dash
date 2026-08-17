/**
 * KARAM · views/payments.js — Datos de pago (cuenta bancaria / QR)
 */
window.KaramViews = window.KaramViews || {};

(function () {
  const { toast, escapeHtml } = KaramUtils;

  window.KaramViews.pagos = async function (main) {
    const settings = await KaramRepo.getSettings();
    const pay = settings.payment || {};

    main.innerHTML = `
      <div class="view-header"><h1>Datos de pago</h1><p class="muted">Se muestran al enviar pedidos por WhatsApp.</p></div>
      <form id="payForm" class="form card">
        <label>Número de WhatsApp del negocio <input type="tel" id="payWa" value="${escapeHtml(settings.whatsappNumber || '')}" placeholder="573001234567"></label>
        <label>Banco <input type="text" id="payBank" value="${escapeHtml(pay.bank || '')}"></label>
        <label>Número de cuenta <input type="text" id="payAccount" value="${escapeHtml(pay.accountNumber || '')}"></label>
        <label>Tipo de cuenta
          <select id="payType">
            <option value="ahorros" ${pay.accountType === 'ahorros' ? 'selected' : ''}>Ahorros</option>
            <option value="corriente" ${pay.accountType === 'corriente' ? 'selected' : ''}>Corriente</option>
            <option value="nequi" ${pay.accountType === 'nequi' ? 'selected' : ''}>Nequi / Billetera</option>
          </select>
        </label>
        <label>Titular <input type="text" id="payHolder" value="${escapeHtml(pay.holder || '')}"></label>
        <label>QR de pago (imagen)
          <input type="file" id="payQr" accept="image/*">
        </label>
        <div id="qrPreview">${pay.qrDataUrl ? `<img src="${pay.qrDataUrl}" class="qr-preview">` : ''}</div>
        <button type="submit" class="btn btn-primary btn-block">Guardar</button>
      </form>
    `;

    let qrDataUrl = pay.qrDataUrl || '';
    main.querySelector('#payQr').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        qrDataUrl = reader.result;
        main.querySelector('#qrPreview').innerHTML = `<img src="${qrDataUrl}" class="qr-preview">`;
      };
      reader.readAsDataURL(file);
    });

    main.querySelector('#payForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await KaramRepo.updateSettings({
        whatsappNumber: main.querySelector('#payWa').value.trim(),
        payment: {
          bank: main.querySelector('#payBank').value.trim(),
          accountNumber: main.querySelector('#payAccount').value.trim(),
          accountType: main.querySelector('#payType').value,
          holder: main.querySelector('#payHolder').value.trim(),
          qrDataUrl,
        },
      });
      toast('Datos de pago guardados ✅');
    });
  };
})();
