import type { ReactNode } from "react";

// Tipos de navegación compartidos entre AppShell, TopbarSearch y módulos futuros.

export type Vista =
  | "dashboard"
  | "solicitudes"
  | "viajes"
  | "mapa"
  | "alarmas"
  | "vehiculos"
  | "planeados"
  | "cumplidos";

export interface NavItem    { id: Vista; label: string; icon: ReactNode; badge?: number }
export interface NavSection { id: string; label: string; items: NavItem[] }
