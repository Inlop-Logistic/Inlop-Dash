import { req } from "@/services/http";
import type { CumplidoRecord, DocumentoArchivo } from "../types";

export function listarCumplidos(): Promise<CumplidoRecord[]> {
  return req<CumplidoRecord[]>("/api/cumplidos");
}

export function listarDocumentosCumplido(
  trip: string,
): Promise<{ archivos: DocumentoArchivo[] }> {
  return req<{ archivos: DocumentoArchivo[] }>(
    `/api/cumplidos/${encodeURIComponent(trip)}/documentos`,
  );
}

export async function subirDocumentoCumplido(
  trip:  string,
  tipo:  string,
  placa: string,
  file:  File,
): Promise<{ ok: boolean; filename: string; path: string }> {
  const API_URL = import.meta.env.VITE_API_URL as string;
  const KEY     = import.meta.env.VITE_INTERNAL_API_KEY as string | undefined;
  const res = await fetch(
    `${API_URL}/api/cumplidos/${encodeURIComponent(trip)}/documentos`,
    {
      method: "POST",
      headers: {
        "Content-Type":       file.type || "application/octet-stream",
        "X-Tipo-Documento":   tipo,
        "X-Placa":            placa,
        "X-Filename":         file.name,
        ...(KEY ? { "X-Internal-Api-Key": KEY } : {}),
      },
      body: file,
    },
  );
  if (!res.ok) {
    const b = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(b.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function eliminarDocumentoCumplido(
  trip:     string,
  filename: string,
): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>(
    `/api/cumplidos/${encodeURIComponent(trip)}/documentos/${encodeURIComponent(filename)}`,
    { method: "DELETE" },
  );
}

export function urlFirmadaDocumento(
  trip:     string,
  filename: string,
): Promise<{ url: string }> {
  return req<{ url: string }>(
    `/api/cumplidos/${encodeURIComponent(trip)}/documentos/${encodeURIComponent(filename)}/sign`,
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
