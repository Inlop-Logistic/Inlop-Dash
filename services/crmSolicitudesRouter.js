/**
 * Receptor aislado CRM → ERP.
 *
 * No crea clientes maestros ni se monta automáticamente en index.js.
 * Requiere que el integrador proporcione una función atómica para el código
 * de solicitud y un mapeo explícito del catálogo de vehículos. Se mantiene
 * separado hasta validar el esquema real y decidir el servicio de despliegue.
 */
import express from "express";
import { validateCrmSolicitud } from "./crmSolicitudContractValidator.js";

function jsonError(res, status, error, extra = {}) {
  return res.status(status).json({ error, ...extra });
}

export function createCrmSolicitudesRouter({
  apiKey,
  insertIfAbsent,
  findByCrmSolicitudId,
  createCodigoSolicitud,
  mapTipoVehiculo,
  now = () => new Date().toISOString(),
}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("CRM_INGESTION_API_KEY debe configurarse antes de crear el router");
  }
  for (const [name, fn] of Object.entries({
    insertIfAbsent, findByCrmSolicitudId, createCodigoSolicitud, mapTipoVehiculo,
  })) {
    if (typeof fn !== "function") throw new TypeError(`${name} debe ser una función`);
  }

  const router = express.Router();
  router.post("/solicitudes", async (req, res) => {
    if (req.get("x-crm-api-key") !== apiKey) {
      return jsonError(res, 401, "No autorizado");
    }

    const validation = validateCrmSolicitud(req.body);
    if (!validation.ok) {
      return jsonError(res, 400, "Contrato CRM inválido", { detalles: validation.errors });
    }

    const p = req.body;
    const tipoVehiculo = mapTipoVehiculo(p.tipo_vehiculo);
    if (typeof tipoVehiculo !== "string" || !tipoVehiculo.trim()) {
      return jsonError(res, 422, "Tipo de vehículo CRM sin mapeo aprobado", {
        campo: "tipo_vehiculo",
      });
    }

    try {
      const existente = await findByCrmSolicitudId(p.crm_solicitud_id);
      if (existente) {
        return res.status(200).json({
          ok: true, duplicada: true,
          crm_solicitud_id: p.crm_solicitud_id,
          codigo_solicitud: existente.codigo_solicitud ?? null,
          solicitud_id: existente.id ?? null,
        });
      }

      const codigoSolicitud = await createCodigoSolicitud();
      if (typeof codigoSolicitud !== "string" || !codigoSolicitud.trim()) {
        return jsonError(res, 503, "No fue posible generar un código de solicitud");
      }

      // Importante: no se usa el ID de agencia CRM como FK ERP y no se llama
      // a resolveCustomer/POST /api/clientes. El nombre externo se conserva.
      const row = {
        codigo_solicitud: codigoSolicitud,
        crm_solicitud_id: p.crm_solicitud_id.trim(),
        crm_cliente_id: p.crm_cliente_id.trim(),
        cliente_nombre_externo: p.cliente_nombre.trim(),
        cliente_nit_externo: typeof p.cliente_nit === "string" ? p.cliente_nit.trim() : null,
        empresa_cliente_id: null,
        creado_por: null,
        tipo_vehiculo: tipoVehiculo.trim(),
        tipo_operacion: p.tipo_operacion.trim().toLowerCase(),
        origen: p.origen.trim(),
        destino: p.destino.trim(),
        agencia_id: null,
        agencia_nombre: p.agencia.nombre.trim(),
        external_ref: p.external_ref.trim(),
        fecha_requerida: p.fecha_requerida,
        observacion_coordinadora: typeof p.observaciones_cliente === "string"
          ? p.observaciones_cliente.trim() : null,
        metadata: {
          ...(p.metadata && typeof p.metadata === "object" ? p.metadata : {}),
          origen_integracion: "CRM",
        },
        estado: "pendiente",
        canal: "CRM",
        creado_en: now(),
      };

      const inserted = await insertIfAbsent(row);
      if (inserted?.id || inserted?.codigo_solicitud) {
        return res.status(201).json({
          ok: true, duplicada: false,
          crm_solicitud_id: p.crm_solicitud_id,
          codigo_solicitud: inserted.codigo_solicitud ?? codigoSolicitud,
          solicitud_id: inserted.id ?? null,
        });
      }

      // Un conflicto concurrente puede haber ganado después de la primera
      // consulta. Volver a leer la clave estable para responder idempotente.
      const concurrente = await findByCrmSolicitudId(p.crm_solicitud_id);
      if (concurrente) {
        return res.status(200).json({
          ok: true, duplicada: true,
          crm_solicitud_id: p.crm_solicitud_id,
          codigo_solicitud: concurrente.codigo_solicitud ?? null,
          solicitud_id: concurrente.id ?? null,
        });
      }
      return jsonError(res, 502, "No se pudo confirmar la persistencia de la solicitud");
    } catch (error) {
      // No devolver detalles de infraestructura ni datos sensibles al emisor.
      console.error("Error receptor CRM solicitudes:", error?.message || "error desconocido");
      return jsonError(res, 502, "Error interno al recibir la solicitud CRM");
    }
  });

  return router;
}
