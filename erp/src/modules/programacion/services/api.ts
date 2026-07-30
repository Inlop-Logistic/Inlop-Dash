import { req } from "@/services/http";
import type { ViajeResumen, EstadoProgramacion, SolicitudVinculadaResult } from "../types";

export function listarProgramacion(desde: string, hasta: string) {
  return req<ViajeResumen[]>(`/api/programacion?desde=${desde}&hasta=${hasta}`);
}

export function cambiarEstadoProgramacion(id: string, estado: EstadoProgramacion) {
  return req<void>(`/api/programacion/${encodeURIComponent(id)}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}

export function guardarObservacion(id: string, observaciones: string) {
  return req<void>(`/api/programacion/${encodeURIComponent(id)}/observaciones`, {
    method: "PATCH",
    body: JSON.stringify({ observaciones }),
  });
}

export function obtenerSolicitudVinculada(tripNumber: string) {
  return req<SolicitudVinculadaResult>(`/api/programacion/${encodeURIComponent(tripNumber)}/solicitud`);
}

export function sincronizarViaje(tripNumber: string) {
  return req<{ ok: boolean; activo_en_resume: boolean; estado_programacion: EstadoProgramacion }>(
    `/api/programacion/${encodeURIComponent(tripNumber)}/sync`,
    { method: "POST" },
  );
}
