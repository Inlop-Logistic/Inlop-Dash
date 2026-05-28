/**
 * login.js — Lógica del formulario de inicio de sesión
 * INLOP · Integral Logistics Operations
 *
 * Requiere: supabase.js cargado antes
 * Funciones: handleLogin, togglePwd, initLoginPage
 */

'use strict';

// ─── Animación de fondo (canvas) ──────────────────────────────────────────────
function initBackground() {
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pts = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 50; i++) {
    pts.push({
      x:   Math.random() * window.innerWidth,
      y:   Math.random() * window.innerHeight,
      vx:  (Math.random() - 0.5) * 0.2,
      vy:  (Math.random() - 0.5) * 0.2,
      r:   Math.random() * 0.8 + 0.3,
      col: ['#c00613', '#c8973a', '#012A6B'][Math.floor(Math.random() * 3)],
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const q  = pts[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255,255,255,${0.018 * (1 - d / 120)})`;
          ctx.lineWidth = 0.4;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.col + '28';
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ─── Toggle visibilidad contraseña ────────────────────────────────────────────
function togglePwd() {
  const input = document.getElementById('pwd');
  const icon  = document.getElementById('eye-ico');
  const isText = input.type === 'text';

  input.type = isText ? 'password' : 'text';
  icon.innerHTML = isText
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
}

// ─── Mostrar / ocultar error ───────────────────────────────────────────────────
function showError(message) {
  const errBox = document.getElementById('err');
  const errMsg = document.getElementById('err-msg');
  errMsg.textContent = message;
  errBox.classList.add('show');
}

function hideError() {
  document.getElementById('err')?.classList.remove('show');
}

// ─── Estado del botón ─────────────────────────────────────────────────────────
function setLoading(isLoading) {
  const btn = document.getElementById('btn');
  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;
}

// ─── Mostrar pantalla de éxito ────────────────────────────────────────────────
function showSuccess(nombre, rol) {
  const sov = document.getElementById('sov');
  document.getElementById('sov-name').textContent = `¡Bienvenido, ${nombre}!`;
  document.getElementById('sov-sub').textContent  = `${rol.toUpperCase()} · INLOP Control Tower`;
  sov.classList.add('show');
}

// ─── Validación de formulario ─────────────────────────────────────────────────
function validateForm(email, password) {
  if (!email || !email.includes('@')) {
    showError('Ingresa un correo electrónico válido.');
    return false;
  }
  if (!password || password.length < 6) {
    showError('La contraseña debe tener al menos 6 caracteres.');
    return false;
  }
  return true;
}

// ─── Mensajes de error humanizados ────────────────────────────────────────────
function humanizeError(errorMessage) {
  const map = {
    'Invalid login credentials':     'Credenciales incorrectas. Verifica tu correo y contraseña.',
    'Email not confirmed':           'Debes confirmar tu correo antes de ingresar.',
    'Too many requests':             'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
    'User not found':                'No existe una cuenta con ese correo.',
    'Invalid email or password':     'Correo o contraseña incorrectos.',
  };
  for (const [key, value] of Object.entries(map)) {
    if (errorMessage?.includes(key)) return value;
  }
  return errorMessage || 'Error desconocido. Intenta de nuevo.';
}

// ─── Handler principal del formulario ─────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();
  hideError();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('pwd').value;

  if (!validateForm(email, password)) return;

  setLoading(true);

  try {
    const { sb, config } = window.INLOP;

    // 1. Autenticar con Supabase
    const { data: authData, error: authError } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw new Error(authError.message);

    // 2. Obtener perfil del usuario
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('nombre, rol, activo')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('No se pudo obtener el perfil. Contacta al administrador.');
    }

    // 3. Verificar cuenta activa
    if (!profile.activo) {
      await sb.auth.signOut();
      throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
    }

    // 4. Guardar datos en sessionStorage (para compatibilidad con el dashboard)
    sessionStorage.setItem(config.sessionKey, JSON.stringify({
      id:     authData.user.id,
      email,
      nombre: profile.nombre,
      rol:    profile.rol,
    }));

    // 5. Mostrar pantalla de éxito y redirigir
    const nombre = profile.nombre || email.split('@')[0];
    showSuccess(nombre, profile.rol);

    setTimeout(() => {
      window.location.href = config.paths.dashboard;
    }, 2000);

  } catch (err) {
    showError(humanizeError(err.message));
    setLoading(false);
  }
}

// ─── Verificar si ya hay sesión activa (evita mostrar login innecesario) ───────
async function checkExistingSession() {
  try {
    const { sb, config } = window.INLOP;
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      window.location.replace(config.paths.dashboard);
    }
  } catch (err) {
    // Sin sesión activa — mostrar login normalmente
  }
}

// ─── Mostrar mensaje de razón de redirección (ej: cuenta-desactivada) ─────────
function showRedirectReason() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  const messages = {
    'cuenta-desactivada': 'Tu cuenta ha sido desactivada. Contacta al administrador.',
    'sesion-expirada':    'Tu sesión ha expirado. Ingresa de nuevo.',
    'acceso-denegado':    'No tienes permiso para acceder a esa página.',
  };
  if (reason && messages[reason]) {
    showError(messages[reason]);
  }
}

// ─── Inicialización ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initBackground();
  showRedirectReason();
  await checkExistingSession();

  // Conectar el formulario
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', handleLogin);
  }

  // Conectar el toggle de contraseña
  const eyeBtn = document.getElementById('eye-btn');
  if (eyeBtn) {
    eyeBtn.addEventListener('click', togglePwd);
  }
});
