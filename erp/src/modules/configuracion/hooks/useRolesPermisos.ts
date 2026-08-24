import { useState, useEffect, useCallback, useMemo } from "react";
import type { RolRbac, PermisoRbac } from "../types";
import { listarRoles, listarPermisos } from "../services/api";

export type PestanaRolesPermisos = "roles" | "permisos";

/**
 * Estado de Configuración → Parámetros → Roles y Permisos (Sprint 3D-4).
 * Solo lectura: GET /api/roles + GET /api/permisos en paralelo, una sola vez
 * al montar — cambiar de pestaña (Roles ↔ Permisos) NUNCA vuelve a pedirlos,
 * ambas vistas ya tienen todo lo que necesitan en memoria (diseño aprobado,
 * sección D/4).
 */
export function useRolesPermisos() {
  const [roles,    setRoles]    = useState<RolRbac[]>([]);
  const [permisos, setPermisos] = useState<PermisoRbac[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [pestana, setPestana] = useState<PestanaRolesPermisos>("roles");
  const [rolPanelId,     setRolPanelId]     = useState<string | null>(null);
  const [permisoPanelId, setPermisoPanelId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, permisosData] = await Promise.all([listarRoles(), listarPermisos()]);
      setRoles(rolesData);
      setPermisos(permisosData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar roles y permisos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const rolPanel = useMemo(
    () => (rolPanelId ? roles.find(r => r.id === rolPanelId) ?? null : null),
    [rolPanelId, roles]
  );
  const permisoPanel = useMemo(
    () => (permisoPanelId ? permisos.find(p => p.id === permisoPanelId) ?? null : null),
    [permisoPanelId, permisos]
  );

  // Permisos del rol seleccionado, agrupados por módulo — calculado en
  // memoria contra la respuesta ya cargada de /api/permisos (cada permiso ya
  // trae sus roles embebidos). Sin endpoint nuevo — mismo cálculo descrito en
  // el diseño 3D-4 aprobado, sección B.
  const permisosDelRolPanel = useMemo(() => {
    if (!rolPanel) return [];
    return permisos.filter(p => p.roles.some(r => r.id === rolPanel.id));
  }, [rolPanel, permisos]);

  const permisosDelRolPorModulo = useMemo(() => {
    const grupos = new Map<string, PermisoRbac[]>();
    for (const p of permisosDelRolPanel) {
      const key = p.modulo || "otros";
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(p);
    }
    return grupos;
  }, [permisosDelRolPanel]);

  return {
    roles, permisos, loading, error, cargar,
    pestana, setPestana,
    rolPanelId, setRolPanelId, rolPanel, permisosDelRolPanel, permisosDelRolPorModulo,
    permisoPanelId, setPermisoPanelId, permisoPanel,
  };
}
