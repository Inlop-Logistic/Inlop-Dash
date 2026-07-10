// ─── AUTHORIZATION SCOPE ────────────────────────────────────────────────────
// Sprint 4.7 — Unified Authorization Scope (arquitectura aprobada tras la
// Auditoría 4.6). Única fuente de verdad para resolver y aplicar el alcance
// (empresa + agencia) de un usuario autenticado del Portal Cliente sobre la
// tabla `solicitudes`. Reemplaza las validaciones repetidas — y en un caso
// ausentes (GET /servicios/:id/vehiculo) — que existían antes en cada
// endpoint de /servicios* por separado.
//
// No depende de Express (req/res): recibe sus dependencias explícitas
// (sbFetch) para poder reutilizarse fuera de un handler HTTP y para ser
// testeable de forma aislada. Ver CLAUDE.md §5.5 y
// docs/architecture/ARCHITECTURE_DECISIONS.md ADR-007 (appclienteinlop) y
// docs/ARQUITECTURA.md (este repo) para el contexto completo de la decisión.

// Roles con visibilidad de TODA la empresa (todas sus agencias), no solo las
// asignadas vía usuario_agencias. Expandir aquí — nunca con un `if` disperso
// en cada endpoint — es la única forma soportada de agregar un rol futuro
// con este mismo privilegio.
const ROLES_CON_ACCESO_TOTAL_EMPRESA = new Set(['admin_cliente']);

/**
 * Resuelve el Scope de autorización de un usuario ya autenticado: qué
 * empresa y qué agencias puede ver/tocar. Usa la misma fuente de datos
 * (usuario_agencias) que ya usa buildSessionData() para construir
 * permisos.agencia_ids — no introduce una fuente de verdad nueva, centraliza
 * la existente.
 *
 * @param {{ userId: string, empresaId: string, perfil: { rol?: string } }} args
 * @param {{ sbFetch: (path: string) => Promise<any> }} deps
 * @returns {Promise<{ empresaId: string, agenciaIds: string[]|null, rol: string, esAdmin: boolean }>}
 *   agenciaIds === null significa "sin restricción de agencia" (todas las de
 *   la empresa) — solo aplica a roles en ROLES_CON_ACCESO_TOTAL_EMPRESA.
 */
async function resolverScopeUsuario({ userId, empresaId, perfil }, { sbFetch }) {
  const rol = perfil.rol || 'encargado';
  const esAdmin = ROLES_CON_ACCESO_TOTAL_EMPRESA.has(rol);

  if (esAdmin) {
    return { empresaId, agenciaIds: null, rol, esAdmin };
  }

  const asignadas = await sbFetch(
    `/usuario_agencias?usuario_id=eq.${encodeURIComponent(userId)}&select=agencia_id`
  ) || [];
  return { empresaId, agenciaIds: asignadas.map(a => a.agencia_id), rol, esAdmin };
}

/**
 * Construye el filtro PostgREST de empresa+agencia para `solicitudes` a
 * partir de un Scope ya resuelto. Todo endpoint de /servicios* construye su
 * WHERE a través de esta función — nunca repite la comparación de
 * empresa_cliente_id/agencia_id de forma manual.
 *
 * @param {{ empresaId: string, agenciaIds: string[]|null }} scope
 * @param {{ agenciaId?: string }} [opciones] — filtro adicional pedido por el
 *   cliente (selector de agencia en Filtros Avanzados). Se INTERSECTA con el
 *   scope, nunca lo amplía: si el usuario pide una agencia fuera de su
 *   scope, el resultado es "ninguna fila", no "todas las de su scope".
 * @returns {string|null} querystring PostgREST (sin `/solicitudes?` inicial),
 *   o null si el usuario no tiene ninguna agencia visible — el llamador debe
 *   responder vacío/404 sin ejecutar ninguna consulta.
 */
function construirFiltroScope(scope, opciones = {}) {
  let agenciaIds = scope.agenciaIds; // null = sin restricción

  if (opciones.agenciaId) {
    agenciaIds = agenciaIds === null
      ? [opciones.agenciaId]
      : agenciaIds.filter(id => id === opciones.agenciaId);
  }

  if (agenciaIds !== null && agenciaIds.length === 0) return null;

  let qs = `empresa_cliente_id=eq.${encodeURIComponent(scope.empresaId)}`;
  if (agenciaIds !== null) {
    qs += `&agencia_id=in.(${agenciaIds.map(encodeURIComponent).join(',')})`;
  }
  return qs;
}

/**
 * Trae una solicitud por id, ya acotada al Scope del usuario. Devuelve null
 * tanto si el id no existe como si existe pero está fuera del scope — el
 * llamador SIEMPRE responde 404 en ambos casos, nunca 403: no se confirma a
 * un usuario sin acceso que el recurso existe en otra empresa/agencia.
 *
 * @param {string} id
 * @param {{ empresaId: string, agenciaIds: string[]|null }} scope
 * @param {{ sbFetch: (path: string) => Promise<any>, select?: string }} deps
 */
async function obtenerSolicitudEnScope(id, scope, { sbFetch, select }) {
  const filtro = construirFiltroScope(scope);
  if (filtro === null) return null;
  const selectQs = select ? `&select=${select}` : '';
  const rows = await sbFetch(`/solicitudes?id=eq.${encodeURIComponent(id)}&${filtro}${selectQs}&limit=1`) || [];
  return rows[0] || null;
}

export {
  ROLES_CON_ACCESO_TOTAL_EMPRESA,
  resolverScopeUsuario,
  construirFiltroScope,
  obtenerSolicitudEnScope,
};
