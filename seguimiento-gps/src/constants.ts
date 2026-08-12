import type { EstadoGps } from "./types";

/**
 * Mismas 5 llaves/colores que ESTADO_GPS_CFG en erp/src/modules/gps/constants.ts
 * — el CÓMPUTO del estado (derivarEstadoGps) vive solo en el backend; esta
 * app, como el ERP, únicamente necesita saber cómo pintar cada valor. No es
 * un segundo proveedor GPS: es la misma tabla de presentación, redeclarada
 * porque este proyecto Vite es independiente del ERP (ver vite.config.ts).
 */
export const ESTADO_GPS_CFG: Record<EstadoGps, { label: string; color: string; bg: string; dot: string; mapColor: string }> = {
  activo:       { label: "En movimiento", color: "#065F46", bg: "#D1FAE5", dot: "#059669", mapColor: "#059669" },
  detenido:     { label: "Detenido",      color: "#92400E", bg: "#FEF3C7", dot: "#D97706", mapColor: "#D97706" },
  con_alarma:   { label: "Con alarma",    color: "#9F1239", bg: "#FFE4E6", dot: "#DC2626", mapColor: "#DC2626" },
  panico:       { label: "Alerta",        color: "#5B21B6", bg: "#EDE9FE", dot: "#7C3AED", mapColor: "#7C3AED" },
  desconectado: { label: "Sin señal",     color: "#475569", bg: "#F1F5F9", dot: "#94A3B8", mapColor: "#94A3B8" },
};

/** Cada cuánto se refresca /api/seguimiento-gps/vehiculos mientras la
 *  pestaña está visible. El backend solo refresca su propio snapshot de
 *  ControlT cada 60s (syncViajes, index.js) — pedir más seguido que eso no
 *  trae datos más nuevos, solo gasta cupo del rate limit público (120/10min
 *  por IP, ver routes/gpsSeguimiento.js) y batería en móvil. */
export const INTERVALO_POLL_MS = 20_000;

/** Longitud del código OTP — services/gps/otp.js siempre genera 6 dígitos. */
export const LONGITUD_OTP = 6;

export const NOMBRE_APP = "Seguimiento GPS";
