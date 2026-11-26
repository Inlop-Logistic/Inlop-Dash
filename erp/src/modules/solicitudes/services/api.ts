import { req, getAuthHeaders } from "@/services/http";
import type { Solicitud, SolicitudDetalle } from "../types";

export interface SolicitudesPageResult {
  data: Solicitud[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  kpis: { total: number; pendientes: number; enRuta: number; finalizadas: number };
}

export interface SolicitudesFilters {
  desde: string;
  hasta: string;
  page: number;
  pageSize: number;
  estado?: string;
  busqueda?: string;
  cliente?: string;
}

function queryString(filters: SolicitudesFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export function getClientesSolicitudes() {
  return req<string[]>("/api/erp/solicitudes/clientes");
}

export function getSolicitudes(filters: SolicitudesFilters) {
  return req<SolicitudesPageResult>(`/api/erp/solicitudes?${queryString(filters)}`);
}

export async function exportarSolicitudes(filters: Omit<SolicitudesFilters, "page" | "pageSize">) {
  const baseUrl = import.meta.env.VITE_API_URL as string;
  const headers = await getAuthHeaders();
  const response = await fetch(`${baseUrl}/api/erp/solicitudes/export?${queryString({ ...filters, page: 1, pageSize: 100 })}`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `solicitudes_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
