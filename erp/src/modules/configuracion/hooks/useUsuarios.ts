import { useState, useEffect, useMemo, useCallback } from "react";
import type { UsuarioRbac, RolRbac, PermisoRbac } from "../types";
import {
  listarUsuarios, listarRoles, listarPermisos, actualizarRolesUsuario,
  actualizarExcepcionesUsuario, obtenerMisPermisos,
} from "../services/api";

export type FiltroEstadoUsuario = "" | "activo" | "inactivo";

const NOMBRE_ROL_MASTER        = "master";
const NOMBRE_PERMISO_GESTIONAR = "rbac:gestionar";

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
  const [permisos, setPermisos] = useState<PermisoRbac[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoUsuario>("");
  // Filtro por rol (rediseño UI) — filtra sobre los mismos datos ya cargados,
  // por rol_id (valor estable, a diferencia del nombre visible).
  const [filtroRol, setFiltroRol] = useState("");
  const [panelId,  setPanelId]  = useState<string | null>(null);
  // Al abrir el panel desde "Editar" (tabla/menú de acciones), qué sección
  // debe entrar directo en modo edición — null = abrir en solo lectura,
  // mismo comportamiento que siempre al hacer click en una fila (rediseño
  // UI; no cambia ninguna regla de permisos ni de guardado ya existente).
  const [autoEditarAlAbrir, setAutoEditarAlAbrir] = useState<"roles" | "excepciones" | null>(null);

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

  // ── Edición de excepciones individuales (usuario_permisos) del panel
  // abierto (Sprint 3D-7.6) — independiente de la edición de roles: ambas
  // pueden coexistir en el mismo panel, pero cada una tiene su propio modo
  // de edición/guardado/error, igual que roles y permisos en 3D-7.4/7.5. ──
  const [editandoExcepciones,       setEditandoExcepciones]       = useState(false);
  // permiso_id -> efecto deseado. Ausente = sin excepción para ese permiso.
  const [seleccionExcepciones,      setSeleccionExcepciones]      = useState<Map<string, "grant" | "revoke">>(new Map());
  const [guardandoExcepciones,      setGuardandoExcepciones]      = useState(false);
  const [errorGuardadoExcepciones,  setErrorGuardadoExcepciones]  = useState<string | null>(null);
  const [exitoExcepciones,          setExitoExcepciones]          = useState(false);
  // true mientras se muestra la confirmación reforzada (agregar/modificar/quitar rbac:gestionar).
  const [confirmarGestionarExcepcion, setConfirmarGestionarExcepcion] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usuariosData, rolesData, permisosData] = await Promise.all([listarUsuarios(), listarRoles(), listarPermisos()]);
      setData(usuariosData);
      setRoles(rolesData);
      setPermisos(permisosData);
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
    if (filtroRol) rows = rows.filter(u => u.roles_rbac.some(r => r.id === filtroRol));

    const term = busqueda.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(u =>
      u.nombre.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.roles_rbac.some(r => r.nombre.toLowerCase().includes(term))
    );
  }, [data, busqueda, filtroEstado, filtroRol]);

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

  /** Resetea el modo edición de roles Y de excepciones — usado al abrir un
   *  panel distinto o al cerrarlo, para que ninguno arrastre estado del
   *  usuario anterior. */
  function resetearEdicionPanel() {
    setEditando(false);
    setSeleccion(new Set());
    setErrorGuardado(null);
    setExito(false);
    setConfirmarMaster(false);
    setEditandoExcepciones(false);
    setSeleccionExcepciones(new Map());
    setErrorGuardadoExcepciones(null);
    setExitoExcepciones(false);
    setConfirmarGestionarExcepcion(false);
  }

  /**
   * Abre el panel de un usuario — opcionalmente entrando directo en modo
   * edición (usado por "Editar" y el menú de acciones de la tabla, rediseño
   * UI). `editar` solo decide QUÉ sección arranca en edición; no cambia
   * ninguna regla de permisos/guardado — el efecto de abajo reutiliza
   * exactamente el mismo estado que iniciarEdicion()/iniciarEdicionExcepciones()
   * ya usan al hacer click en "Editar" dentro del panel.
   */
  function abrirPanel(id: string, editar?: "roles" | "excepciones") {
    setPanelId(id);
    resetearEdicionPanel();
    setAutoEditarAlAbrir(editar ?? null);
  }

  function cerrarPanel() {
    setPanelId(null);
    resetearEdicionPanel();
    setAutoEditarAlAbrir(null);
  }

  // panelUsuario solo existe a partir del siguiente render tras abrirPanel()
  // (se deriva de panelId vía useMemo) — este efecto arma el modo edición en
  // cuanto esa referencia queda disponible, evitando leer un panelUsuario
  // obsoleto (null) si se intentara hacer en el mismo manejador de click.
  useEffect(() => {
    if (!autoEditarAlAbrir || !panelUsuario || !puedeEditarRoles) return;
    if (autoEditarAlAbrir === "roles") {
      setSeleccion(new Set(panelUsuario.roles_rbac.map(r => r.id)));
      setErrorGuardado(null);
      setExito(false);
      setEditando(true);
    } else {
      const inicial = new Map<string, "grant" | "revoke">();
      for (const e of panelUsuario.excepciones) inicial.set(e.permiso_id, e.efecto);
      setSeleccionExcepciones(inicial);
      setErrorGuardadoExcepciones(null);
      setExitoExcepciones(false);
      setEditandoExcepciones(true);
    }
    setAutoEditarAlAbrir(null);
  }, [autoEditarAlAbrir, panelUsuario, puedeEditarRoles]);

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

  // ── Excepciones individuales de usuario_permisos (Sprint 3D-7.6) ─────────
  // NO modifica roles ni rol_permisos — solo usuario_permisos, superpuesto a
  // lo que el usuario ya tiene por sus roles (ver resolver.js: permisos del
  // rol + grants − revokes).

  const permisoIdGestionar = useMemo(
    () => permisos.find(p => p.nombre === NOMBRE_PERMISO_GESTIONAR)?.id ?? null,
    [permisos]
  );

  /** true si panelUsuario tiene el rol master — sus permisos efectivos se
   *  resuelven por el corto-circuito especial del motor (resolver.js corta
   *  ANTES de consultar usuario_permisos), así que ninguna excepción los
   *  altera. Solo se usa para la advertencia informativa del frontend; el
   *  backend no bloquea la escritura (una excepción sobre un usuario master
   *  es válida en la base de datos, solo que inerte). */
  const panelUsuarioEsMaster = useMemo(
    () => panelUsuario?.roles_rbac.some(r => r.nombre === NOMBRE_ROL_MASTER) ?? false,
    [panelUsuario]
  );

  /** Efecto deseado para rbac:gestionar tras la edición actual, o null si no
   *  hay excepción configurada — usado para el mensaje del modal reforzado. */
  const efectoDeseadoGestionar = permisoIdGestionar !== null
    ? seleccionExcepciones.get(permisoIdGestionar) ?? null
    : null;

  /** true si la selección actual agrega, modifica o quita una excepción
   *  sobre rbac:gestionar respecto al estado original — dispara la
   *  confirmación reforzada (regla 2 del sprint 3D-7.6). */
  const tocaGestionarExcepcion = useMemo(() => {
    if (!permisoIdGestionar || !panelUsuario) return false;
    const actual  = panelUsuario.excepciones.find(e => e.permiso_id === permisoIdGestionar)?.efecto ?? null;
    const deseado = seleccionExcepciones.get(permisoIdGestionar) ?? null;
    return actual !== deseado;
  }, [permisoIdGestionar, panelUsuario, seleccionExcepciones]);

  function iniciarEdicionExcepciones() {
    if (!panelUsuario) return;
    const inicial = new Map<string, "grant" | "revoke">();
    for (const e of panelUsuario.excepciones) inicial.set(e.permiso_id, e.efecto);
    setSeleccionExcepciones(inicial);
    setErrorGuardadoExcepciones(null);
    setExitoExcepciones(false);
    setEditandoExcepciones(true);
  }

  /** Cancelación sin guardar — descarta la selección, vuelve a solo lectura. */
  function cancelarEdicionExcepciones() {
    setEditandoExcepciones(false);
    setSeleccionExcepciones(new Map());
    setErrorGuardadoExcepciones(null);
    setConfirmarGestionarExcepcion(false);
  }

  /** Marca `permisoId` con `efecto`; volver a elegir el mismo efecto ya
   *  seleccionado lo quita (misma excepción vuelve a "sin excepción"). */
  function setEfectoExcepcion(permisoId: string, efecto: "grant" | "revoke") {
    setSeleccionExcepciones(prev => {
      const next = new Map(prev);
      if (next.get(permisoId) === efecto) next.delete(permisoId);
      else next.set(permisoId, efecto);
      return next;
    });
  }

  function quitarExcepcion(permisoId: string) {
    setSeleccionExcepciones(prev => {
      const next = new Map(prev);
      next.delete(permisoId);
      return next;
    });
  }

  const ejecutarGuardadoExcepciones = useCallback(async () => {
    if (!panelUsuario) return;
    setGuardandoExcepciones(true);
    setErrorGuardadoExcepciones(null);
    try {
      const body = [...seleccionExcepciones.entries()].map(([permiso_id, efecto]) => ({ permiso_id, efecto }));
      const resultado = await actualizarExcepcionesUsuario(panelUsuario.id, body);
      // Actualiza el usuario en memoria con la respuesta del backend — sin
      // refetch de /api/usuarios completo (mismo criterio que roles, 3D-7.4).
      setData(prev => prev.map(u => u.id === resultado.id
        ? { ...u, excepciones: resultado.excepciones.map(e => ({ permiso_id: e.permiso_id, nombre: e.nombre, efecto: e.efecto })) }
        : u
      ));
      setEditandoExcepciones(false);
      setConfirmarGestionarExcepcion(false);
      setExitoExcepciones(true);
    } catch (e) {
      // confirmarGestionarExcepcion NO se limpia aquí a propósito — mismo
      // criterio que confirmarMaster/confirmarGestionar: si el error viene
      // del guard esMaster del backend (403), el modal permanece abierto
      // mostrando el error y ofreciendo "Reintentar".
      setErrorGuardadoExcepciones(e instanceof Error ? e.message : "Error al guardar las excepciones");
    } finally {
      setGuardandoExcepciones(false);
    }
  }, [panelUsuario, seleccionExcepciones]);

  /** Punto de entrada de "Guardar" — pide confirmación reforzada primero si
   *  la operación toca rbac:gestionar; si no, guarda directamente. */
  function guardarExcepciones() {
    setExitoExcepciones(false);
    if (tocaGestionarExcepcion) {
      setConfirmarGestionarExcepcion(true); // el modal invoca ejecutarGuardadoExcepciones() al confirmar
      return;
    }
    void ejecutarGuardadoExcepciones();
  }

  return {
    // `data` = todos los usuarios cargados, sin filtrar — usado por los KPI
    // del rediseño UI (totales reales, independientes de la búsqueda/filtro
    // activos). `filtrados` sigue siendo el listado que ve la tabla.
    data, filtrados, loading, error, cargar,
    busqueda, setBusqueda,
    filtroEstado, setFiltroEstado,
    filtroRol, setFiltroRol,
    panelId, abrirPanel, cerrarPanel, panelUsuario,
    rolesAsignables,
    puedeEditarRoles, esMaster,
    editando, iniciarEdicion, cancelarEdicion, toggleRol, seleccion,
    guardando, errorGuardado, exito,
    tocaMaster, confirmarMaster, setConfirmarMaster,
    guardarRoles, ejecutarGuardado,
    permisos, panelUsuarioEsMaster,
    editandoExcepciones, iniciarEdicionExcepciones, cancelarEdicionExcepciones,
    setEfectoExcepcion, quitarExcepcion, seleccionExcepciones,
    guardandoExcepciones, errorGuardadoExcepciones, exitoExcepciones,
    efectoDeseadoGestionar, confirmarGestionarExcepcion, setConfirmarGestionarExcepcion,
    guardarExcepciones, ejecutarGuardadoExcepciones,
  };
}
