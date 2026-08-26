import { useState, useEffect, useCallback, useMemo } from "react";
import type { RolRbac, PermisoRbac } from "../types";
import { listarRoles, listarPermisos, actualizarPermisosRol, obtenerMisPermisos } from "../services/api";

export type PestanaRolesPermisos = "roles" | "permisos";

const NOMBRE_ROL_MASTER          = "master";
const NOMBRE_PERMISO_GESTIONAR   = "rbac:gestionar";

/**
 * Estado de Configuración → Parámetros → Roles y Permisos (Sprint 3D-4;
 * edición de permisos por rol agregada en Sprint 3D-7.5).
 *
 * Lectura: GET /api/roles + GET /api/permisos en paralelo, una sola vez al
 * montar — cambiar de pestaña (Roles ↔ Permisos) NUNCA vuelve a pedirlos.
 *
 * Escritura: PUT /api/roles/:id/permisos (Sprint 3D-7.3) — único endpoint
 * usado para guardar, con el conjunto COMPLETO de permisos deseado; el
 * estado local (`permisos`) se actualiza con la respuesta del backend, sin
 * volver a pedir /api/roles ni /api/permisos completos. Edición disponible
 * únicamente desde el panel de rol (la pestaña Permisos permanece de solo
 * lectura — ver diseño 3D-7.5, sección 4: "prioridad edición desde el
 * SidePanel del rol, no duplicar lógica").
 */
export function useRolesPermisos() {
  const [roles,    setRoles]    = useState<RolRbac[]>([]);
  const [permisos, setPermisos] = useState<PermisoRbac[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [pestana, setPestana] = useState<PestanaRolesPermisos>("roles");
  const [rolPanelId,     setRolPanelId]     = useState<string | null>(null);
  const [permisoPanelId, setPermisoPanelId] = useState<string | null>(null);

  // Progressive disclosure de los controles de edición (Sprint 3D-7.5) —
  // mismo criterio fail-open que ParametrosPage/UsuariosPage: NUNCA un
  // mecanismo de seguridad, solo evita ofrecer "Editar" a quien de todos
  // modos recibiría 403 al guardar. La autoridad real vive en el backend
  // (requirePermiso('rbac:gestionar') + guard esMaster en
  // PUT /api/roles/:id/permisos, Sprint 3D-7.3). `esMaster` se usa además
  // para la confirmación reforzada al tocar rbac:gestionar.
  const [puedeEditarRoles, setPuedeEditarRoles] = useState(true);
  const [esMaster,         setEsMaster]         = useState(false);

  // ── Edición de permisos del rol abierto en el panel ─────────────────────
  const [editandoRol,           setEditandoRol]           = useState(false);
  const [seleccionPermisos,     setSeleccionPermisos]     = useState<Set<string>>(new Set());
  const [guardandoPermisos,     setGuardandoPermisos]     = useState(false);
  const [errorGuardadoPermisos, setErrorGuardadoPermisos] = useState<string | null>(null);
  const [exitoPermisos,         setExitoPermisos]         = useState(false);
  // true mientras se muestra la confirmación reforzada (agregar/quitar rbac:gestionar).
  const [confirmarGestionar, setConfirmarGestionar] = useState(false);

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

  useEffect(() => {
    let activo = true;
    obtenerMisPermisos()
      .then((r) => {
        if (!activo) return;
        setPuedeEditarRoles(r.esMaster || r.permisos.includes(NOMBRE_PERMISO_GESTIONAR));
        setEsMaster(r.esMaster);
      })
      .catch(() => { /* fail-open: se mantiene visible, ver comentario arriba */ });
    return () => { activo = false; };
  }, []);

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

  /** TODOS los permisos del catálogo agrupados por módulo — para el
   *  checklist editable (a diferencia de permisosDelRolPorModulo, que solo
   *  trae los ya asignados al rol). */
  const todosLosPermisosPorModulo = useMemo(() => {
    const grupos = new Map<string, PermisoRbac[]>();
    for (const p of permisos) {
      const key = p.modulo || "otros";
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(p);
    }
    return grupos;
  }, [permisos]);

  const permisoIdGestionar = useMemo(
    () => permisos.find(p => p.nombre === NOMBRE_PERMISO_GESTIONAR)?.id ?? null,
    [permisos]
  );

  /** true si la selección actual agrega o quita rbac:gestionar respecto al
   *  estado original del rol — dispara la confirmación reforzada. */
  const tocaGestionar = useMemo(() => {
    if (!permisoIdGestionar || !rolPanel) return false;
    const teniaAntes = permisosDelRolPanel.some(p => p.id === permisoIdGestionar);
    const tieneAhora = seleccionPermisos.has(permisoIdGestionar);
    return teniaAntes !== tieneAhora;
  }, [permisoIdGestionar, rolPanel, permisosDelRolPanel, seleccionPermisos]);

  /** true = la operación pendiente AGREGA rbac:gestionar; false = lo quita.
   *  Solo tiene sentido mientras tocaGestionar es true (para el texto del
   *  modal de confirmación reforzada). */
  const agregandoGestionar = permisoIdGestionar !== null && seleccionPermisos.has(permisoIdGestionar);

  /** master es siempre solo lectura — su acceso se resuelve por la regla
   *  especial del motor RBAC, nunca por filas en rol_permisos (mismo
   *  criterio que el backend, Sprint 3D-7.3). */
  const puedeEditarEsteRol = puedeEditarRoles && rolPanel?.nombre !== NOMBRE_ROL_MASTER;

  function abrirRolPanel(id: string) {
    setRolPanelId(id);
    setEditandoRol(false);
    setSeleccionPermisos(new Set());
    setErrorGuardadoPermisos(null);
    setExitoPermisos(false);
    setConfirmarGestionar(false);
  }

  function cerrarRolPanel() {
    setRolPanelId(null);
    setEditandoRol(false);
    setSeleccionPermisos(new Set());
    setErrorGuardadoPermisos(null);
    setExitoPermisos(false);
    setConfirmarGestionar(false);
  }

  function iniciarEdicionPermisos() {
    if (!rolPanel || !puedeEditarEsteRol) return;
    setSeleccionPermisos(new Set(permisosDelRolPanel.map(p => p.id)));
    setErrorGuardadoPermisos(null);
    setExitoPermisos(false);
    setEditandoRol(true);
  }

  /** Cancelación sin guardar — descarta la selección, vuelve a solo lectura. */
  function cancelarEdicionPermisos() {
    setEditandoRol(false);
    setSeleccionPermisos(new Set());
    setErrorGuardadoPermisos(null);
    setConfirmarGestionar(false);
  }

  function togglePermiso(permisoId: string) {
    setSeleccionPermisos(prev => {
      const next = new Set(prev);
      if (next.has(permisoId)) next.delete(permisoId); else next.add(permisoId);
      return next;
    });
  }

  const ejecutarGuardadoPermisos = useCallback(async () => {
    if (!rolPanel) return;
    setGuardandoPermisos(true);
    setErrorGuardadoPermisos(null);
    try {
      const resultado = await actualizarPermisosRol(rolPanel.id, [...seleccionPermisos]);
      const idsFinales = new Set(resultado.permisos.map(p => p.id));
      // Actualiza `permisos` en memoria: agrega/quita rolPanel de la lista
      // `roles` de cada permiso según si quedó en el resultado — sin
      // refetch de /api/permisos ni /api/roles completo (requisito del
      // sprint 3D-7.5).
      setPermisos(prev => prev.map(p => {
        const teniaRol      = p.roles.some(r => r.id === rolPanel.id);
        const debeTenerRol  = idsFinales.has(p.id);
        if (teniaRol === debeTenerRol) return p;
        return {
          ...p,
          roles: debeTenerRol
            ? [...p.roles, { id: rolPanel.id, nombre: rolPanel.nombre }]
            : p.roles.filter(r => r.id !== rolPanel.id),
        };
      }));
      setEditandoRol(false);
      setConfirmarGestionar(false);
      setExitoPermisos(true);
    } catch (e) {
      // confirmarGestionar NO se limpia aquí a propósito: si el error viene
      // del guard esMaster del backend (403), el modal de confirmación
      // reforzada permanece abierto mostrando el error y ofreciendo
      // "Reintentar" — cerrarlo perdería ese contexto.
      setErrorGuardadoPermisos(e instanceof Error ? e.message : "Error al guardar los permisos");
    } finally {
      setGuardandoPermisos(false);
    }
  }, [rolPanel, seleccionPermisos]);

  /** Punto de entrada de "Guardar" — pide confirmación reforzada primero si
   *  la operación agrega o quita rbac:gestionar; si no, guarda directamente. */
  function guardarPermisos() {
    setExitoPermisos(false);
    if (tocaGestionar) {
      setConfirmarGestionar(true); // el modal invoca ejecutarGuardadoPermisos() al confirmar
      return;
    }
    void ejecutarGuardadoPermisos();
  }

  return {
    roles, permisos, loading, error, cargar,
    pestana, setPestana,
    rolPanelId, abrirRolPanel, cerrarRolPanel, rolPanel,
    permisosDelRolPanel, permisosDelRolPorModulo, todosLosPermisosPorModulo,
    permisoPanelId, setPermisoPanelId, permisoPanel,
    puedeEditarRoles, puedeEditarEsteRol, esMaster,
    editandoRol, iniciarEdicionPermisos, cancelarEdicionPermisos, togglePermiso, seleccionPermisos,
    guardandoPermisos, errorGuardadoPermisos, exitoPermisos,
    tocaGestionar, agregandoGestionar, confirmarGestionar, setConfirmarGestionar,
    guardarPermisos, ejecutarGuardadoPermisos,
  };
}
