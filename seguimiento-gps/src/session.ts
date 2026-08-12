/**
 * src/session.ts — Persistencia de la sesión temporal (Fase 10C).
 *
 * Decisión cerrada del prompt de 10C: "No almacenar token, OTP ni datos GPS
 * sensibles en localStorage." Se usa `sessionStorage` (nunca localStorage):
 * sobrevive a un refresh de la pestaña (evita perder la sesión por girar el
 * celular o recargar), pero se borra al cerrar la pestaña/app — nunca
 * persiste entre visitas ni queda en el dispositivo indefinidamente. El
 * OTP en sí NUNCA se guarda en ningún almacenamiento del navegador — solo
 * viaja en memoria durante el submit del formulario.
 *
 * Módulo puro e inyectable (mismo criterio DI que el resto del proyecto):
 * recibe el almacén como parámetro en vez de leer `window.sessionStorage`
 * directamente, para poder probarlo con `node --test` sin DOM.
 */
import type { SesionActiva } from "./types";

export interface AlmacenSesion {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

const CLAVE = "inlop-seguimiento-gps:sesion";

export function guardarSesion(sesion: SesionActiva, almacen: AlmacenSesion): void {
  almacen.setItem(CLAVE, JSON.stringify(sesion));
}

/** Nunca lanza — un valor corrupto/inesperado en el almacén se trata como "sin sesión". */
export function leerSesion(almacen: AlmacenSesion): SesionActiva | null {
  const crudo = almacen.getItem(CLAVE);
  if (!crudo) return null;
  try {
    const datos = JSON.parse(crudo);
    if (typeof datos?.sesionToken !== "string" || typeof datos?.expiraEn !== "string") return null;
    if (typeof datos?.enlaceToken !== "string" || typeof datos?.correo !== "string") return null;
    return datos as SesionActiva;
  } catch {
    return null;
  }
}

export function limpiarSesion(almacen: AlmacenSesion): void {
  almacen.removeItem(CLAVE);
}

/**
 * Solo una guía de UX (mostrar "tu sesión está por vencer" antes de que el
 * backend la rechace) — nunca la fuente de autorización real. El backend
 * (services/gps/sesiones.js#validarSesion) es quien decide si la sesión
 * sigue siendo válida en cada request; esta función nunca debe usarse para
 * "dejar pasar" una llamada a la API.
 */
export function sesionVigente(sesion: SesionActiva | null, ahora: Date = new Date()): boolean {
  if (!sesion) return false;
  const expira = new Date(sesion.expiraEn).getTime();
  return Number.isFinite(expira) && expira > ahora.getTime();
}

/**
 * Sesión guardada, pero SOLO si corresponde al enlace de la URL actual —
 * evita reutilizar por accidente una sesión de OTRO enlace/reporte abierto
 * antes en la misma pestaña (mismo origen → mismo sessionStorage). El
 * backend igual re-autoriza cada request contra la sesión real que sea
 * (nunca es un riesgo de seguridad), pero mostrar el reporte equivocado
 * sería una confusión de producto evitable.
 */
export function leerSesionParaEnlace(enlaceToken: string, almacen: AlmacenSesion): SesionActiva | null {
  const sesion = leerSesion(almacen);
  if (!sesion || sesion.enlaceToken !== enlaceToken) return null;
  return sesionVigente(sesion) ? sesion : null;
}
