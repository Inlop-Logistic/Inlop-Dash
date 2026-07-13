import type { EstadoGps } from "./types";

export const REFRESH_INTERVAL_MS = 60_000;

/** Thresholds de freshness GPS en horas. */
export const GPS_THRESHOLD_DETENIDO    = 2;   // > 2h → detenido
export const GPS_THRESHOLD_DESCONECTADO = 6;  // > 6h → desconectado

/** Configuración visual + color de marcador por estado GPS. */
export const ESTADO_GPS_CFG: Record<EstadoGps, {
  label:    string;
  color:    string;
  bg:       string;
  dot:      string;
  mapColor: string;
}> = {
  activo:       { label: "Activo",       color: "#065F46", bg: "#D1FAE5", dot: "#059669", mapColor: "#059669" },
  detenido:     { label: "Detenido",     color: "#92400E", bg: "#FEF3C7", dot: "#D97706", mapColor: "#D97706" },
  con_alarma:   { label: "Con alarma",   color: "#9F1239", bg: "#FFE4E6", dot: "#DC2626", mapColor: "#DC2626" },
  panico:       { label: "Pánico",       color: "#5B21B6", bg: "#EDE9FE", dot: "#7C3AED", mapColor: "#7C3AED" },
  desconectado: { label: "Desconectado", color: "var(--gray-500)", bg: "var(--gray-100)", dot: "var(--gray-400)", mapColor: "#9CA3AF" },
};

/** Estados de viaje que incluir en el Centro de Monitoreo. */
export const ESTADOS_MONITOREABLES = new Set([
  "en transíto", "iniciado", "descargando", "cargando", "pernoctando",
]);

/** Tabs de la lista de vehículos. */
export const TABS_GPS = [
  { id: "todos",      label: "Todos"       },
  { id: "activos",    label: "Activos"     },
  { id: "detenidos",  label: "Detenidos"   },
  { id: "alarmas",    label: "Alarmas"     },
  { id: "sin_senial", label: "Sin señal"   },
] as const;

export type TabGps = (typeof TABS_GPS)[number]["id"];
