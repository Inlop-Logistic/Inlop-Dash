/**
 * forgot-password.js — Solicitud de recuperación de contraseña
 * INLOP · Integral Logistics Operations
 *
 * Requiere: supabase.js cargado antes.
 * Flujo: usuario ingresa email → Supabase envía correo → usuario hace clic → callback.html → reset-password.html
 */

'use strict';

// ─── Estado del botón ─────────────────────────────────────────────────────────
function setLoading(isLoading) {
  const btn = document.getElementById('btn');
  if (!btn) return;
  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;
}

// ─── Mostrar error ─────────────────────────────────────────────────────────────
function showError(message) {
  const box = document.getElementById('err');
  const msg = document.getElementById('err-msg');
  if (!box || !msg) return;
  msg.textContent = message;
  box.classList.remove('success');
  box.classList.add('show');
}

// ─── Mostrar éxito ─────────────────────────────────────────────────────────────
function showSuccess(email) {
  const box = document.getElementById('err');
  const msg = document.getElementById('err-msg');
  if (!box || !msg) return;
  msg.textContent = `Correo enviado a ${email}. Revisa tu bandeja de entrada (y spam).`;
  box.classList.add('show', 'success');

  // Deshabilitar el formulario después del éxito
  const input = document.getElementById('email');
  if (input) input.disabled = true;
  setLoading(false);
  const btn = document.getElementById('btn');
  if (btn) btn.disabled = true;
}

// ─── Handler del formulario ───────────────────────────────────────────────────
async function handleForgotPassword(event) {
  event.preventDefault();

  const email = document.getElementById('email')?.value.trim();

  if (!email || !email.includes('@')) {
    showError('Ingresa un correo electrónico válido.');
    return;
  }

  setLoading(true);

  try {
    const { sb, config } = window.INLOP;

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `https://inloplogistica.com${config.paths.resetPassword}`,
    });

    if (error) throw new Error(error.message);

    showSuccess(email);

  } catch (err) {
    const message = err.message?.includes('rate limit')
      ? 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.'
      : 'No se pudo enviar el correo. Verifica que el email esté registrado.';
    showError(message);
    setLoading(false);
  }
}

// ─── Inicialización ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgot-form');
  if (form) {
    form.addEventListener('submit', handleForgotPassword);
  }
});
