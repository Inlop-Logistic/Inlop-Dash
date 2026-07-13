import { req } from "@/services/http";
import type { GpsRecord } from "../types";

export function listarVehiculosGps(): Promise<GpsRecord[]> {
  return req<GpsRecord[]>("/api/gps");
}
