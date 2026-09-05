import type { ReactNode } from "react";
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

/** Un ítem de navegación dentro de un subgrupo del sidebar (Sprint 3D-7.11J)
 *  — mismo shape/estilo que NavItem, pero `active`/`onClick` los calcula el
 *  módulo dueño del subgrupo (ConfiguracionPage), no `vista === item.id`
 *  (estos ítems no son Vista de nivel superior, son subVistas internas). */
export interface SidebarSubItem {
  id:      string;
  label:   string;
  icon:    ReactNode;
  active:  boolean;
  onClick: () => void;
}

/** Subgrupo visual dentro de una sección del sidebar (Sprint 3D-7.11J) — ej.
 *  "Seguridad y acceso"/"Parámetros" dentro de la sección "CONFIGURACIÓN".
 *  Puramente de presentación: no crea rutas ni Vista nuevas. */
export interface SidebarGroup {
  label: string;
  items: SidebarSubItem[];
}
