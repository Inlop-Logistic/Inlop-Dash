/**
 * logout.js — Cierre de sesión
 * INLOP · Integral Logistics Operations
 *
 * USO: Incluir en páginas que tengan botón de logout.
 * Requiere: supabase.js cargado antes.
 *
 * El botón de logout debe tener id="logout-btn" o llamar logout() directamente.
 *
 * Ejemplo en HTML:
 *   <button id="logout-btn">Cerrar sesión</button>
 *
 *   O desde cualquier evento:
 *   <button onclick="logout()">Cerrar sesión</button>
 */

'use strict';

async function logout() {
  try {
    const { sb, config } = window.INLOP;

    // 1. Cerrar sesión en Supabase (invalida el token)
    const { error } = await sb.auth.signOut();
    if (error) {
      console.error('[INLOP Logout] Error al cerrar sesión:', error.message);
    }

  } catch (err) {
    console.error('[INLOP Logout] Error inesperado:', err);
  } finally {
    // 2. Limpiar siempre, sin importar si Supabase respondió o no
    _clearLocalState();

    // 3. Redirigir al login
    window.location.replace(window.INLOP.config.paths.login);
  }
}

function _clearLocalState() {
  const { config } = window.INLOP;

  // Limpiar sessionStorage
  sessionStorage.removeItem(config.sessionKey);

  // Limpiar cualquier otro dato de sesión de la app
  sessionStorage.clear();

  // Nota: Supabase maneja su propio localStorage (sb-*) con signOut()
}

// ─── Inicialización automática del botón ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
});
