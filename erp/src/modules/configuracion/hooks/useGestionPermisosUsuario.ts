import { useState, useEffect, useCallback, useMemo } from "react";
import type { UsuarioRbac, RolRbac, PermisoRbac } from "../types";
import { listarUsuarios, listarRoles, listarPermisos } from "../services/api";

/**
 * Estado de la pantalla Configuración → Parámetros → Gestión de permisos por
 * usuario (Sprint 3D-7.11B — base UI; multi-rol/permisos heredados en
 * 3D-7.11C; excepciones individuales locales en 3D-7.11D).
 *
 * Carga los mismos 3 catálogos que ya usan UsuariosPage/RolesPermisosPage
 * (GET /api/usuarios, /api/roles, /api/permisos) — sin endpoints nuevos.
 *
 * SIGUE SIN PERSISTIR (alcance de 3D-7.11D): decisión de producto ya cerrada
 * — un usuario puede tener múltiples roles simultáneos, y la UI de la
 * izquierda mantiene selección múltiple. El panel derecho calcula en tiempo
 * real, todo en memoria:
 *
 *   permisos_efectivos = permisos_heredados (unión de roles) + grants − revokes
 *
 * — la misma fórmula que ya usa el motor RBAC real (services/rbac/resolver.js),
 * pero replicada aquí en el frontend puramente para previsualización local:
 * NADA de esto llama a PUT /api/usuarios/:id/roles ni a
 * PUT /api/usuarios/:id/permisos (los endpoints reales, ya existentes, que
 * un sprint posterior de guardado deberá invocar).
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

  // Modo "Excepciones de permisos" — interruptor visual: con esto en false,
  // el panel derecho se comporta exactamente como en 3D-7.11C (solo
  // heredados, sin ON/OFF individual). Con esto en true, expone el catálogo
  // completo con grants/revokes locales (Sprint 3D-7.11D).
  const [excepcionesActivadas, setExcepcionesActivadas] = useState(false);

  // Excepciones locales (Sprint 3D-7.11D) — SOLO en memoria, nunca
  // persistidas. `grantsLocales`: permisos NO heredados que el admin activó
  // a mano. `revokesLocales`: permisos SÍ heredados que el admin desactivó a
  // mano. Ambos son deltas respecto a permisosHeredadosIds — nunca se
  // guarda un permiso en ambos conjuntos a la vez (ver toggleExcepcionPermiso).
  const [grantsLocales,  setGrantsLocales]  = useState<Set<string>>(new Set());
  const [revokesLocales, setRevokesLocales] = useState<Set<string>>(new Set());

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
    setGrantsLocales(new Set());
    setRevokesLocales(new Set());
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

  /** IDs de los permisos heredados por el conjunto de roles dado — misma
   *  regla de unión que permisosHeredados (abajo), extraída para poder
   *  recalcularla también dentro de toggleRol (antes de que el nuevo
   *  useMemo de permisosHeredadosIds llegue a correr) y así podar en el
   *  mismo evento las excepciones que dejaron de tener sentido. */
  function calcularHeredadosIds(catalogo: PermisoRbac[], rolesIds: Set<string>): Set<string> {
    const ids = new Set<string>();
    for (const p of catalogo) {
      if (p.roles.some(r => rolesIds.has(r.id))) ids.add(p.id);
    }
    return ids;
  }

  function toggleRol(rolId: string) {
    if (edicionBloqueada) return;
    setRolesSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(rolId)) next.delete(rolId); else next.add(rolId);

      // Recalcular heredados con el nuevo conjunto de roles, en el mismo
      // evento, para podar excepciones locales que dejaron de tener sentido
      // frente a la nueva base — mismo criterio que "si vuelve a su estado
      // base, eliminar la excepción local", aplicado también cuando es la
      // BASE (los roles) la que cambia, no solo el toggle manual:
      //   - un revoke sobre un permiso que ya no es heredado no significa
      //     nada (ya está en OFF por no-herencia) → se descarta.
      //   - un grant sobre un permiso que ahora SÍ es heredado es redundante
      //     (ya está en ON por herencia) → se descarta.
      const nuevosHeredadosIds = calcularHeredadosIds(permisos, next);
      setRevokesLocales(prevR => {
        const filtrado = [...prevR].filter(id => nuevosHeredadosIds.has(id));
        return filtrado.length === prevR.size ? prevR : new Set(filtrado);
      });
      setGrantsLocales(prevG => {
        const filtrado = [...prevG].filter(id => !nuevosHeredadosIds.has(id));
        return filtrado.length === prevG.size ? prevG : new Set(filtrado);
      });

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
  const permisosHeredadosIds = useMemo(
    () => calcularHeredadosIds(permisos, rolesSeleccionados),
    [permisos, rolesSeleccionados]
  );
  const permisosHeredados = useMemo(
    () => permisos.filter(p => permisosHeredadosIds.has(p.id)),
    [permisos, permisosHeredadosIds]
  );

  // Permisos efectivos (Sprint 3D-7.11D) = heredados ∪ grants − revokes.
  // Estado 100% derivado (useMemo), nunca una copia manual que pudiera
  // desincronizarse de permisosHeredadosIds/grantsLocales/revokesLocales.
  const permisosEfectivosIds = useMemo(() => {
    const s = new Set(permisosHeredadosIds);
    for (const id of grantsLocales)  s.add(id);
    for (const id of revokesLocales) s.delete(id);
    return s;
  }, [permisosHeredadosIds, grantsLocales, revokesLocales]);

  /**
   * Alterna la excepción local de un permiso puntual (solo con "Excepciones"
   * activado). Regla exacta del ticket:
   *   - Heredado (base ON)  → el toggle alterna un revoke.
   *   - No heredado (base OFF) → el toggle alterna un grant.
   * Al volver a coincidir con su estado base, la excepción se elimina (un
   * `Set.add`/`delete` alternado ya logra esto: no hay una tercera opción
   * "excepción neutra" que guardar).
   */
  function toggleExcepcionPermiso(permisoId: string) {
    if (edicionBloqueada) return;
    if (permisosHeredadosIds.has(permisoId)) {
      setRevokesLocales(prev => {
        const next = new Set(prev);
        if (next.has(permisoId)) next.delete(permisoId); else next.add(permisoId);
        return next;
      });
    } else {
      setGrantsLocales(prev => {
        const next = new Set(prev);
        if (next.has(permisoId)) next.delete(permisoId); else next.add(permisoId);
        return next;
      });
    }
  }

  function agruparPorModulo(lista: PermisoRbac[]): Map<string, PermisoRbac[]> {
    const grupos = new Map<string, PermisoRbac[]>();
    for (const p of lista) {
      const key = p.modulo || "otros";
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(p);
    }
    return grupos;
  }

  // Agrupado por módulo para el panel derecho, filtrado por el buscador.
  // Con excepciones desactivadas: fuente = solo heredados (comportamiento
  // idéntico a 3D-7.11C, el buscador nunca puede sacar a relucir un permiso
  // fuera de los roles marcados). Con excepciones activadas: fuente = el
  // catálogo COMPLETO (requisito explícito del ticket), y el buscador
  // también corre sobre todo el catálogo.
  const permisosPorModulo = useMemo(() => {
    const fuente = excepcionesActivadas ? permisos : permisosHeredados;
    const termino = busquedaPermiso.trim().toLowerCase();
    const filtrados = termino
      ? fuente.filter(p =>
          p.descripcion.toLowerCase().includes(termino) ||
          p.modulo.toLowerCase().includes(termino)
        )
      : fuente;
    return agruparPorModulo(filtrados);
  }, [excepcionesActivadas, permisos, permisosHeredados, busquedaPermiso]);

  return {
    usuarios, roles, permisos, loading, error, cargar,
    usuarioSeleccionadoId, usuarioSeleccionado, seleccionarUsuario,
    rolesSeleccionados, toggleRol,
    excepcionesActivadas, toggleExcepcionesActivadas,
    grantsLocales, revokesLocales, toggleExcepcionPermiso,
    busquedaPermiso, setBusquedaPermiso,
    permisosHeredadosIds, permisosHeredados, permisosEfectivosIds, permisosPorModulo,
    edicionBloqueada,
  };
}
