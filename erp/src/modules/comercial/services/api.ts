import { req } from "@/services/http";
import type { ClienteListItem, ClienteDetalle, CambioEstadoPayload, NuevoClienteFormData, MergePreview, ClienteAlias } from "../types";

export function listarClientes(): Promise<ClienteListItem[]> {
  return req<ClienteListItem[]>("/api/clientes");
}

export function getClienteById(id: string): Promise<ClienteDetalle> {
  return req<ClienteDetalle>(`/api/clientes/${encodeURIComponent(id)}`);
}

export function crearCliente(data: NuevoClienteFormData): Promise<ClienteListItem> {
  return req<ClienteListItem>("/api/clientes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarCliente(id: string, data: Partial<NuevoClienteFormData>): Promise<ClienteDetalle> {
  return req<ClienteDetalle>(`/api/clientes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoCliente(id: string, payload: CambioEstadoPayload): Promise<{ ok: boolean; estado: string }> {
  return req<{ ok: boolean; estado: string }>(`/api/clientes/${encodeURIComponent(id)}/estado`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getMergePreview(oficialId: string, duplicadoId: string): Promise<MergePreview> {
  return req<MergePreview>(
    `/api/clientes/${encodeURIComponent(oficialId)}/merge-preview?duplicado_id=${encodeURIComponent(duplicadoId)}`
  );
}

export function mergeCliente(
  oficialId: string,
  duplicadoId: string,
  motivo?: string
): Promise<{ ok: boolean; oficial_id: string; duplicado_id: string; identity_rules_created: number }> {
  return req(`/api/clientes/${encodeURIComponent(oficialId)}/merge`, {
    method: "POST",
    body: JSON.stringify({ duplicado_id: duplicadoId, motivo }),
  });
}

// ── Alias (Identity Rules) ────────────────────────────────────────────────────

export function getAliases(clienteId: string): Promise<ClienteAlias[]> {
  return req<ClienteAlias[]>(`/api/clientes/${encodeURIComponent(clienteId)}/alias`);
}

export function crearAlias(
  clienteId: string,
  data: { nombre_raw: string; integracion?: string; observacion?: string }
): Promise<ClienteAlias> {
  return req<ClienteAlias>(`/api/clientes/${encodeURIComponent(clienteId)}/alias`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function toggleAlias(
  clienteId: string,
  aliasId: string,
  activo: boolean
): Promise<{ ok: boolean; activo: boolean }> {
  return req<{ ok: boolean; activo: boolean }>(
    `/api/clientes/${encodeURIComponent(clienteId)}/alias/${encodeURIComponent(aliasId)}`,
    { method: "PATCH", body: JSON.stringify({ activo }) }
  );
}
