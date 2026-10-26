/**
 * Adaptador PostgREST para recibir una solicitud CRM mediante una única RPC.
 * La función SQL resuelve/crea la empresa por crm_cliente_id, resuelve el
 * creador por correo y guarda la solicitud en la misma transacción.
 */
export function createCrmSolicitudesPersistence({ sbFetch }) {
  if (typeof sbFetch !== "function") throw new TypeError("sbFetch debe ser una función");

  async function receiveCrmSolicitud(payload) {
    const result = await sbFetch("/rpc/recibir_solicitud_crm", "POST", {
      p_payload: payload,
    });
    if (result == null) {
      throw new Error("La RPC recibir_solicitud_crm no confirmó la operación");
    }
    return result;
  }

  return { receiveCrmSolicitud };
}
