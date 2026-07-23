import { req } from "@/services/http";
import type { CumplidoRecord } from "../types";

export function listarCumplidos(): Promise<CumplidoRecord[]> {
  return req<CumplidoRecord[]>("/api/cumplidos");
}
