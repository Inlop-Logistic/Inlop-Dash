import type { ModuloId, NavPayload, NavigationDestination } from "./types";
import { MODULOS_IMPLEMENTADOS } from "./types";

function to(modulo: ModuloId, payload: NavPayload, originModule: ModuloId): NavigationDestination {
  return { modulo, payload, originModule };
}

/** Fábrica de destinos de navegación con tipado seguro. */
export const navActions = {
  verViaje:        (tripNumber: string,    from: ModuloId) => to("viajes",       { tripNumber },    from),
  verProgramacion: (tripNumber: string,    from: ModuloId) => to("programacion", { tripNumber },    from),
  verSolicitud:    (solicitudId: string,   from: ModuloId) => to("solicitudes",  { solicitudId },   from),
  verGps:          (licensePlate: string, tripNumber: string, from: ModuloId) =>
                     to("gps",            { licensePlate, tripNumber },          from),
  verVehiculo:     (licensePlate: string,  from: ModuloId) => to("vehiculos",    { licensePlate },  from),
  verConductor:    (driverId: string,      from: ModuloId) => to("conductores",  { driverId },      from),
  verCliente:      (clienteId: string,     from: ModuloId) => to("clientes",     { clienteId },     from),
  verCumplidos:    (tripNumber: string,    from: ModuloId) => to("cumplidos",    { tripNumber },    from),

  /** true si el módulo ya tiene navegación activa. */
  implementado: (modulo: ModuloId): boolean => MODULOS_IMPLEMENTADOS.has(modulo),
};
