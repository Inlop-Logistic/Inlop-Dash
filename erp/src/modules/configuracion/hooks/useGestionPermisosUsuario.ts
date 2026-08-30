import { useState, useEffect, useCallback, useMemo } from "react";
import type { UsuarioRbac, RolRbac, PermisoRbac } from "../types";
import { listarUsuarios, listarRoles, listarPermisos } from "../services/api";

/**
 * Estado de la pantalla Configuración → Parámetros → Gestión de permisos por
 * usuario (Sprint 3D-7.11B — base UI, sin persistencia).
 *
 * Carga los mismos 3 catálogos que ya usan UsuariosPage/RolesPermisosPage
 * (GET /api/usuarios, /api/roles, /api/permisos) — sin endpoints nuevos.
 *
 * IMPORTANTE (alcance, ver tickets 3D-7.11B/3D-7.11B.1/3D-7.11C):
 * decisión de producto ya cerrada — un usuario puede tener múltiples roles
 * simultáneos, y la UI de la izquierda mantiene selección múltiple
 * (checkbox) por eso. Desde 3D-7.11C, el panel derecho SÍ calcula en tiempo
 * real la UNIÓN de los permisos de los roles marcados (permisosHeredados
 * abajo) — pero sigue sin haber guardado real, ni grants/revokes de
 * excepciones individuales (eso es 3D-7.11D): todo lo de esta pantalla
 * sigue siendo estado local hasta que exista un endpoint de guardado
 * conectado aquí.
 */
export function useGestionPermisosUsuario() {
  const [usuarios, setUsuarios] = useState<UsuarioRbac[]>([]);
  const [roles,    setRoles]    = useState<RolRbac[]>([]);
  const [permisos, setPermisos] = useState<PermisoRbac[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [usuarioSeleccionadoId, setUsuarioSeleccionadoId] = useState<string | null>(null);

  // Selección de roles (checkbox múltiple) — SOLO estado local, ver
  // comentario del módulo. Se reinicializa desde usuario.roles_rbac cada vez
  // que cambia el usuario seleccionado (abajo).
  const [rolesSeleccionados, setRolesSeleccionados] = useState<Set<string>>(new Set());

  // Modo "Excepciones de permisos" — únicamente el interruptor visual
  // pedido por el sprint; todavía no filtra ni altera el panel de permisos.
  const [excepcionesActivadas, setExcepcionesActivadas] = useState(false);

  // Buscador del panel de permisos (derecha) — filtra sobre el texto visible
  // (descripcion/módulo), nunca sobre el nombre técnico (no se muestra).
  const [busquedaPermiso, setBusquedaPermiso] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, r, p] = await Promise.all([listarUsuarios(), listarRoles(), listarPermisos()]);
      setUsuarios(u);
      setRoles(r);
      setPermisos(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios/roles/permisos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const usuarioSeleccionado = useMemo(
    () => (usuarioSeleccionadoId ? usuarios.find(u => u.id === usuarioSeleccionadoId) ?? null : null),
    [usuarioSeleccionadoId, usuarios]
  );

  // Al cambiar de usuario: recargar la selección de roles desde sus
  // asignaciones reales y resetear el resto del estado local de la
  // pantalla, para que nada del usuario anterior se arrastre.
  useEffect(() => {
    setRolesSeleccionados(new Set(usuarioSeleccionado?.roles_rbac.map(r => r.id) ?? []));
    setExcepcionesActivadas(false);
    setBusquedaPermiso("");
  }, [usuarioSeleccionado]);

  function seleccionarUsuario(id: string) {
    setUsuarioSeleccionadoId(id || null);
  }

  /** Edición bloqueada por completo si no hay usuario seleccionado o si está
   *  inactivo — profiles.activo es el mecanismo principal de bloqueo real
   *  (3D-7.7C); este flag es solo para no ofrecer una edición que además de
   *  no persistir todavía (este sprint), quedaría inerte igualmente. */
  const edicionBloqueada = !usuarioSeleccionado || usuarioSeleccionado.activo !== true;

  function toggleRol(rolId: string) {
    if (edicionBloqueada) return;
    setRolesSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(rolId)) next.delete(rolId); else next.add(rolId);
      return next;
    });
  }

  function toggleExcepcionesActivadas() {
    if (edicionBloqueada) return;
    setExcepcionesActivadas(v => !v);
  }

  // Permisos heredados = UNIÓN de los permisos de todos los roles marcados
  // en rolesSeleccionados (Sprint 3D-7.11C). Cada PermisoRbac ya trae su
  // propio reverse-map `roles: RolRbacRef[]` (GET /api/permisos) — el mismo
  // dato que useRolesPermisos.ts ya usa para "permisos de este rol"
  // (permisos.filter(p => p.roles.some(...))). Aquí se generaliza a "algún
  // rol seleccionado", sin tocar el catálogo ni pedir nada nuevo al backend.
  //
  // Deduplicación: se filtra sobre `permisos` (la lista única del catálogo,
  // un elemento por permiso real), nunca se concatenan los permisos de cada
  // rol por separado — así que un permiso presente en 2+ roles seleccionados
  // aparece una sola vez de forma natural, sin necesitar un Set/Map
  // adicional para deduplicar.
  //
  // Con 0 roles seleccionados, la unión es vacía por definición (no hay
  // nada que heredar) — el panel lo comunica explícitamente en vez de
  // mostrar el catálogo completo o quedar en blanco sin explicación.
  const permisosHeredados = useMemo(
    () => permisos.filter(p => p.roles.some(r => rolesSeleccionados.has(r.id))),
    [permisos, rolesSeleccionados]
  );

  // Agrupado por módulo para el panel derecho — mismo cálculo ya usado en
  // useRolesPermisos.ts (permisosPorModulo/todosLosPermisosPorModulo), pero
  // aplicado sobre permisosHeredados (no el catálogo completo) y filtrado
  // por el buscador. El buscador, por diseño, solo puede acotar lo ya
  // heredado — nunca saca a relucir un permiso fuera de los roles marcados,
  // porque filtra sobre `permisosHeredados`, no sobre `permisos`.
  const permisosPorModulo = useMemo(() => {
    const termino = busquedaPermiso.trim().toLowerCase();
    const filtrados = termino
      ? permisosHeredados.filter(p =>
          p.descripcion.toLowerCase().includes(termino) ||
          p.modulo.toLowerCase().includes(termino)
        )
      : permisosHeredados;

    const grupos = new Map<string, PermisoRbac[]>();
    for (const p of filtrados) {
      const key = p.modulo || "otros";
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(p);
    }
    return grupos;
  }, [permisosHeredados, busquedaPermiso]);

  return {
    usuarios, roles, permisos, loading, error, cargar,
    usuarioSeleccionadoId, usuarioSeleccionado, seleccionarUsuario,
    rolesSeleccionados, toggleRol,
    excepcionesActivadas, toggleExcepcionesActivadas,
    busquedaPermiso, setBusquedaPermiso, permisosHeredados, permisosPorModulo,
    edicionBloqueada,
  };
}
