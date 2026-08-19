import { req, getAuthHeaders } from "@/services/http";
import type { CumplidoRecord, SoporteCumplido } from "../types";

export function listarCumplidos(): Promise<CumplidoRecord[]> {
  return req<CumplidoRecord[]>("/api/cumplidos");
}

export function listarSoportesCumplido(
  trip: string,
): Promise<{ documentos: SoporteCumplido[] }> {
  return req<{ documentos: SoporteCumplido[] }>(
    `/api/cumplidos/${encodeURIComponent(trip)}/documentos`,
  );
}

// Los headers HTTP no garantizan tránsito UTF-8 — texto libre con tildes/ñ se
// codifica en base64 antes de enviarse, y el backend lo decodifica.
function toB64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function headersSoporte(file: File, descripcion: string, usuario: string): HeadersInit {
  return {
    "Content-Type":        file.type || "application/octet-stream",
    "X-Filename-B64":      toB64(file.name),
    "X-Descripcion-B64":   toB64(descripcion),
    "X-Usuario-B64":       toB64(usuario),
  };
}

async function fetchBinario(path: string, method: string, file: File, headers: HeadersInit) {
  const API_URL = import.meta.env.VITE_API_URL as string;
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...headers, ...authHeaders },
    body: file,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(b.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function subirSoporteCumplido(
  trip:        string,
  file:        File,
  descripcion: string,
  usuario:     string,
  placa:       string,
): Promise<{ ok: boolean; documento: SoporteCumplido }> {
  return fetchBinario(
    `/api/cumplidos/${encodeURIComponent(trip)}/documentos`,
    "POST",
    file,
    { ...headersSoporte(file, descripcion, usuario), "X-Placa": placa },
  );
}

export function reemplazarSoporteCumplido(
  trip:        string,
  id:          string,
  file:        File,
  usuario:     string,
  placa:       string,
): Promise<{ ok: boolean; documento: SoporteCumplido }> {
  return fetchBinario(
    `/api/cumplidos/${encodeURIComponent(trip)}/documentos/${encodeURIComponent(id)}/reemplazar`,
    "PUT",
    file,
    {
      "Content-Type":   file.type || "application/octet-stream",
      "X-Filename-B64": toB64(file.name),
      "X-Usuario-B64":  toB64(usuario),
      "X-Placa":        placa,
    },
  );
}

export function urlFirmadaSoporte(
  trip:      string,
  id:        string,
  descargar = false,
): Promise<{ url: string }> {
  return req<{ url: string }>(
    `/api/cumplidos/${encodeURIComponent(trip)}/documentos/${encodeURIComponent(id)}/sign` +
    (descargar ? "?download=1" : ""),
  );
}

export function eliminarSoporteCumplido(
  trip: string,
  id:   string,
): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>(
    `/api/cumplidos/${encodeURIComponent(trip)}/documentos/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function actualizarEstadoCumplido(
  trip:            string,
  estado_cumplido: string,
  fecha_cumplido?: string,
): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>(
    `/api/cumplidos/${encodeURIComponent(trip)}/estado`,
    {
      method: "PATCH",
      body: JSON.stringify({
        estado_cumplido,
        ...(fecha_cumplido ? { fecha_cumplido } : {}),
      }),
    },
  );
}
