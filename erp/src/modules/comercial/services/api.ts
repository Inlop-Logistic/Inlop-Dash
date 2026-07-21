import { req } from "@/services/http";
import type { ClienteListItem, CambioEstadoPayload, NuevoClienteFormData } from "../types";

export function listarClientes(): Promise<ClienteListItem[]> {
  return req<ClienteListItem[]>("/api/clientes");
}

export function getClienteById(id: string): Promise<ClienteListItem> {
  return req<ClienteListItem>(`/api/clientes/${encodeURIComponent(id)}`);
}

export function crearCliente(data: NuevoClienteFormData): Promise<ClienteListItem> {
  return req<ClienteListItem>("/api/clientes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarCliente(id: string, data: Partial<NuevoClienteFormData>): Promise<ClienteListItem> {
  return req<ClienteListItem>(`/api/clientes/${encodeURIComponent(id)}`, {
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
