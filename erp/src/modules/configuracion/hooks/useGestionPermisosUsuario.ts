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
 * IMPORTANTE (alcance de este sprint, ver ticket 3D-7.11B/3D-7.11B.1):
 * decisión de producto ya cerrada — un usuario puede tener múltiples roles
 * simultáneos, y la UI de la izquierda mantiene selección múltiple
 * (checkbox) por eso. Lo que SÍ queda deliberadamente para 3D-7.11C es el
 * cálculo: la selección de roles y el modo "Excepciones de permisos" son
 * ÚNICAMENTE estado local de preparación visual en este sprint — todavía NO
 * se calcula la unión de permisos de los roles seleccionados, NO se deriva
 * qué permisos "heredaría" el usuario, y NO hay guardado real.
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

  // Agrupado por módulo para el panel derecho — mismo cálculo ya usado en
  // useRolesPermisos.ts (permisosPorModulo/todosLosPermisosPorModulo), sobre
  // el catálogo completo ya cargado, filtrado por el buscador. No depende de
  // rolesSeleccionados ni de excepcionesActivadas en este sprint (ver
  // comentario del módulo) — es deliberado, no un olvido.
  const permisosPorModulo = useMemo(() => {
    const termino = busquedaPermiso.trim().toLowerCase();
    const filtrados = termino
      ? permisos.filter(p =>
          p.descripcion.toLowerCase().includes(termino) ||
          p.modulo.toLowerCase().includes(termino)
        )
      : permisos;

    const grupos = new Map<string, PermisoRbac[]>();
    for (const p of filtrados) {
      const key = p.modulo || "otros";
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(p);
    }
    return grupos;
  }, [permisos, busquedaPermiso]);

  return {
    usuarios, roles, permisos, loading, error, cargar,
    usuarioSeleccionadoId, usuarioSeleccionado, seleccionarUsuario,
    rolesSeleccionados, toggleRol,
    excepcionesActivadas, toggleExcepcionesActivadas,
    busquedaPermiso, setBusquedaPermiso, permisosPorModulo,
    edicionBloqueada,
  };
}
