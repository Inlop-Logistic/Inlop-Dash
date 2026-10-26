/**
 * Contrato de entrada CRM → ERP.
 *
 * Este módulo solo valida y normaliza el payload; no escribe en Supabase,
 * no crea clientes y no envía solicitudes a ningún servicio.
 */
const TEXT_FIELDS = [
  'crm_solicitud_id',
  'crm_cliente_id',
  'cliente_nombre',
  'tipo_vehiculo',
  'tipo_operacion',
  'origen',
  'destino',
  'external_ref',
  'canal',
];

export function validarSolicitudCrm(payload) {
  const errores = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errores: ['El cuerpo debe ser un objeto JSON.'] };
  }

  for (const field of TEXT_FIELDS) {
    if (typeof payload[field] !== 'string' || !payload[field].trim()) {
      errores.push(`"${field}" es obligatorio y debe ser texto no vacío.`);
    }
  }

  if (payload.canal !== 'CRM') {
    errores.push('"canal" debe ser exactamente "CRM".');
  }

  if (typeof payload.fecha_requerida !== 'string' ||
      !payload.fecha_requerida.trim() ||
      Number.isNaN(Date.parse(payload.fecha_requerida))) {
    errores.push('"fecha_requerida" debe ser una fecha ISO válida con zona horaria.');
  } else if (!/(Z|[+-]\\d{2}:\\d{2})$/i.test(payload.fecha_requerida)) {
    errores.push('"fecha_requerida" debe incluir Z o un desplazamiento horario explícito.');
  }

  if (payload.agencia !== undefined &&
      (payload.agencia === null || typeof payload.agencia !== 'object' || Array.isArray(payload.agencia))) {
    errores.push('"agencia" debe ser un objeto cuando se suministra.');
  }

  if (payload.metadata !== undefined &&
      (payload.metadata === null || typeof payload.metadata !== 'object' || Array.isArray(payload.metadata))) {
    errores.push('"metadata" debe ser un objeto cuando se suministra.');
  }

  if (payload.external_ref && payload.crm_solicitud_id &&
      payload.external_ref !== `CRM:${payload.crm_solicitud_id}`) {
    errores.push('"external_ref" debe ser "CRM:" seguido de crm_solicitud_id.');
  }

  if (payload.metadata?.crm_solicitud_id &&
      payload.metadata.crm_solicitud_id !== payload.crm_solicitud_id) {
    errores.push('metadata.crm_solicitud_id debe coincidir con crm_solicitud_id.');
  }

  if (errores.length) return { ok: false, errores };

  return {
    ok: true,
    solicitud: {
      ...payload,
      crm_solicitud_id: payload.crm_solicitud_id.trim(),
      crm_cliente_id: payload.crm_cliente_id.trim(),
      cliente_nombre: payload.cliente_nombre.trim(),
      external_ref: payload.external_ref.trim(),
      canal: 'CRM',
    },
  };
}
