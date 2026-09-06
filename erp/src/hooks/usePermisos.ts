/**
 * usePermisos — fuente única de permisos del usuario autenticado (Sprint 3D-7.11K.1).
 *
 * Llama a GET /api/me/permisos UNA sola vez por montaje del componente que lo
 * consume. No duplica la llamada — cualquier otro punto que necesite permisos
 * debe usar este hook (o el resultado ya propagado) en vez de llamar a
 * `obtenerMisPermisos()` directamente.
 *
 * Política fail-open: mientras la llamada está en curso O si falla, `cargando`
 * queda en `true`. El caller debe interpretar `cargando === true` como "sin
 * restricciones" — todos los ítems del sidebar permanecen visibles. Esto es
 * intencional: el filtrado del sidebar es pura UX progresiva; el backend
 * (requirePermiso()) es el único gate de seguridad real.
 */
import { useState, useEffect } from "react";
import { obtenerMisPermisos } from "@/modules/configuracion/services/api";
import type { MisPermisos } from "@/modules/configuracion/types";

export interface UsePermisosResult {
  esMaster: boolean;
  permisos: string[];
  /**
   * `true` mientras la llamada está en curso O si falló.
   * En ambos casos el caller debe tratar el estado como fail-open (mostrar
   * todos los ítems del sidebar sin filtrar).
   */
  cargando: boolean;
}

export function usePermisos(): UsePermisosResult {
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState<MisPermisos>({ esMaster: false, permisos: [] });

  useEffect(() => {
    let activo = true;
    obtenerMisPermisos()
      .then((res) => {
        if (activo) {
          setDatos(res);
          setCargando(false);
        }
      })
      .catch(() => {
        // Fail-open: no cambiar `cargando` → sidebar permanece sin filtrar.
        // No es un error silencioso: la API ya registra el error en su capa;
        // aquí solo preservamos el comportamiento seguro para el usuario.
      });
    return () => {
      activo = false;
    };
  }, []);

  return { esMaster: datos.esMaster, permisos: datos.permisos, cargando };
}
