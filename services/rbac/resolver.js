/**
 * services/rbac/resolver.js — Motor de resolución de permisos efectivos (Sprint 3D-2)
 *
 * Regla aprobada (Sprint 3C-2 / 3D-2):
 *   permisos_efectivos(usuario) =
 *     UNION(permisos de todos sus roles activos)
 *     + grants individuales
 *     − revokes individuales
 *
 * master es una excepción: acceso total, evaluado ANTES de consultar
 * usuario_permisos — un revoke individual nunca bloquea a master (decisión
 * aprobada Sprint 3C-3/3D-2, sección E). `rbac:gestionar` no tiene fila en
 * rol_permisos para ningún rol — solo alcanzable vía este corto-circuito.
 *
 * profiles.activo = false bloquea TODO, incluido master (decisión G2,
 * Sprint 3D-2) — se verifica antes de cualquier otra cosa.
 *
 * Fail-closed: cualquier error (red, dato inesperado) resuelve a "sin
 * permisos", nunca a "todos los permisos". Mismo criterio que el resto del
 * backend (sbFetch nunca lanza una excepción hacia arriba; aquí tampoco se
 * propaga un error al llamador — se traduce a "sin permisos"/false).
 *
 * Cache por usuario: TTL 30s (decisión G7) — evita recalcular en cada
 * request dentro de una sesión de navegación normal, acotando cuánto tarda
 * en reflejarse un cambio de rol/permiso reciente.
 *
 * Nota de diseño (desviación menor respecto al diseño 3D-2 original): en vez
 * de un JOIN embebido de PostgREST (usuario_roles?select=rol_id,roles!inner(...))
 * para filtrar roles activos en la misma consulta, se hace una consulta plana
 * a usuario_roles y el filtro de "rol activo"/"es master" se resuelve en
 * memoria contra el catálogo ya cacheado (catalogo.js) — cero consultas
 * adicionales a Supabase de todos modos, y compatible con el mock de tests
 * genérico ya existente (services/gps/testStore.js), que no interpreta joins
 * embebidos de PostgREST.
 */
import { obtenerCatalogo } from './catalogo.js';

const TTL_USUARIO_MS = 30 * 1000; // 30 segundos (Sprint 3D-2, decisión G7)
const NOMBRE_ROL_MASTER = 'master';

const cachePorUsuario = new Map(); // profileId -> { ts, resultado }

/** Solo para tests — nunca usar en producción. */
export function _resetResolverParaTests() {
  cachePorUsuario.clear();
}

const VACIO = Object.freeze({ esMaster: false, permisos: new Set() });

async function usuarioActivo(profileId, deps) {
  const { sbFetch } = deps;
  const filas = await sbFetch(`/profiles?id=eq.${encodeURIComponent(profileId)}&select=activo`);
  return filas?.[0]?.activo === true;
}

/**
 * Calcula los permisos efectivos de un usuario, SIN cache (uso interno de
 * tienePermiso(); también reutilizable por un futuro endpoint de solo
 * lectura, ej. GET /api/me/permisos — no creado en este sprint).
 *
 * @param {string|null|undefined} profileId — profiles.id (UUID). Ausente → sin permisos.
 * @param {{sbFetch: Function}} deps
 * @returns {Promise<{esMaster: boolean, permisos: Set<string>}>} — nunca lanza.
 */
export async function calcularPermisosEfectivos(profileId, deps = {}) {
  if (!profileId || typeof deps?.sbFetch !== 'function') return VACIO;
  const { sbFetch } = deps;

  try {
    // profiles.activo = false bloquea TODO, incluido master (decisión G2).
    if (!(await usuarioActivo(profileId, deps))) return VACIO;

    const asignaciones = await sbFetch(
      `/usuario_roles?profile_id=eq.${encodeURIComponent(profileId)}&activo=eq.true&select=rol_id`
    ) || [];
    if (asignaciones.length === 0) return VACIO;

    const catalogo = await obtenerCatalogo(deps);

    // Roles activos en el catálogo — excluye roles desactivados globalmente
    // (roles.activo=false) sin una segunda consulta a Supabase: filtro en
    // memoria contra el catálogo ya cacheado.
    const rolIdsActivos = asignaciones
      .map(a => a.rol_id)
      .filter(rolId => catalogo.rolesPorId.get(rolId)?.activo === true);
    if (rolIdsActivos.length === 0) return VACIO;

    // Master: corta ANTES de consultar usuario_permisos — un revoke individual
    // nunca debe bloquear a master (Sprint 3C-3/3D-2, sección E).
    const esMaster = rolIdsActivos.some(
      rolId => catalogo.rolesPorId.get(rolId)?.nombre?.toLowerCase() === NOMBRE_ROL_MASTER
    );
    if (esMaster) return { esMaster: true, permisos: new Set() };

    const permisoIds = new Set();
    for (const rolId of rolIdsActivos) {
      const permisosDelRol = catalogo.permisosPorRol.get(rolId);
      if (permisosDelRol) for (const pid of permisosDelRol) permisoIds.add(pid);
    }

    const excepciones = await sbFetch(
      `/usuario_permisos?profile_id=eq.${encodeURIComponent(profileId)}&activo=eq.true&select=permiso_id,efecto`
    ) || [];
    // Orden: todos los grants primero, luego todos los revokes — un revoke
    // siempre gana sobre un grant del mismo permiso (defensivo; el UNIQUE
    // (profile_id, permiso_id) de usuario_permisos ya impide que ambos
    // existan simultáneamente para el mismo permiso).
    for (const exc of excepciones) if (exc.efecto === 'grant')  permisoIds.add(exc.permiso_id);
    for (const exc of excepciones) if (exc.efecto === 'revoke') permisoIds.delete(exc.permiso_id);

    const permisos = new Set();
    for (const pid of permisoIds) {
      const nombre = catalogo.permisoNombrePorId.get(pid);
      if (nombre) permisos.add(nombre);
    }
    return { esMaster: false, permisos };
  } catch (e) {
    console.error('[rbac/resolver] calcularPermisosEfectivos error (fail-closed → sin permisos):', e.message);
    return VACIO;
  }
}

/**
 * @param {string|null|undefined} profileId
 * @param {string} permiso — nombre exacto del catálogo (ej. 'clientes:merge:ejecutar').
 * @param {{sbFetch: Function}} deps
 * @returns {Promise<boolean>} — nunca lanza; fail-closed (false) ante cualquier error.
 */
export async function tienePermiso(profileId, permiso, deps = {}) {
  if (!profileId || !permiso) return false;
  try {
    const cacheada = cachePorUsuario.get(profileId);
    let resultado;
    if (cacheada && (Date.now() - cacheada.ts) < TTL_USUARIO_MS) {
      resultado = cacheada.resultado;
    } else {
      resultado = await calcularPermisosEfectivos(profileId, deps);
      cachePorUsuario.set(profileId, { ts: Date.now(), resultado });
    }
    return resultado.esMaster || resultado.permisos.has(permiso);
  } catch (e) {
    console.error('[rbac/resolver] tienePermiso error (fail-closed → false):', e.message);
    return false;
  }
}
