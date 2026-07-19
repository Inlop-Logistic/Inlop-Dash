// Preference Resolver — Sprint 6.0 (Notification Preferences)
//
// Única fuente de verdad de "qué canales tiene habilitados un usuario".
// El Notification Orchestrator NUNCA contiene lógica de preferencias — solo
// consume el resultado de este módulo vía _resolveChannels().
//
// Modelo opt-out: si no existe fila para un canal, se interpreta como
// habilitado (true). Solo se crea fila cuando el usuario cambia una
// preferencia explícitamente.
//
// Fallback defensivo: cualquier error de consulta retorna todos los canales
// habilitados — una falla del módulo de preferencias nunca debe impedir el
// envío de una notificación (fire-and-forget del Orchestrator se preserva).
//
// DI pattern idéntico al resto del sistema: deps = { sbFetch }.

const KNOWN_CHANNELS = ['push', 'email'];

/**
 * Resuelve qué canales tiene habilitados un usuario.
 *
 * @param {string} usuarioId
 * @param {{ sbFetch: Function }} deps
 * @returns {Promise<string[]>} canales habilitados (subset de KNOWN_CHANNELS)
 */
async function resolveUserChannels(usuarioId, { sbFetch }) {
  try {
    if (!usuarioId) return [...KNOWN_CHANNELS];

    const rows = await sbFetch(
      `/notification_preferences?usuario_id=eq.${encodeURIComponent(usuarioId)}&select=canal,habilitado`
    );

    if (!rows || !rows.length) return [...KNOWN_CHANNELS];

    const disabled = new Set();
    for (const row of rows) {
      if (row.habilitado === false) {
        disabled.add(row.canal);
      }
    }

    return KNOWN_CHANNELS.filter(c => !disabled.has(c));
  } catch (err) {
    console.error('[preferenceResolver] Error consultando preferencias, defaulting a todos los canales:', err.message);
    return [...KNOWN_CHANNELS];
  }
}

/**
 * Obtiene las preferencias completas de un usuario para exposición en API.
 *
 * @param {string} usuarioId
 * @param {{ sbFetch: Function }} deps
 * @returns {Promise<Array<{ canal: string, habilitado: boolean }>>}
 */
async function getUserPreferences(usuarioId, { sbFetch }) {
  const rows = await sbFetch(
    `/notification_preferences?usuario_id=eq.${encodeURIComponent(usuarioId)}&select=canal,habilitado`
  ) || [];

  const prefsMap = new Map();
  for (const row of rows) {
    prefsMap.set(row.canal, row.habilitado);
  }

  return KNOWN_CHANNELS.map(canal => ({
    canal,
    habilitado: prefsMap.has(canal) ? prefsMap.get(canal) : true,
  }));
}

/**
 * Actualiza (upsert) la preferencia de un canal para un usuario.
 *
 * @param {string} usuarioId
 * @param {string} empresaId
 * @param {string} canal
 * @param {boolean} habilitado
 * @param {{ sbFetch: Function }} deps
 * @returns {Promise<boolean>} true si se actualizó correctamente
 */
async function updatePreference(usuarioId, empresaId, canal, habilitado, { sbFetch }) {
  if (!KNOWN_CHANNELS.includes(canal)) return false;

  const result = await sbFetch(
    '/notification_preferences?on_conflict=usuario_id,canal',
    'POST',
    [{
      usuario_id: usuarioId,
      empresa_id: empresaId,
      canal,
      habilitado,
      updated_at: new Date().toISOString(),
    }]
  );

  return Boolean(result);
}

export { KNOWN_CHANNELS, resolveUserChannels, getUserPreferences, updatePreference };
