/**
 * services/rbac/middleware.js — requirePermiso() (Sprint 3D-2)
 *
 * Middleware Express que se compone DESPUÉS de requireErpAuth — nunca lo
 * reemplaza ni verifica identidad por su cuenta. requireErpAuth NO se
 * modifica por este módulo, ni en este sprint ni en los siguientes.
 *
 * Fail-closed (decisión G1, Sprint 3D-2): si no hay req.erpUserId (JWT
 * verificado por requireErpAuth), responde 403 de inmediato — la ruta de
 * compatibilidad por X-Internal-Api-Key (sin identidad verificada) NO
 * obtiene bypass de RBAC.
 *
 * `deps` se recibe explícito (no se importa sbFetch de index.js) — mismo
 * patrón de inyección de dependencias que el resto de services/*, para
 * mantener este módulo testeable sin un servidor Express real.
 *
 * NO se aplica a ningún endpoint existente en este sprint — queda listo
 * para que un sprint posterior lo componga en rutas puntuales:
 *   app.delete('/api/x', requireErpAuth, requirePermiso('modulo:accion', { sbFetch }), handler)
 */
import { tienePermiso } from './resolver.js';

/**
 * @param {string} permiso — nombre exacto del catálogo.
 * @param {{sbFetch: Function}} deps — inyectado por el llamador (index.js).
 * @returns {import('express').RequestHandler}
 */
export function requirePermiso(permiso, deps) {
  return async function requirePermisoMiddleware(req, res, next) {
    if (!req.erpUserId) {
      return res.status(403).json({ error: 'Identidad verificada requerida (JWT)', permiso });
    }
    const ok = await tienePermiso(req.erpUserId, permiso, deps);
    if (!ok) {
      return res.status(403).json({ error: 'Permiso insuficiente', permiso });
    }
    next();
  };
}
