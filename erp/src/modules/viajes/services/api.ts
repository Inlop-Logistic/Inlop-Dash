import { req } from "@/services/http";
import type { TmsViaje } from "../types";

/** Retorna la lista de viajes activos desde el TMS vía backend. */
export function listarViajes(): Promise<TmsViaje[]> {
  return req<TmsViaje[]>("/api/data");
}
