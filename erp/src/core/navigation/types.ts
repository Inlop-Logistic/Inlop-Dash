import type { Vista } from "@/types/navigation";

/**
 * Superset de Vista que incluye módulos planificados no enrutables aún.
 * NavigationDestination usa ModuloId; navigateTo() solo ejecuta si el módulo
 * está en MODULOS_IMPLEMENTADOS — los demás quedan deshabilitados en la UI.
 */
export type ModuloId =
  | Vista
  | "gps"
  | "conductores"
  | "clientes"
  | "facturacion"
  | "configuracion";

/** Módulos con navegación activa en este build. */
export const MODULOS_IMPLEMENTADOS: ReadonlySet<ModuloId> = new Set<ModuloId>([
  "solicitudes",
  "programacion",
  "viajes",
  "cumplidos",
  "mapa",
  "clientes",
  "configuracion",
]);

/** Contexto operativo que se transporta entre módulos. */
export interface NavPayload {
  tripNumber?:      string;
  programacionId?:  string;
  solicitudId?:     string;
  licensePlate?:    string;
  driverId?:        string;
  clienteId?:       string;
  remision?:        string;
  /**
   * Sub-pantalla inicial a abrir dentro de Configuración (Sprint 3D-7.11J.2)
   * — permite que los ítems fijos del sidebar (Usuarios/Roles/Parámetros)
   * naveguen directamente a la sub-pantalla correcta sin depender de que
   * ConfiguracionPage ya esté montada (ver ConfiguracionPage.tsx).
   */
  configSubVista?:  "usuarios" | "roles-permisos" | "parametros";
}

/** Destino de navegación contextual. */
export interface NavigationDestination {
  modulo:        ModuloId;
  payload?:      NavPayload;
  originModule?: ModuloId;
}

/** Un tramo del breadcrumb superior de AppShell (Sprint 3D-7.11F). Sin
 *  `onClick` = ubicación actual (no navegable), como el último tramo de
 *  cualquier breadcrumb. */
export interface BreadcrumbItem {
  label:    string;
  onClick?: () => void;
}
