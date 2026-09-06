/**
 * usePermisos — fuente única de permisos del usuario autenticado.
 *
 * Llama a GET /api/me/permisos UNA sola vez por montaje (o al reintentar).
 * No duplica la llamada — cualquier otro punto que necesite permisos debe usar
 * este hook en vez de llamar a `obtenerMisPermisos()` directamente.
 *
 * Política fail-closed (Sprint 3D-7.11K.1.1):
 *   · Mientras carga (`cargando=true`): ítems protegidos ocultos — sin parpadeo
 *     de "aparecen y luego desaparecen".
 *   · Error (`error=true`): ítems protegidos ocultos; `reintentar()` re-dispara
 *     la llamada sin recargar la página.
 *   · Éxito: filtrado RBAC exacto según la lista recibida.
 *   · esMaster=true: sin restricciones (el caller lo verifica antes de filtrar).
 *   · Dashboard / ítems sin permiso requerido: siempre visibles.
 *
 * El filtrado del sidebar es exclusivamente UX progresiva — el backend
 * (requirePermiso()) es el único gate de seguridad real.
 */
import { useState, useEffect, useCallback } from "react";
import { obtenerMisPermisos } from "@/modules/configuracion/services/api";
import type { MisPermisos } from "@/modules/configuracion/types";

export interface UsePermisosResult {
  esMaster: boolean;
  permisos: string[];
  /** true mientras la llamada está en curso — ítems protegidos ocultos. */
  cargando: boolean;
  /** true si la llamada falló — ítems protegidos ocultos hasta reintentar. */
  error: boolean;
  /** Re-dispara GET /api/me/permisos sin recargar la página. */
  reintentar: () => void;
}

export function usePermisos(): UsePermisosResult {
  const [intento, setIntento] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [datos, setDatos] = useState<MisPermisos>({ esMaster: false, permisos: [] });

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(false);
    obtenerMisPermisos()
      .then((res) => {
        if (activo) {
          setDatos(res);
          setCargando(false);
        }
      })
      .catch(() => {
        if (activo) {
          // Fail-closed: ítems protegidos permanecen ocultos hasta que el
          // usuario reintente explícitamente o navegue de nuevo.
          setCargando(false);
          setError(true);
        }
      });
    return () => {
      activo = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  return { esMaster: datos.esMaster, permisos: datos.permisos, cargando, error, reintentar };
}
