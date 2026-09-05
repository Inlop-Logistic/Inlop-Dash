import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Vista } from "@/types/navigation";
import type { BreadcrumbItem, ModuloId, NavPayload, NavigationDestination, SidebarGroup } from "./types";
import { MODULOS_IMPLEMENTADOS } from "./types";

interface NavigationCtxValue {
  /** Vista actualmente renderizada. */
  vista:         Vista;
  /** Contexto operativo entregado por el módulo de origen. null si navegación directa. */
  navPayload:    NavPayload | null;
  /** Módulo desde donde se originó la navegación. */
  originModule:  ModuloId | null;
  /**
   * Tramo de breadcrumb adicional que un módulo puede declarar para sus
   * propias sub-pantallas internas (Sprint 3D-7.11F) — ej. Configuración →
   * Usuarios → Gestión de permisos. `null` = AppShell usa su breadcrumb por
   * defecto (INLOP › [sección] › [ítem de nav actual]). Un módulo lo declara
   * con `setBreadcrumbTrail` mientras esté montado y lo limpia (null) al
   * desmontarse, para no dejarlo pegado en otro módulo.
   */
  breadcrumbTrail: BreadcrumbItem[] | null;
  /**
   * Subgrupos del sidebar que reemplazan los ítems planos de la sección
   * "CONFIGURACIÓN" (Sprint 3D-7.11J) — ej. "Seguridad y acceso"/"Parámetros"
   * con sus propios ítems (Usuarios/Roles/Parámetros). `null` = AppShell usa
   * la lista plana de ítems por defecto de esa sección. Mismo ciclo de vida
   * que `breadcrumbTrail`: el módulo dueño lo declara mientras esté montado y
   * lo limpia (null) al desmontarse.
   */
  sidebarGroups: SidebarGroup[] | null;
  /**
   * Navega a otro módulo preservando el contexto operativo.
   * Si el módulo destino no está en MODULOS_IMPLEMENTADOS, es un no-op.
   */
  navigateTo:    (dest: NavigationDestination) => void;
  /**
   * Cambia de vista limpiando el contexto (navegación directa desde el menú).
   */
  setVista:      (v: Vista) => void;
  setBreadcrumbTrail: (trail: BreadcrumbItem[] | null) => void;
  setSidebarGroups:   (groups: SidebarGroup[] | null) => void;
}

const NavigationCtx = createContext<NavigationCtxValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [vista,           setVistaState]        = useState<Vista>("solicitudes");
  const [navPayload,      setNavPayload]        = useState<NavPayload | null>(null);
  const [originModule,    setOriginModule]      = useState<ModuloId | null>(null);
  const [breadcrumbTrail, setBreadcrumbTrail]   = useState<BreadcrumbItem[] | null>(null);
  const [sidebarGroups,   setSidebarGroups]     = useState<SidebarGroup[] | null>(null);

  const navigateTo = useCallback((dest: NavigationDestination) => {
    if (!MODULOS_IMPLEMENTADOS.has(dest.modulo)) return;
    setNavPayload(dest.payload ?? null);
    setOriginModule(dest.originModule ?? null);
    setBreadcrumbTrail(null);
    setSidebarGroups(null);
    setVistaState(dest.modulo as Vista);
  }, []);

  const setVista = useCallback((v: Vista) => {
    setNavPayload(null);
    setOriginModule(null);
    setBreadcrumbTrail(null);
    setSidebarGroups(null);
    setVistaState(v);
  }, []);

  return (
    <NavigationCtx.Provider value={{
      vista, navPayload, originModule, breadcrumbTrail, sidebarGroups,
      navigateTo, setVista, setBreadcrumbTrail, setSidebarGroups,
    }}>
      {children}
    </NavigationCtx.Provider>
  );
}

export function useNavigationContext(): NavigationCtxValue {
  const ctx = useContext(NavigationCtx);
  if (!ctx) throw new Error("useNavigationContext debe usarse dentro de NavigationProvider");
  return ctx;
}
