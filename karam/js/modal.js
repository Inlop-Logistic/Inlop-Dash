/**
 * KARAM · modal.js — helpers de modal genérico y hoja "Más"
 */
(function (global) {
  function openModal(title, bodyHTML, opts) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalRoot').classList.add('open');
    document.getElementById('modalBox').classList.toggle('modal-lg', !!(opts && opts.large));
    if (opts && opts.onMount) opts.onMount(document.getElementById('modalBody'));
  }

  function closeModal() {
    document.getElementById('modalRoot').classList.remove('open');
    document.getElementById('modalBody').innerHTML = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalRoot').addEventListener('click', (e) => {
      if (e.target.id === 'modalRoot') closeModal();
    });
  });

  global.KaramModal = { open: openModal, close: closeModal };
})(window);
