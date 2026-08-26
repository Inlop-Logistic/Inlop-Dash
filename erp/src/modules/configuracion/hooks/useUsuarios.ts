import { useState, useEffect, useMemo, useCallback } from "react";
import type { UsuarioRbac, RolRbac } from "../types";
import { listarUsuarios, listarRoles, actualizarRolesUsuario, obtenerMisPermisos } from "../services/api";

export type FiltroEstadoUsuario = "" | "activo" | "inactivo";

const NOMBRE_ROL_MASTER = "master";

/**
 * Estado de Configuración → Parámetros → Usuarios (Sprint 3D-4, edición de
 * roles agregada en Sprint 3D-7.4). Lectura: GET /api/usuarios + GET
 * /api/roles. Escritura: PUT /api/usuarios/:id/roles (Sprint 3D-7.2) —
 * único endpoint usado para guardar, con el conjunto COMPLETO de roles
 * deseado; el usuario en memoria se actualiza con la respuesta del backend,
 * sin volver a pedir /api/usuarios completo.
 */
export function useUsuarios() {
  const [data,     setData]     = useState<UsuarioRbac[]>([]);
  const [roles,    setRoles]    = useState<RolRbac[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoUsuario>("");
  const [panelId,  setPanelId]  = useState<string | null>(null);

  // Progressive disclosure de los controles de edición (Sprint 3D-7.4) —
  // mismo criterio fail-open que ParametrosPage: NUNCA un mecanismo de
  // seguridad, solo evita ofrecer "Editar roles" a quien de todos modos
  // recibiría 403 al guardar. La autoridad real vive en el backend
  // (requirePermiso('rbac:gestionar') + guard esMaster en
  // PUT /api/usuarios/:id/roles, Sprint 3D-7.2). `esMaster` se usa además
  // para decidir la confirmación reforzada al tocar el rol master.
  const [puedeEditarRoles, setPuedeEditarRoles] = useState(true);
  const [esMaster,         setEsMaster]         = useState(false);

  // ── Edición de roles del panel abierto ───────────────────────────────────
  const [editando,       setEditando]       = useState(false);
  const [seleccion,      setSeleccion]      = useState<Set<string>>(new Set());
  const [guardando,      setGuardando]      = useState(false);
  const [errorGuardado,  setErrorGuardado]  = useState<string | null>(null);
  const [exito,          setExito]          = useState(false);
  // true mientras se muestra la confirmación reforzada (agregar/quitar master).
  const [confirmarMaster, setConfirmarMaster] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usuariosData, rolesData] = await Promise.all([listarUsuarios(), listarRoles()]);
      setData(usuariosData);
      setRoles(rolesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios");
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
        setPuedeEditarRoles(r.esMaster || r.permisos.includes("rbac:gestionar"));
        setEsMaster(r.esMaster);
      })
      .catch(() => { /* fail-open: se mantiene visible, ver comentario arriba */ });
    return () => { activo = false; };
  }, []);

  // ── Filtrado en memoria ───────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let rows = data;
    if (filtroEstado === "activo")   rows = rows.filter(u => u.activo);
    if (filtroEstado === "inactivo") rows = rows.filter(u => !u.activo);

    const term = busqueda.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(u =>
      u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }, [data, busqueda, filtroEstado]);

  const panelUsuario = useMemo(
    () => (panelId ? data.find(u => u.id === panelId) ?? null : null),
    [panelId, data]
  );

  /** Los 8 roles RBAC disponibles para asignar — solo los activos, mismo
   *  criterio de asignabilidad que valida el backend (Sprint 3D-7.2). */
  const rolesAsignables = useMemo(() => roles.filter(r => r.activo), [roles]);

  const rolIdMaster = useMemo(
    () => roles.find(r => r.nombre === NOMBRE_ROL_MASTER)?.id ?? null,
    [roles]
  );

  /** true si la selección actual agrega o quita el rol master respecto al
   *  estado original del usuario — dispara la confirmación reforzada. */
  const tocaMaster = useMemo(() => {
    if (!rolIdMaster || !panelUsuario) return false;
    const teniaAntes = panelUsuario.roles_rbac.some(r => r.id === rolIdMaster);
    const tieneAhora = seleccion.has(rolIdMaster);
    return teniaAntes !== tieneAhora;
  }, [rolIdMaster, panelUsuario, seleccion]);

  function abrirPanel(id: string) {
    setPanelId(id);
    setEditando(false);
    setSeleccion(new Set());
    setErrorGuardado(null);
    setExito(false);
    setConfirmarMaster(false);
  }

  function cerrarPanel() {
    setPanelId(null);
    setEditando(false);
    setSeleccion(new Set());
    setErrorGuardado(null);
    setExito(false);
    setConfirmarMaster(false);
  }

  function iniciarEdicion() {
    if (!panelUsuario) return;
    setSeleccion(new Set(panelUsuario.roles_rbac.map(r => r.id)));
    setErrorGuardado(null);
    setExito(false);
    setEditando(true);
  }

  /** Cancelación sin guardar — descarta la selección, vuelve a solo lectura. */
  function cancelarEdicion() {
    setEditando(false);
    setSeleccion(new Set());
    setErrorGuardado(null);
    setConfirmarMaster(false);
  }

  function toggleRol(rolId: string) {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(rolId)) next.delete(rolId); else next.add(rolId);
      return next;
    });
  }

  const ejecutarGuardado = useCallback(async () => {
    if (!panelUsuario) return;
    setGuardando(true);
    setErrorGuardado(null);
    try {
      const resultado = await actualizarRolesUsuario(panelUsuario.id, [...seleccion]);
      // Actualiza el usuario en memoria con la respuesta del backend — sin
      // refetch de /api/usuarios completo (requisito del sprint 3D-7.4).
      setData(prev => prev.map(u => u.id === resultado.id ? { ...u, roles_rbac: resultado.roles_rbac } : u));
      setEditando(false);
      setConfirmarMaster(false);
      setExito(true);
    } catch (e) {
      // confirmarMaster NO se limpia aquí a propósito: si el error viene del
      // guard esMaster/último-master del backend (403/409), el modal de
      // confirmación reforzada permanece abierto mostrando el error y
      // ofreciendo "Reintentar" — cerrarlo perdería ese contexto.
      setErrorGuardado(e instanceof Error ? e.message : "Error al guardar los roles");
    } finally {
      setGuardando(false);
    }
  }, [panelUsuario, seleccion]);

  /** Punto de entrada de "Guardar" — pide confirmación reforzada primero si
   *  la operación agrega o quita master; si no, guarda directamente. */
  function guardarRoles() {
    setExito(false);
    if (tocaMaster) {
      setConfirmarMaster(true); // el modal invoca ejecutarGuardado() al confirmar
      return;
    }
    void ejecutarGuardado();
  }

  return {
    filtrados, loading, error, cargar,
    busqueda, setBusqueda,
    filtroEstado, setFiltroEstado,
    panelId, abrirPanel, cerrarPanel, panelUsuario,
    rolesAsignables,
    puedeEditarRoles, esMaster,
    editando, iniciarEdicion, cancelarEdicion, toggleRol, seleccion,
    guardando, errorGuardado, exito,
    tocaMaster, confirmarMaster, setConfirmarMaster,
    guardarRoles, ejecutarGuardado,
  };
}
