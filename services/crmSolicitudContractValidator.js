/**
 * Contrato de entrada CRM: validación pura, sin llamadas de red ni escrituras.
 */
const REQUIRED_TEXT = [
  "crm_solicitud_id", "crm_cliente_id", "cliente_nombre", "creador_email",
  "tipo_vehiculo", "tipo_operacion", "origen", "destino", "fecha_requerida", "external_ref",
];

export function validateCrmSolicitud(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, errors: ["El cuerpo debe ser un objeto JSON"] };
  }
  for (const field of REQUIRED_TEXT) {
    if (typeof payload[field] !== "string" || !payload[field].trim()) {
      errors.push(`'${field}' es obligatorio y debe ser texto`);
    }
  }
  if (typeof payload.creador_email === "string" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.creador_email.trim())) {
    errors.push("'creador_email' debe ser un correo válido");
  }
  if (payload.canal !== "CRM") errors.push("'canal' debe ser exactamente 'CRM'");
  if (!payload.agencia || typeof payload.agencia !== "object" || Array.isArray(payload.agencia)) {
    errors.push("'agencia' debe ser un objeto con id y nombre");
  } else {
    if (payload.agencia.id != null && typeof payload.agencia.id !== "string") {
      errors.push("'agencia.id' debe ser texto o null");
    }
    if (typeof payload.agencia.nombre !== "string" || !payload.agencia.nombre.trim()) {
      errors.push("'agencia.nombre' es obligatorio");
    }
  }
  if (typeof payload.fecha_requerida === "string" &&
      (!payload.fecha_requerida.trim() || Number.isNaN(new Date(payload.fecha_requerida).getTime()))) {
    errors.push("'fecha_requerida' debe ser una fecha ISO válida");
  }
  if (payload.metadata != null &&
      (typeof payload.metadata !== "object" || Array.isArray(payload.metadata))) {
    errors.push("'metadata' debe ser un objeto cuando se envía");
  }
  if (typeof payload.crm_solicitud_id === "string" && typeof payload.external_ref === "string" &&
      payload.external_ref.trim() !== `CRM:${payload.crm_solicitud_id.trim()}`) {
    errors.push("'external_ref' debe coincidir con 'CRM:' + crm_solicitud_id");
  }
  return { ok: errors.length === 0, errors };
}
