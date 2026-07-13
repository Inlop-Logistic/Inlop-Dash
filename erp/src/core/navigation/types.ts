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
  | "facturacion";

/** Módulos con navegación activa en este build. */
export const MODULOS_IMPLEMENTADOS: ReadonlySet<ModuloId> = new Set<ModuloId>([
  "solicitudes",
  "programacion",
  "viajes",
  "cumplidos",
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
