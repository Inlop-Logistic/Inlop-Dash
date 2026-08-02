export type EstadoSolicitud =
  | "pendiente"
  | "aprobado"
  | "en_ruta"
  | "completado"
  | "cancelado";

export interface Solicitud {
  id: string;
  codigo_solicitud: string;
  external_ref: string | null;
  canal: string;
  creado_en: string;
  solicitante: string | null;
  cliente: string;
  agencia: string;
  tipo_vehiculo: string;
  tipo_operacion: "urbana" | "nacional";
  origen: string;
  destino: string;
  fecha_requerida: string;
  estado: EstadoSolicitud;
  /** Conductor/responsable asignado cuando hay viaje vinculado en ControlT. */
  conductor_nombre: string | null;
  /** Trip number de ControlT vinculado a esta solicitud (cuando existe). */
  controlt_trip_number: string | null;
  /** Nombre del planificador INLOP — enriquecido client-side desde GET /api/viajes/:tripNumber. */
  planificado_por_nombre: string | null;
}

export interface HistorialEstado {
  estado: string;
  cambiado_en: string;
  cambiado_por: string | null;
  notas: string | null;
}

export interface ActorAccion {
  id: string | null;
  nombre: string | null;
  fecha: string;
  origen: "erp" | "app_cliente" | "sistema";
}

export interface SolicitudDetalle extends Solicitud {
  conductor_nombre: string | null;
  conductor_cedula: string | null;
  conductor_telefono: string | null;
  conductor_licencia: string | null;
  vehiculo_placa: string | null;
  vehiculo_tipo: string | null;
  vehiculo_capacidad: string | null;
  historial: HistorialEstado[];
  actualizado_en: string | null;
  fecha_inicio_ruta: string | null;
  fecha_fin_ruta: string | null;
  notas: string | null;
  distancia_km: number | null;
  // Campos adicionales del detalle enriquecido
  controlt_trip_number: string | null;
  pct: number | null;
  fecha_confirmacion: string | null;
  fecha_cancelacion: string | null;
  fecha_programada: string | null;
  // Disponibilidad en módulos relacionados
  in_programacion: boolean;
  in_viajes:       boolean;
  in_cumplidos:    boolean;
}
