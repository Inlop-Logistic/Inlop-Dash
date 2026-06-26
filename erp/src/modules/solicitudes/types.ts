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
}

export interface HistorialEstado {
  estado: string;
  cambiado_en: string;
  cambiado_por: string | null;
  notas: string | null;
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
}
