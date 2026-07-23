import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Vista } from "@/types/navigation";
import type { ModuloId, NavPayload, NavigationDestination } from "./types";
import { MODULOS_IMPLEMENTADOS } from "./types";

interface NavigationCtxValue {
  /** Vista actualmente renderizada. */
  vista:         Vista;
  /** Contexto operativo entregado por el módulo de origen. null si navegación directa. */
  navPayload:    NavPayload | null;
  /** Módulo desde donde se originó la navegación. */
  originModule:  ModuloId | null;
  /**
   * Navega a otro módulo preservando el contexto operativo.
   * Si el módulo destino no está en MODULOS_IMPLEMENTADOS, es un no-op.
   */
  navigateTo:    (dest: NavigationDestination) => void;
  /**
   * Cambia de vista limpiando el contexto (navegación directa desde el menú).
   */
  setVista:      (v: Vista) => void;
}

const NavigationCtx = createContext<NavigationCtxValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [vista,        setVistaState]   = useState<Vista>("solicitudes");
  const [navPayload,   setNavPayload]   = useState<NavPayload | null>(null);
  const [originModule, setOriginModule] = useState<ModuloId | null>(null);

  const navigateTo = useCallback((dest: NavigationDestination) => {
    if (!MODULOS_IMPLEMENTADOS.has(dest.modulo)) return;
    setNavPayload(dest.payload ?? null);
    setOriginModule(dest.originModule ?? null);
    setVistaState(dest.modulo as Vista);
  }, []);

  const setVista = useCallback((v: Vista) => {
    setNavPayload(null);
    setOriginModule(null);
    setVistaState(v);
  }, []);

  return (
    <NavigationCtx.Provider value={{ vista, navPayload, originModule, navigateTo, setVista }}>
      {children}
    </NavigationCtx.Provider>
  );
}

export function useNavigationContext(): NavigationCtxValue {
  const ctx = useContext(NavigationCtx);
  if (!ctx) throw new Error("useNavigationContext debe usarse dentro de NavigationProvider");
  return ctx;
}
