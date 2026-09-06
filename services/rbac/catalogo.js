/**
 * services/rbac/catalogo.js — Cache en memoria del catálogo RBAC (Sprint 3D-2)
 *
 * roles/permisos/rol_permisos cambian con muy poca frecuencia (solo cuando un
 * administrador edita el catálogo RBAC) — cachearlos evita una consulta a
 * Supabase por cada resolución de permisos de cada usuario. Mismo patrón ya
 * usado en el resto del backend (cache.viajes + CACHE_TTL, index.js): Map en
 * memoria + timestamp, sin dependencias nuevas.
 *
 * Sin lógica de negocio aquí: solo carga y expone las 3 tablas base en forma
 * de Maps listos para consulta O(1). La regla de permisos efectivos (unión de
 * roles, grants, revokes, master) vive en resolver.js — este módulo no sabe
 * nada de usuarios ni de permisos "efectivos".
 */

const TTL_CATALOGO_MS = 5 * 60 * 1000; // 5 minutos (Sprint 3D-2, decisión G7)

let cache = null; // { ts, datos: { rolesPorId, permisoNombrePorId, permisosPorRol } }

/** Solo para tests — nunca usar en producción. */
export function _resetCatalogoParaTests() {
  cache = null;
}

function vigente() {
  return cache !== null && (Date.now() - cache.ts) < TTL_CATALOGO_MS;
}

async function cargarCatalogo(deps) {
  const { sbFetch } = deps;
  const [rolesRaw, permisosRaw, rolPermisosRaw] = await Promise.all([
    sbFetch('/roles?select=id,nombre,activo'),
    sbFetch('/permisos?select=id,nombre'),
    sbFetch('/rol_permisos?select=rol_id,permiso_id'),
  ]);
  const roles       = rolesRaw       || [];
  const permisos    = permisosRaw    || [];
  const rolPermisos = rolPermisosRaw || [];

  const rolesPorId = new Map(
    roles.map(r => [r.id, { nombre: r.nombre, activo: r.activo === true }])
  );
  const permisoNombrePorId = new Map(permisos.map(p => [p.id, p.nombre]));

  const permisosPorRol = new Map();
  for (const rp of rolPermisos) {
    if (!permisosPorRol.has(rp.rol_id)) permisosPorRol.set(rp.rol_id, new Set());
    permisosPorRol.get(rp.rol_id).add(rp.permiso_id);
  }

  return { rolesPorId, permisoNombrePorId, permisosPorRol };
}

/**
 * Devuelve el catálogo RBAC cacheado (roles/permisos/rol_permisos), refrescando
 * desde Supabase solo si el cache expiró (TTL 5 min) o nunca se cargó.
 *
 * @param {{sbFetch: Function}} deps
 * @returns {Promise<{
 *   rolesPorId: Map<string, {nombre: string, activo: boolean}>,
 *   permisoNombrePorId: Map<string, string>,
 *   permisosPorRol: Map<string, Set<string>>,
 * }>}
 */
export async function obtenerCatalogo(deps) {
  if (vigente()) return cache.datos;
  const datos = await cargarCatalogo(deps);
  cache = { ts: Date.now(), datos };
  return datos;
}

/**
 * Invalidación explícita de uso en producción (Sprint 3D-7.1) — para que un
 * futuro endpoint de escritura sobre `rol_permisos`/`roles`/`permisos` no
 * tenga que esperar hasta 5 minutos (TTL_CATALOGO_MS) a que el cambio se
 * refleje. La próxima llamada a obtenerCatalogo() recarga desde Supabase.
 *
 * Distinta de _resetCatalogoParaTests() a propósito — esa sigue siendo
 * exclusiva de tests (aislamiento entre casos); esta es la que un endpoint
 * de escritura real invocaría. Misma operación internamente, pero se
 * mantienen separadas para no acoplar el código de producción a un helper
 * pensado solo para limpiar estado entre tests.
 *
 * Segura de llamar con el cache ya vacío (no-op).
 */
export function invalidarCatalogo() {
  cache = null;
}
