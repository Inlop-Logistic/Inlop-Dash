/**
 * reset-password.js — Actualización de contraseña
 * INLOP · Integral Logistics Operations
 *
 * Requiere: supabase.js cargado antes.
 * Flujo: callback.html captura el token → redirige aquí → usuario pone nueva contraseña.
 *
 * IMPORTANTE: Este script debe estar en reset-password.html,
 * que también debe tener detectSessionInUrl: true en el cliente Supabase
 * (ya configurado en supabase.js).
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
function showSuccess() {
  const box = document.getElementById('err');
  const msg = document.getElementById('err-msg');
  if (!box || !msg) return;
  msg.textContent = 'Contraseña actualizada correctamente. Redirigiendo al login…';
  box.classList.add('show', 'success');
  setTimeout(() => {
    window.location.replace(window.INLOP.config.paths.login);
  }, 2500);
}

// ─── Toggle visibilidad contraseña ────────────────────────────────────────────
function togglePwd(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input) return;
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  if (icon) {
    icon.innerHTML = isText
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  }
}

// ─── Indicador de fuerza de contraseña ────────────────────────────────────────
function checkPasswordStrength(password) {
  const bar   = document.getElementById('strength-bar');
  const label = document.getElementById('strength-label');
  if (!bar || !label) return;

  let score = 0;
  if (password.length >= 8)              score++;
  if (/[A-Z]/.test(password))           score++;
  if (/[0-9]/.test(password))           score++;
  if (/[^A-Za-z0-9]/.test(password))   score++;

  const levels = [
    { pct: '0%',   color: 'transparent', text: '' },
    { pct: '25%',  color: '#c00613',     text: 'Muy débil' },
    { pct: '50%',  color: '#c8973a',     text: 'Débil' },
    { pct: '75%',  color: '#00bcd4',     text: 'Buena' },
    { pct: '100%', color: '#00e676',     text: 'Fuerte' },
  ];

  const level = levels[score] || levels[0];
  bar.style.width           = level.pct;
  bar.style.backgroundColor = level.color;
  label.textContent         = level.text;
  label.style.color         = level.color;
}

// ─── Validar que el token exista en la URL o sesión ───────────────────────────
async function validateResetContext() {
  const { sb, config } = window.INLOP;

  // Supabase v2 con detectSessionInUrl: true procesa automáticamente el hash
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    // Sin sesión → el enlace expiró o es inválido
    showError('El enlace ha expirado o no es válido. Solicita uno nuevo.');
    const btn = document.getElementById('btn');
    if (btn) btn.disabled = true;

    setTimeout(() => {
      window.location.href = `${config.paths.login}`;
    }, 3000);
    return false;
  }
  return true;
}

// ─── Handler del formulario ───────────────────────────────────────────────────
async function handleResetPassword(event) {
  event.preventDefault();

  const newPwd     = document.getElementById('pwd')?.value;
  const confirmPwd = document.getElementById('pwd-confirm')?.value;

  // Validaciones
  if (!newPwd || newPwd.length < 8) {
    showError('La contraseña debe tener al menos 8 caracteres.');
    return;
  }
  if (newPwd !== confirmPwd) {
    showError('Las contraseñas no coinciden.');
    return;
  }
  if (!/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
    showError('La contraseña debe incluir al menos una mayúscula y un número.');
    return;
  }

  setLoading(true);

  try {
    const { sb } = window.INLOP;

    const { error } = await sb.auth.updateUser({ password: newPwd });

    if (error) throw new Error(error.message);

    showSuccess();

  } catch (err) {
    const message = err.message?.includes('same password')
      ? 'La nueva contraseña no puede ser igual a la anterior.'
      : `Error al actualizar: ${err.message}`;
    showError(message);
    setLoading(false);
  }
}

// ─── Inicialización ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Validar contexto de reset
  const valid = await validateResetContext();
  if (!valid) return;

  // Formulario
  const form = document.getElementById('reset-form');
  if (form) {
    form.addEventListener('submit', handleResetPassword);
  }

  // Fuerza de contraseña en tiempo real
  const pwdInput = document.getElementById('pwd');
  if (pwdInput) {
    pwdInput.addEventListener('input', (e) => checkPasswordStrength(e.target.value));
  }

  // Toggle ojos
  document.getElementById('eye-btn-1')?.addEventListener('click', () => togglePwd('pwd', 'eye-ico-1'));
  document.getElementById('eye-btn-2')?.addEventListener('click', () => togglePwd('pwd-confirm', 'eye-ico-2'));
});
