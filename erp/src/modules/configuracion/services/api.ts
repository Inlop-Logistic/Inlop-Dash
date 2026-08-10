import { req } from "@/services/http";
import type { ReporteAutomatico, ReporteBase } from "../types";

export function listarReportesAutomaticos(): Promise<ReporteAutomatico[]> {
  return req<ReporteAutomatico[]>("/api/reportes-automaticos");
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
