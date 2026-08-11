import { req } from "@/services/http";
import type { ReporteAutomatico, ReporteBase, PersonalInlop } from "../types";

export function listarReportesAutomaticos(): Promise<ReporteAutomatico[]> {
  return req<ReporteAutomatico[]>("/api/reportes-automaticos");
}

/**
 * Personal INLOP disponible como destinatario de reportes — proyectado por
 * el backend desde `personal` (el maestro real de personal de INLOP,
 * independiente de Auth — ver SQL_04_personal.sql). Ver GET /api/personal
 * en index.js.
 */
export function listarPersonal(): Promise<PersonalInlop[]> {
  return req<PersonalInlop[]>("/api/personal");
}

export function crearReporteAutomatico(data: ReporteBase): Promise<ReporteAutomatico> {
  return req<ReporteAutomatico>("/api/reportes-automaticos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarReporteAutomatico(
  id: string,
  data: Partial<ReporteBase>
): Promise<ReporteAutomatico> {
  return req<ReporteAutomatico>(`/api/reportes-automaticos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function toggleReporteActivo(
  id: string,
  activo: boolean
): Promise<{ ok: boolean; activo: boolean }> {
  return req<{ ok: boolean; activo: boolean }>(
    `/api/reportes-automaticos/${encodeURIComponent(id)}/activo`,
    { method: "PATCH", body: JSON.stringify({ activo }) }
  );
}
