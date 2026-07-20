import { req } from "@/services/http";
import type { ClienteListItem } from "../types";

export function listarClientes(): Promise<ClienteListItem[]> {
  return req<ClienteListItem[]>("/api/clientes");
}

export function getClienteById(id: string): Promise<ClienteListItem> {
  return req<ClienteListItem>(`/api/clientes/${encodeURIComponent(id)}`);
}
