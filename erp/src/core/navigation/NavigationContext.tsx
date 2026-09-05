import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Vista } from "@/types/navigation";
import type { BreadcrumbItem, ModuloId, NavPayload, NavigationDestination } from "./types";
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
   * Ítem del sidebar de Configuración actualmente activo (Sprint 3D-7.11J.2)
   * — "usuarios" | "roles-permisos" | "parametros", o `null` si Configuración
   * no está montada. Los 3 ítems del sidebar ("Usuarios", "Roles",
   * "Parámetros") son fijos y siempre visibles (declarados en AppShell, no
   * dependen de este valor para *aparecer*); esto solo decide cuál se ve
   * resaltado como activo. Mismo ciclo de vida que `breadcrumbTrail`:
   * ConfiguracionPage lo declara mientras esté montada y lo limpia (null) al
   * desmontarse.
   */
  configActiveItem: "usuarios" | "roles-permisos" | "parametros" | null;
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
  setConfigActiveItem: (item: "usuarios" | "roles-permisos" | "parametros" | null) => void;
}

const NavigationCtx = createContext<NavigationCtxValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [vista,           setVistaState]        = useState<Vista>("solicitudes");
  const [navPayload,      setNavPayload]        = useState<NavPayload | null>(null);
  const [originModule,    setOriginModule]      = useState<ModuloId | null>(null);
  const [breadcrumbTrail, setBreadcrumbTrail]   = useState<BreadcrumbItem[] | null>(null);
  const [configActiveItem, setConfigActiveItem] = useState<"usuarios" | "roles-permisos" | "parametros" | null>(null);

  const navigateTo = useCallback((dest: NavigationDestination) => {
    if (!MODULOS_IMPLEMENTADOS.has(dest.modulo)) return;
    setNavPayload(dest.payload ?? null);
    setOriginModule(dest.originModule ?? null);
    setBreadcrumbTrail(null);
    if (dest.modulo !== "configuracion") setConfigActiveItem(null);
    setVistaState(dest.modulo as Vista);
  }, []);

  const setVista = useCallback((v: Vista) => {
    setNavPayload(null);
    setOriginModule(null);
    setBreadcrumbTrail(null);
    setConfigActiveItem(null);
    setVistaState(v);
  }, []);

  return (
    <NavigationCtx.Provider value={{
      vista, navPayload, originModule, breadcrumbTrail, configActiveItem,
      navigateTo, setVista, setBreadcrumbTrail, setConfigActiveItem,
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
