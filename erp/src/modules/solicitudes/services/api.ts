import { req } from "@/services/http";
import type { Solicitud, SolicitudDetalle } from "../types";

export function getSolicitudes(desde: string, hasta: string) {
  return req<Solicitud[]>(`/api/solicitudes?desde=${desde}&hasta=${hasta}`);
}

export function getSolicitudDetalle(id: string) {
  return req<SolicitudDetalle>(`/api/solicitudes/${encodeURIComponent(id)}`);
}

export function cambiarEstadoSolicitud(
  id: string,
  estado: string,
  extra: Record<string, unknown> = {}
) {
  return req(`/api/solicitudes/${encodeURIComponent(id)}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado, ...extra }),
  });
}
