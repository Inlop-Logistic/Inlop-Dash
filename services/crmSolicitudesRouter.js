/**
 * Receptor autenticado CRM → ERP.
 * La resolución y escritura de empresa + solicitud ocurre en una RPC transaccional.
 */
import express from "express";
import { validateCrmSolicitud } from "./crmSolicitudContractValidator.js";

function jsonError(res, status, error, extra = {}) {
  return res.status(status).json({ error, ...extra });
}

export function createCrmSolicitudesRouter({
  apiKey,
  receiveCrmSolicitud,
  mapTipoVehiculo,
}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("CRM_INGESTION_API_KEY debe configurarse antes de crear el router");
  }
  for (const [name, fn] of Object.entries({ receiveCrmSolicitud, mapTipoVehiculo })) {
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
      const result = await receiveCrmSolicitud({
        ...p,
        crm_solicitud_id: p.crm_solicitud_id.trim(),
        crm_cliente_id: p.crm_cliente_id.trim(),
        cliente_nombre: p.cliente_nombre.trim(),
        creador_email: p.creador_email.trim().toLowerCase(),
        tipo_vehiculo: tipoVehiculo.trim(),
        tipo_operacion: p.tipo_operacion.trim().toLowerCase(),
        origen: p.origen.trim(),
        destino: p.destino.trim(),
        external_ref: p.external_ref.trim(),
      });

      const outcome = Array.isArray(result) ? result[0] : result;
      if (!outcome || typeof outcome !== "object") {
        return jsonError(res, 502, "No se pudo confirmar la persistencia de la solicitud");
      }

      if (outcome.ok === false) {
        if (outcome.error_code === "creator_not_found") {
          return jsonError(res, 422, "El correo del creador CRM no corresponde a un usuario del ERP", {
            codigo: outcome.error_code,
          });
        }
        if (outcome.error_code === "creator_ambiguous") {
          return jsonError(res, 409, "El correo del creador coincide con varios usuarios del ERP", {
            codigo: outcome.error_code,
          });
        }
        if (outcome.error_code === "customer_identity_conflict") {
          return jsonError(res, 409, "El ID del cliente CRM está asociado a una empresa distinta", {
            codigo: outcome.error_code,
          });
        }
        return jsonError(res, 422, "El ERP no pudo validar los datos de la solicitud", {
          codigo: outcome.error_code || "crm_request_rejected",
        });
      }

      if (outcome.duplicada) {
        return res.status(200).json({
          ok: true,
          duplicada: true,
          crm_solicitud_id: p.crm_solicitud_id,
          codigo_solicitud: outcome.codigo_solicitud,
          solicitud_id: outcome.solicitud_id,
          empresa_cliente_id: outcome.empresa_cliente_id,
        });
      }

      if (!outcome.solicitud_id || !outcome.empresa_cliente_id || !outcome.codigo_solicitud) {
        return jsonError(res, 502, "El ERP no confirmó los identificadores de empresa y solicitud");
      }

      return res.status(201).json({
        ok: true,
        duplicada: false,
        crm_solicitud_id: p.crm_solicitud_id,
        crm_cliente_id: p.crm_cliente_id,
        empresa_cliente_id: outcome.empresa_cliente_id,
        solicitud_id: outcome.solicitud_id,
        codigo_solicitud: outcome.codigo_solicitud,
        empresa_creada: outcome.empresa_creada === true,
      });
    } catch (error) {
      const message = String(error?.message || "");
      console.error("Error receptor CRM solicitudes:", message || "error desconocido");
      // La RPC lanza excepción para forzar rollback completo cuando falla la agencia.
      if (message.includes("agency_not_found")) {
        return jsonError(res, 422, "La agencia seleccionada no existe o no está activa en el ERP para esta empresa", {
          codigo: "agency_not_found",
        });
      }
      if (message.includes("agency_ambiguous")) {
        return jsonError(res, 409, "La agencia seleccionada no se puede resolver de forma única en el ERP", {
          codigo: "agency_ambiguous",
        });
      }
      return jsonError(res, 502, "Error interno al recibir la solicitud CRM");
    }
  });

  return router;
}
