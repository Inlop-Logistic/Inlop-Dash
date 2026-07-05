import type { ViajeResumen } from "./types";

export const ESTADO_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  programado: { label: "Programado",  color: "#374151",           bg: "var(--gray-100)",  dot: "var(--gray-400)" },
  asignado:   { label: "Asignado",    color: "#1D4ED8",           bg: "#DBEAFE",          dot: "var(--info)"     },
  vencido:    { label: "Sin activar", color: "#92400E",           bg: "#FEF3C7",          dot: "#F59E0B"         },
  cancelado:  { label: "Cancelado",   color: "var(--gray-600)",   bg: "var(--gray-100)",  dot: "var(--gray-400)" },
};

export const TABS = [
  { id: "todos",      label: "Todos"      },
  { id: "programado", label: "Programado" },
  { id: "asignado",   label: "Asignado"   },
  { id: "cancelado",  label: "Cancelado"  },
];

/** Estado visual derivado (para badges y filtros): combina estado_programacion + activo_en_resume + tiempo. */
export function estadoVisual(v: ViajeResumen): string {
  if (v.estado_programacion === "cancelado") return "cancelado";
  if (v.activo_en_resume) return "asignado";
  if (v.schedulate_origin && new Date(v.schedulate_origin) < new Date()) return "vencido";
  return "programado";
}

/** Conteo por tab considerando el estado derivado. */
export function tabCount(data: ViajeResumen[], tabId: string): number {
  if (tabId === "todos")      return data.length;
  if (tabId === "programado") return data.filter((v) => !v.activo_en_resume && v.estado_programacion !== "cancelado").length;
  if (tabId === "asignado")   return data.filter((v) => v.activo_en_resume).length;
  if (tabId === "cancelado")  return data.filter((v) => v.estado_programacion === "cancelado").length;
  return 0;
}
