/**
 * src/vehiculos.ts — Lógica pura de presentación sobre VehiculoPublico[]
 * (Fase 10C). Nunca decide autorización — eso ya lo resolvió el backend
 * (services/gps/gpsSeguimiento.js#obtenerVehiculosAutorizados) antes de que
 * este array llegue al cliente. Aquí solo se busca, ordena y clasifica lo
 * que el backend ya autorizó.
 */
import type { VehiculoPublico, EstadoGps } from "./types";

/** Un vehículo autorizado puede no tener posición GPS activa ahora mismo
 *  (viaje monitoreable pero sin lat/lon todavía reportada por el TMS) —
 *  ver docs/REPORTES_SEGUIMIENTO_GPS_ARQUITECTURA.md §1.2/§6.2. Nunca se
 *  trata como error: es un estado de datos legítimo. */
export function tieneGpsActivo(v: VehiculoPublico): boolean {
  return v.lat != null && v.lon != null && Number.isFinite(v.lat) && Number.isFinite(v.lon);
}

/** Coincidencia por placa — buscador de la vista externa (case/acentos-insensible
 *  a nivel de mayúsculas; las placas no llevan acentos, solo se normaliza caso). */
export function coincidePlaca(v: VehiculoPublico, termino: string): boolean {
  const t = termino.trim().toUpperCase();
  if (!t) return true;
  return (v.placa ?? "").toUpperCase().includes(t);
}

export function filtrarPorPlaca(vehiculos: VehiculoPublico[], termino: string): VehiculoPublico[] {
  return vehiculos.filter(v => coincidePlaca(v, termino));
}

/** Orden de urgencia — igual criterio visual que ESTADO_GPS_CFG del ERP:
 *  lo que necesita atención primero (pánico/alarma), luego operativo normal,
 *  y al final lo que no está reportando. */
const PRIORIDAD_ESTADO: Record<EstadoGps, number> = {
  panico: 0,
  con_alarma: 1,
  activo: 2,
  detenido: 3,
  desconectado: 4,
};

export function ordenarVehiculos(vehiculos: VehiculoPublico[]): VehiculoPublico[] {
  return [...vehiculos].sort((a, b) => {
    // Con GPS activo siempre antes que sin GPS, sin importar el estado reportado.
    const gpsA = tieneGpsActivo(a) ? 0 : 1;
    const gpsB = tieneGpsActivo(b) ? 0 : 1;
    if (gpsA !== gpsB) return gpsA - gpsB;
    const pa = PRIORIDAD_ESTADO[a.estado] ?? 99;
    const pb = PRIORIDAD_ESTADO[b.estado] ?? 99;
    if (pa !== pb) return pa - pb;
    return (a.placa ?? "").localeCompare(b.placa ?? "");
  });
}
