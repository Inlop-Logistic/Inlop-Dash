import { req } from "@/services/http";
import type { TmsViaje } from "../types";

export function listarViajes(): Promise<TmsViaje[]> {
  return req<TmsViaje[]>("/api/viajes");
}
