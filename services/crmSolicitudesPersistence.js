/**
 * Adaptador PostgREST para persistir solicitudes CRM de forma idempotente.
 *
 * No se conecta por sí solo: recibe sbFetch y un generador de código seguro
 * inyectados por el backend. La tabla debe tener UNIQUE(crm_solicitud_id).
 */
const SELECT_BY_SOURCE = "id,codigo_solicitud,crm_solicitud_id";

export function createCrmSolicitudesPersistence({ sbFetch, createCodigoSolicitud }) {
  if (typeof sbFetch !== "function") throw new TypeError("sbFetch debe ser una función");
  if (typeof createCodigoSolicitud !== "function") {
    throw new TypeError("createCodigoSolicitud debe ser una función");
  }

  async function findByCrmSolicitudId(crmSolicitudId) {
    const qs = new URLSearchParams({
      select: SELECT_BY_SOURCE,
      crm_solicitud_id: `eq.${crmSolicitudId}`,
      limit: "1",
    });
    const rows = await sbFetch(`/solicitudes?${qs.toString()}`);
    if (!Array.isArray(rows)) throw new Error("No se pudo consultar la solicitud CRM");
    return rows[0] ?? null;
  }

  async function insertIfAbsent(row) {
    // La unicidad de BD es la defensa contra carreras. Prefer ignore-duplicates
    // evita que un reintento transforme una solicitud existente en otra fila.
    const qs = new URLSearchParams({ on_conflict: "crm_solicitud_id" });
    const rows = await sbFetch(
      `/solicitudes?${qs.toString()}`,
      "POST",
      row,
      { Prefer: "resolution=ignore-duplicates,return=representation" },
    );
    if (!Array.isArray(rows)) throw new Error("No se pudo confirmar la inserción CRM");
    return rows[0] ?? null;
  }

  return {
    findByCrmSolicitudId,
    insertIfAbsent,
    createCodigoSolicitud,
  };
}
