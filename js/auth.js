/**
 * auth.js — Protección de rutas para páginas privadas
 * INLOP · Integral Logistics Operations
 *
 * USO: Añade este script en TODAS las páginas privadas (dashboard, etc.)
 * SIEMPRE después de supabase.js:
 *
 *   <script src="/app/js/supabase.js"></script>
 *   <script src="/app/js/auth.js"></script>
 *
 * Si no hay sesión activa → redirige al login automáticamente.
 * Si hay sesión → expone window.INLOP.currentUser con datos del usuario.
 */

'use strict';

(async function guardRoute() {
  const { sb, config } = window.INLOP;

  try {
    // 1. Verificar sesión activa con Supabase
    const { data: { session }, error } = await sb.auth.getSession();

    if (error || !session) {
      _redirectToLogin();
      return;
    }

    // 2. Obtener perfil del usuario desde la tabla profiles
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('nombre, rol, activo')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      console.error('[INLOP Auth] Error al obtener perfil:', profileError?.message);
      _redirectToLogin();
      return;
    }

    // 3. Verificar cuenta activa
    if (!profile.activo) {
      await sb.auth.signOut();
      _redirectToLogin('cuenta-desactivada');
      return;
    }

    // 4. Exponer datos del usuario a la página
    window.INLOP.currentUser = {
      id:     session.user.id,
      email:  session.user.email,
      nombre: profile.nombre,
      rol:    profile.rol,
    };

    // 5. Sincronizar sessionStorage (por compatibilidad con código existente)
    sessionStorage.setItem(
      config.sessionKey,
      JSON.stringify(window.INLOP.currentUser)
    );

    // 6. Emitir evento para que la página sepa que el usuario está listo
    // IMPORTANTE: guardar el detail antes del dispatch para manejar la race
    // condition en la que el evento se dispara antes de que DOMContentLoaded
    // haya registrado el listener (ocurre con token Supabase en caché ~0ms).
    // Los módulos comprueban window.INLOP._userReadyDetail en DOMContentLoaded.
    window.INLOP._userReadyDetail = window.INLOP.currentUser;

    document.dispatchEvent(new CustomEvent('inlop:userReady', {
      detail: window.INLOP.currentUser
    }));

  } catch (err) {
    console.error('[INLOP Auth] Error inesperado:', err);
    _redirectToLogin();
  }

  // 7. Escuchar cambios de sesión (expiración, logout desde otra pestaña)
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem(config.sessionKey);
        _redirectToLogin();
      }
    }
  });

  function _redirectToLogin(reason = '') {
    const url = reason
      ? `${config.paths.login}?reason=${reason}`
      : config.paths.login;
    window.location.replace(url);
  }
})();
