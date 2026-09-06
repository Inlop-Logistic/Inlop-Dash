import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { UsuarioRbac, RolRbac, PermisoRbac } from "../types";
import {
  listarUsuarios, listarRoles, listarPermisos,
  actualizarRolesUsuario, actualizarExcepcionesUsuario,
} from "../services/api";

const NOMBRE_ROL_MASTER        = "master";
const NOMBRE_PERMISO_GESTIONAR = "rbac:gestionar";

/**
 * Estado de la pantalla Configuración → Parámetros → Gestión de permisos por
 * usuario (Sprint 3D-7.11B — base UI; multi-rol/permisos heredados en
 * 3D-7.11C; excepciones individuales locales en 3D-7.11D; persistencia real
 * en 3D-7.11I).
 *
 * Carga los mismos 3 catálogos que ya usan UsuariosPage/RolesPermisosPage
 * (GET /api/usuarios, /api/roles, /api/permisos) — sin endpoints nuevos.
 *
 * El panel derecho calcula en tiempo real, todo en memoria hasta que se
 * pulsa "Guardar cambios":
 *
 *   permisos_efectivos = permisos_heredados (unión de roles) + grants − revokes
 *
 * — la misma fórmula que ya usa el motor RBAC real (services/rbac/resolver.js),
 * replicada aquí en el frontend puramente para previsualización local.
 *
 * Persistencia (Sprint 3D-7.11I) — reutiliza EXACTAMENTE la infraestructura
 * ya auditada en 3D-7.11H, sin endpoints/tablas/servicios nuevos:
 *   - Roles  → actualizarRolesUsuario() → PUT /api/usuarios/:id/roles
 *   - Excepciones (grants/revokes) → actualizarExcepcionesUsuario() →
 *     PUT /api/usuarios/:id/permisos
 * "Excepciones activadas" sigue siendo únicamente un interruptor de vista —
 * no existe (ni debe inventarse) una columna para eso; solo se persisten las
 * filas concretas de usuario_permisos. Mismo patrón de guardado que
 * useUsuarios.ts: cada escritura exitosa actualiza `usuarios` en memoria con
 * la respuesta del backend, sin refetch — eso automáticamente resincroniza
 * rolesOriginalIds/grantsOriginalIds/revokesOriginalIds (derivados de
 * usuarioSeleccionado) y, vía el efecto de abajo, el resto del estado local.
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

  // Al cambiar de usuario: recargar roles Y excepciones reales desde el
  // backend, resetear el resto del estado local, para que nada del usuario
  // anterior se arrastre.
  //
  // Excepciones (3D-7.11I, corrección necesaria para que "Guardar cambios"
  // sea seguro): antes de este sprint, grantsLocales/revokesLocales siempre
  // arrancaban vacíos, ignorando `usuarioSeleccionado.excepciones` — inofensivo
  // mientras nada se guardaba, pero al conectar
  // actualizarExcepcionesUsuario() (que reemplaza el conjunto COMPLETO en
  // usuario_permisos) hubiera borrado silenciosamente cualquier excepción ya
  // persistida de un usuario que ya tuviera alguna. Se siembran aquí desde el
  // dato real, exactamente como ya hace useUsuarios.ts#iniciarEdicionExcepciones.
  //
  // Guard con ref (3D-7.11I): `usuarioSeleccionado` también cambia de
  // referencia cuando `usuarios` se actualiza EN MEMORIA tras un guardado
  // exitoso (ver ejecutarGuardado) — sin este guard, ese refresco disparado
  // por un guardado PARCIAL (ej. roles guardados, excepciones fallidas)
  // resetearía roles/excepciones locales al vuelo, BORRANDO la edición de
  // excepciones que sigue pendiente de reintentar. El reinicio de estado
  // solo debe ocurrir cuando el usuario ELEGIDO cambia de verdad
  // (usuarioSeleccionadoId), nunca por un refresco de datos del mismo
  // usuario ya seleccionado.
  const usuarioIdInicializadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (usuarioIdInicializadoRef.current === usuarioSeleccionadoId) return;
    usuarioIdInicializadoRef.current = usuarioSeleccionadoId;
    setRolesSeleccionados(new Set(usuarioSeleccionado?.roles_rbac.map(r => r.id) ?? []));
    setExcepcionesActivadas(false);
    setGrantsLocales(new Set(
      (usuarioSeleccionado?.excepciones ?? []).filter(e => e.efecto === "grant").map(e => e.permiso_id)
    ));
    setRevokesLocales(new Set(
      (usuarioSeleccionado?.excepciones ?? []).filter(e => e.efecto === "revoke").map(e => e.permiso_id)
    ));
    setBusquedaPermiso("");
  }, [usuarioSeleccionado, usuarioSeleccionadoId]);

  function seleccionarUsuario(id: string) {
    setUsuarioSeleccionadoId(id || null);
  }

  /** Edición bloqueada por completo si no hay usuario seleccionado o si está
   *  inactivo — profiles.activo es el mecanismo principal de bloqueo real
   *  (3D-7.7C); este flag es solo para no ofrecer una edición que además de
   *  no persistir todavía (este sprint), quedaría inerte igualmente. */
  const edicionBloqueada = !usuarioSeleccionado || usuarioSeleccionado.activo !== true;

  // Roles/excepciones con los que el usuario llegó a la pantalla (Sprint
  // 3D-7.11G, excepciones agregadas en 3D-7.11I) — derivados directamente de
  // usuarioSeleccionado (el dato tal cual lo cargó/actualizó el backend), no
  // un snapshot manual: se recalculan solos cuando usuarioSeleccionado
  // cambia — al elegir otro usuario, o al refrescarse en memoria tras un
  // guardado exitoso (ver ejecutarGuardado). Sirven de base de comparación
  // para "hay cambios pendientes" y como valor al que vuelve "Restablecer".
  const rolesOriginalIds = useMemo(
    () => new Set(usuarioSeleccionado?.roles_rbac.map(r => r.id) ?? []),
    [usuarioSeleccionado]
  );
  const grantsOriginalIds = useMemo(
    () => new Set((usuarioSeleccionado?.excepciones ?? []).filter(e => e.efecto === "grant").map(e => e.permiso_id)),
    [usuarioSeleccionado]
  );
  const revokesOriginalIds = useMemo(
    () => new Set((usuarioSeleccionado?.excepciones ?? []).filter(e => e.efecto === "revoke").map(e => e.permiso_id)),
    [usuarioSeleccionado]
  );

  function mismoConjunto(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  }

  const rolesCambiaron      = useMemo(() => !mismoConjunto(rolesSeleccionados, rolesOriginalIds), [rolesSeleccionados, rolesOriginalIds]);
  const excepcionesCambiaron = useMemo(
    () => !mismoConjunto(grantsLocales, grantsOriginalIds) || !mismoConjunto(revokesLocales, revokesOriginalIds),
    [grantsLocales, grantsOriginalIds, revokesLocales, revokesOriginalIds]
  );

  /**
   * Hay cambios pendientes (Sprint 3D-7.11G, excepciones corregidas en
   * 3D-7.11I) — comparación directa contra el estado con el que se entró a
   * la pantalla, no un flag acumulado que haya que ir marcando en cada
   * toggle: roles distintos a rolesOriginalIds, "Excepciones" activado (el
   * valor de entrada siempre es false), o grants/revokes distintos a los
   * que el usuario ya tenía guardados. Activar y luego desactivar
   * Excepciones sin tocar nada más (o marcar y desmarcar el mismo rol/
   * permiso) vuelve a coincidir con el estado de entrada — deja de contar
   * como cambio pendiente, sin necesidad de un caso especial.
   */
  const hayCambiosPendientes = useMemo(
    () => rolesCambiaron || excepcionesActivadas || excepcionesCambiaron,
    [rolesCambiaron, excepcionesActivadas, excepcionesCambiaron]
  );

  /** Descarta roles/excepciones/grants/revokes locales y vuelve exactamente
   *  al estado con el que se entró a la pantalla (mismo valor que ya aplica
   *  el efecto de reinicio al cambiar de usuario, pero invocable a mano sin
   *  cambiar de usuario). No toca busquedaPermiso — el buscador no es un
   *  "cambio pendiente" sobre el usuario, es solo un filtro de vista. */
  function restablecerCambios() {
    if (edicionBloqueada) return;
    setRolesSeleccionados(new Set(rolesOriginalIds));
    setExcepcionesActivadas(false);
    setGrantsLocales(new Set(grantsOriginalIds));
    setRevokesLocales(new Set(revokesOriginalIds));
  }

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

  // ── Guardado real (Sprint 3D-7.11I) ──────────────────────────────────────
  // Reutiliza exclusivamente actualizarRolesUsuario()/actualizarExcepcionesUsuario()
  // (services/api.ts) y los guards reforzados YA existentes en useUsuarios.ts
  // (tocaMaster/tocaGestionarExcepcion) — ningún endpoint, tabla ni regla de
  // seguridad nueva. Ver auditoría 3D-7.11H.
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  // true mientras se muestra la confirmación reforzada correspondiente —
  // mismo patrón/nombres que useUsuarios.ts, sin duplicar su lógica: aquí
  // solo se decide CUÁNDO mostrarla, la propia confirmación sigue siendo el
  // componente ModalConfirmarCambioMaster/ModalConfirmarExcepcionGestionar ya
  // existente (UsuariosPage.tsx los reutiliza igual).
  const [confirmarMaster, setConfirmarMaster] = useState(false);
  const [confirmarGestionarExcepcion, setConfirmarGestionarExcepcion] = useState(false);

  const rolIdMaster = useMemo(
    () => roles.find(r => r.nombre === NOMBRE_ROL_MASTER)?.id ?? null,
    [roles]
  );

  /** true si la selección actual agrega o quita el rol master respecto al
   *  estado original — dispara la confirmación reforzada (mismo criterio
   *  que useUsuarios.ts#tocaMaster). */
  const tocaMaster = useMemo(() => {
    if (!rolIdMaster) return false;
    return rolesOriginalIds.has(rolIdMaster) !== rolesSeleccionados.has(rolIdMaster);
  }, [rolIdMaster, rolesOriginalIds, rolesSeleccionados]);

  /** true si la operación agrega master (para el texto del modal); false si
   *  lo quita. Solo tiene sentido cuando tocaMaster es true. */
  const agregandoMaster = rolIdMaster !== null && rolesSeleccionados.has(rolIdMaster);

  const permisoIdGestionar = useMemo(
    () => permisos.find(p => p.nombre === NOMBRE_PERMISO_GESTIONAR)?.id ?? null,
    [permisos]
  );

  /** Efecto deseado para rbac:gestionar tras la edición actual, o null si no
   *  hay excepción configurada — mismo criterio que
   *  useUsuarios.ts#efectoDeseadoGestionar, sobre grantsLocales/revokesLocales
   *  en vez del Map de aquel hook. */
  const efectoDeseadoGestionar: "grant" | "revoke" | null = useMemo(() => {
    if (!permisoIdGestionar) return null;
    if (grantsLocales.has(permisoIdGestionar))  return "grant";
    if (revokesLocales.has(permisoIdGestionar)) return "revoke";
    return null;
  }, [permisoIdGestionar, grantsLocales, revokesLocales]);

  /** true si la selección actual agrega, modifica o quita una excepción
   *  sobre rbac:gestionar respecto al estado original — dispara la
   *  confirmación reforzada (mismo criterio que
   *  useUsuarios.ts#tocaGestionarExcepcion). */
  const tocaGestionarExcepcion = useMemo(() => {
    if (!permisoIdGestionar) return false;
    const actual = grantsOriginalIds.has(permisoIdGestionar)
      ? "grant"
      : revokesOriginalIds.has(permisoIdGestionar)
        ? "revoke"
        : null;
    return actual !== efectoDeseadoGestionar;
  }, [permisoIdGestionar, grantsOriginalIds, revokesOriginalIds, efectoDeseadoGestionar]);

  /**
   * Ejecuta el guardado real: roles primero, excepciones después (orden del
   * ticket) — ninguna de las dos se envía si esa parte no cambió. Si roles
   * falla, ni siquiera se intentan las excepciones. Si roles se guarda
   * correctamente pero excepciones falla, los roles YA guardados quedan
   * reflejados (en `usuarios` Y en el estado local de edición) y el error
   * deja explícito que los roles sí se guardaron — nunca se reporta éxito
   * total en ese escenario, y el usuario puede reintentar solo lo pendiente.
   *
   * Cada parte, al tener éxito, sincroniza EXPLÍCITAMENTE tanto `usuarios`
   * (fuente de rolesOriginalIds/grantsOriginalIds/revokesOriginalIds) como el
   * propio estado de edición local (rolesSeleccionados/grantsLocales/
   * revokesLocales) con la respuesta real del backend — no se depende del
   * efecto de arriba para este resincronizado: ese efecto está deliberadamente
   * bloqueado para el mismo usuario (ver su comentario) precisamente para no
   * borrar una edición pendiente ante un guardado parcial, así que la única
   * forma correcta de reflejar un éxito es actualizar aquí mismo, en el mismo
   * punto donde se conoce qué se guardó. Mismo patrón de "actualizar en
   * memoria con la respuesta del backend, sin refetch" que
   * useUsuarios.ts#ejecutarGuardado/ejecutarGuardadoExcepciones.
   */
  const ejecutarGuardado = useCallback(async () => {
    if (!usuarioSeleccionado || edicionBloqueada) return;
    setGuardando(true);
    setErrorGuardado(null);

    if (rolesCambiaron) {
      let rolesGuardados: UsuarioRbac["roles_rbac"];
      try {
        const resultado = await actualizarRolesUsuario(usuarioSeleccionado.id, [...rolesSeleccionados]);
        rolesGuardados = resultado.roles_rbac;
      } catch (e) {
        setErrorGuardado(e instanceof Error ? e.message : "Error al guardar los roles");
        setGuardando(false);
        return; // excepciones ni se intentan — orden estricto del ticket
      }
      setUsuarios(prev => prev.map(u => u.id === usuarioSeleccionado.id ? { ...u, roles_rbac: rolesGuardados } : u));
      setRolesSeleccionados(new Set(rolesGuardados.map(r => r.id)));
    }

    if (excepcionesCambiaron) {
      try {
        const body = [
          ...[...grantsLocales].map(permiso_id => ({ permiso_id, efecto: "grant" as const })),
          ...[...revokesLocales].map(permiso_id => ({ permiso_id, efecto: "revoke" as const })),
        ];
        const resultado = await actualizarExcepcionesUsuario(usuarioSeleccionado.id, body);
        const excepcionesGuardadas = resultado.excepciones.map(e => ({ permiso_id: e.permiso_id, nombre: e.nombre, efecto: e.efecto }));
        setUsuarios(prev => prev.map(u => u.id === usuarioSeleccionado.id ? { ...u, excepciones: excepcionesGuardadas } : u));
        setGrantsLocales(new Set(excepcionesGuardadas.filter(e => e.efecto === "grant").map(e => e.permiso_id)));
        setRevokesLocales(new Set(excepcionesGuardadas.filter(e => e.efecto === "revoke").map(e => e.permiso_id)));
      } catch (e) {
        // Los roles (si cambiaron) YA quedaron sincronizados arriba — el
        // mensaje deja explícito que esa parte sí se guardó, para no
        // reportar éxito total; un reintento solo reenviará las excepciones.
        const prefijo = rolesCambiaron ? "Los roles se guardaron correctamente. " : "";
        setErrorGuardado(`${prefijo}No se pudieron guardar las excepciones: ${e instanceof Error ? e.message : "error desconocido"}. Vuelve a intentarlo.`);
        setGuardando(false);
        return;
      }
    }

    // Éxito total (o no había nada que guardar): cierra cualquier
    // confirmación reforzada que estuviera abierta y vuelve el interruptor
    // "Excepciones" a su estado neutro (false) — es puramente de vista (no se
    // persiste, ver comentario del módulo), pero cuenta como "cambio
    // pendiente" en hayCambiosPendientes (3D-7.11G) mientras esté en true;
    // sin este reinicio, "Guardar cambios" quedaría habilitado para siempre
    // después de un guardado exitoso solo por seguir con la vista de
    // excepciones abierta, sin nada real que guardar — mismo criterio que ya
    // aplica restablecerCambios().
    setConfirmarMaster(false);
    setConfirmarGestionarExcepcion(false);
    setExcepcionesActivadas(false);
    setGuardando(false);
  }, [usuarioSeleccionado, edicionBloqueada, rolesCambiaron, rolesSeleccionados, excepcionesCambiaron, grantsLocales, revokesLocales]);

  /** Punto de entrada de "Guardar cambios" — pide confirmación reforzada
   *  primero si la operación toca master y/o rbac:gestionar (mismo criterio
   *  que useUsuarios.ts#guardarRoles/guardarExcepciones); si no, guarda
   *  directamente. Si ambas confirmaciones aplican, se piden en secuencia
   *  (master primero) — ver confirmarCambioMaster. */
  function guardarCambios() {
    if (edicionBloqueada || !hayCambiosPendientes) return;
    setErrorGuardado(null);
    if (tocaMaster) {
      setConfirmarMaster(true);
      return;
    }
    if (tocaGestionarExcepcion) {
      setConfirmarGestionarExcepcion(true);
      return;
    }
    void ejecutarGuardado();
  }

  /** Confirmación del modal de master: si la misma operación TAMBIÉN toca
   *  rbac:gestionar, encadena esa segunda confirmación reforzada en vez de
   *  guardar directamente — ninguna de las dos protecciones se salta. */
  function confirmarCambioMaster() {
    if (tocaGestionarExcepcion) {
      setConfirmarMaster(false);
      setConfirmarGestionarExcepcion(true);
      return;
    }
    void ejecutarGuardado();
  }

  function confirmarExcepcionGestionar() {
    void ejecutarGuardado();
  }

  /** Cancela cualquier confirmación reforzada abierta, sin guardar nada. */
  function cancelarConfirmacionGuardado() {
    if (guardando) return;
    setConfirmarMaster(false);
    setConfirmarGestionarExcepcion(false);
  }

  return {
    usuarios, roles, permisos, loading, error, cargar,
    usuarioSeleccionadoId, usuarioSeleccionado, seleccionarUsuario,
    rolesSeleccionados, toggleRol,
    excepcionesActivadas, toggleExcepcionesActivadas,
    grantsLocales, revokesLocales, toggleExcepcionPermiso,
    busquedaPermiso, setBusquedaPermiso,
    permisosHeredadosIds, permisosHeredados, permisosEfectivosIds, permisosPorModulo,
    edicionBloqueada,
    hayCambiosPendientes, restablecerCambios,
    guardando, errorGuardado, guardarCambios,
    tocaMaster, agregandoMaster, confirmarMaster, confirmarCambioMaster, cancelarConfirmacionGuardado,
    tocaGestionarExcepcion, efectoDeseadoGestionar, confirmarGestionarExcepcion, confirmarExcepcionGestionar,
  };
}
