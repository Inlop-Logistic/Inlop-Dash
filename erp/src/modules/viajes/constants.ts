import type { TmsViaje } from "./types";

/** Intervalo de auto-refresco en milisegundos (igual al REFRESH de la plataforma de monitoreo). */
export const REFRESH_INTERVAL_MS = 120_000;

/** Configuración visual por estado del TMS. */
export const ESTADO_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  "en transíto": { label: "En Ruta",      color: "#1D4ED8", bg: "#DBEAFE",           dot: "#3B82F6" },
  iniciado:      { label: "Iniciado",      color: "#0F766E", bg: "#CCFBF1",           dot: "#14B8A6" },
  descargando:   { label: "Descargando",   color: "#0369A1", bg: "#E0F2FE",           dot: "#0EA5E9" },
  cargando:      { label: "En Cargue",     color: "#7C3AED", bg: "#EDE9FE",           dot: "#8B5CF6" },
  completado:    { label: "Completado",    color: "#059669", bg: "#D1FAE5",           dot: "#10B981" },
  pernoctando:   { label: "Pernoctando",   color: "#92400E", bg: "#FEF3C7",           dot: "#F59E0B" },
  finalizado:    { label: "Finalizado",    color: "var(--gray-500)", bg: "var(--gray-100)", dot: "var(--gray-400)" },
  cancelado:     { label: "Cancelado",     color: "#DC2626", bg: "#FEE2E2",           dot: "#EF4444" },
  "sin activar": { label: "Sin activar",   color: "var(--gray-500)", bg: "var(--gray-100)", dot: "var(--gray-400)" },
  "sin asignar": { label: "Sin asignar",   color: "var(--gray-400)", bg: "var(--gray-50)",  dot: "var(--gray-300)" },
};

/** Estados que se consideran "activos" para KPIs y filtros. */
export const ESTADOS_ACTIVOS = new Set([
  "en transíto", "iniciado", "descargando", "cargando", "pernoctando",
]);

/** Estados que se consideran "finalizados". */
export const ESTADOS_FINALIZADOS = new Set(["completado", "finalizado"]);

/** Tabs de la bandeja. */
export const TABS = [
  { id: "todos",       label: "Todos"        },
  { id: "activos",     label: "Activos"      },
  { id: "enRuta",      label: "En Ruta"      },
  { id: "finalizados", label: "Finalizados"  },
  { id: "conNovedad",  label: "Con Novedad"  },
] as const;

export type TabViajes = (typeof TABS)[number]["id"];

/** Detecta si un viaje tiene alarma de pánico activa. */
export function esPanico(v: Pick<TmsViaje, "last_alarm_name">): boolean {
  const alarm = (v.last_alarm_name ?? "").toLowerCase();
  return alarm.includes("pánico") || alarm.includes("panico");
}

/** Conteo de registros para cada tab. */
export function tabCount(data: TmsViaje[], tabId: string): number {
  const st = (v: TmsViaje) => (v.state_travel ?? "").toLowerCase();
  if (tabId === "todos")       return data.length;
  if (tabId === "activos")     return data.filter((v) => ESTADOS_ACTIVOS.has(st(v))).length;
  if (tabId === "enRuta")      return data.filter((v) => st(v) === "en transíto").length;
  if (tabId === "finalizados") return data.filter((v) => ESTADOS_FINALIZADOS.has(st(v))).length;
  if (tabId === "conNovedad")  return data.filter((v) => !!v.last_alarm_name).length;
  return 0;
}
