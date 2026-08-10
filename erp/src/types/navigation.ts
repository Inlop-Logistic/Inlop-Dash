import type { ReactNode } from "react";

// Tipos de navegación compartidos entre AppShell, TopbarSearch y módulos futuros.

export type Vista =
  | "dashboard"
  | "solicitudes"
  | "viajes"
  | "mapa"
  | "alarmas"
  | "vehiculos"
  | "programacion"
  | "cumplidos"
  | "clientes"
  | "configuracion";

export interface NavItem    { id: Vista; label: string; icon: ReactNode; badge?: number }
/** breadcrumbLabel: si está definido, el topbar muestra "[breadcrumbLabel] › [item.label]" en lugar de solo "[item.label]". */
export interface NavSection { id: string; label: string; items: NavItem[]; breadcrumbLabel?: string }
