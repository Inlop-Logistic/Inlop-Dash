/**
 * src/types.ts — Contrato con la API pública de Fase 10B (services/gps/,
 * routes/gpsSeguimiento.js). No se inventa ningún campo — este archivo es
 * un espejo literal de las formas de respuesta ya implementadas en 10B.
 */

/** Mismos 5 valores que EstadoGps en erp/src/modules/gps/types.ts — el
 *  cómputo (derivarEstadoGps) vive en el backend, aquí solo se tipa. */
export type EstadoGps = "activo" | "detenido" | "con_alarma" | "panico" | "desconectado";

/** Proyección pública de un vehículo — ver proyectarVehiculoPublico() en
 *  services/gps/gpsSeguimiento.js. Deliberadamente NO incluye IDs internos,
 *  cliente/empresa, ni teléfono (10B no lo expone todavía — ver README). */
export interface VehiculoPublico {
  placa: string | null;
  conductor: string | null;
  estado: EstadoGps;
  estadoViaje: string | null;
  lat: number | null;
  lon: number | null;
  ultimaActualizacion: string | null; // formato TMS MDY crudo — usar parseFechaTMS/gpsRelativo
  ubicacion: string | null;
  origen: string | null;
  destino: string | null;
  alarma: string | null;
  manifiesto: string | null;
  /** No provisto por 10B hoy — placeholder para cuando exista una política
   *  explícita de exponer contacto (ver CONTACTO en el prompt de 10C). Las
   *  acciones Llamar/WhatsApp solo se renderizan si este campo llega. */
  telefono?: string | null;
}

export interface RespuestaValidarEnlace {
  ok: true;
  /** Solo el conteo de placas del enlace — nunca la lista, nunca correos,
   *  nunca IDs — antes de verificar el OTP (ver routes/gpsSeguimiento.js). */
  vehiculos: number;
}

export interface RespuestaSolicitarOtp {
  ok: true;
  mensaje: string;
}

export interface RespuestaValidarOtp {
  ok: true;
  sesion: string;
  expiraEn: string;
}

export interface RespuestaVehiculos {
  ok: true;
  vehiculos: VehiculoPublico[];
}

export interface RespuestaError {
  error: string;
}

/**
 * Sesión activa persistida en sessionStorage — ver src/session.ts.
 * `enlaceToken` ata la sesión guardada al enlace de la URL con el que se
 * generó — si el usuario abre en la misma pestaña un enlace DISTINTO
 * (otro reporte), la sesión vieja nunca se reutiliza para el nuevo token
 * aunque ambas convivan en el mismo sessionStorage del origen.
 */
export interface SesionActiva {
  enlaceToken: string;
  sesionToken: string;
  expiraEn: string;
  correo: string;
}
