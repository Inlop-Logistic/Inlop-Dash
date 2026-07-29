import type { ViajeResumen } from "./types";

export const ESTADO_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  programado:  { label: "Programado",   color: "#374151",           bg: "var(--gray-100)",  dot: "var(--gray-400)" },
  asignado:    { label: "Asignado",     color: "#1D4ED8",           bg: "#DBEAFE",          dot: "var(--info)"     },
  en_ruta:     { label: "En ruta",      color: "#065F46",           bg: "#D1FAE5",          dot: "#10B981"         },
  completado:  { label: "Completado",   color: "#1E3A5F",           bg: "#DBEAFE",          dot: "var(--navy)"     },
  cancelado:   { label: "Cancelado",    color: "var(--gray-600)",   bg: "var(--gray-100)",  dot: "var(--gray-400)" },
  sin_asignar: { label: "Sin asignar",  color: "#92400E",           bg: "#FEF3C7",          dot: "#F59E0B"         },
};

export const TABS = [
  { id: "todos",       label: "Todos"        },
  { id: "programado",  label: "Programado"   },
  { id: "asignado",    label: "Asignado"     },
  { id: "en_ruta",     label: "En ruta"      },
  { id: "completado",  label: "Completado"   },
  { id: "cancelado",   label: "Cancelado"    },
  { id: "sin_asignar", label: "Sin asignar"  },
];

/** Estado visual: lee directamente del campo authoritative del backend. */
export function estadoVisual(v: ViajeResumen): string {
  return v.estado_programacion ?? "programado";
}

/** Conteo por tab usando estado_programacion como fuente de verdad. */
export function tabCount(data: ViajeResumen[], tabId: string): number {
  if (tabId === "todos") return data.length;
  return data.filter((v) => v.estado_programacion === tabId).length;
}
