import { req } from "@/services/http";
import type { TmsViaje, ViajeDetalle } from "../types";

export function listarViajes(): Promise<TmsViaje[]> {
  return req<TmsViaje[]>("/api/viajes");
}

export function getViajePorTripNumber(tripNumber: string): Promise<ViajeDetalle> {
  return req<ViajeDetalle>(`/api/viajes/${encodeURIComponent(tripNumber)}`);
}
