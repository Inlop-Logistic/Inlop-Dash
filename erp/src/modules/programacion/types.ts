export type EstadoProgramacion = "programado" | "cancelado";

export interface ViajeResumen {
  trip_number: string;
  license_plate: string | null;
  driver_name: string | null;
  company_customer_name: string | null;
  city_origin: string | null;
  city_destination: string | null;
  origin_address: string | null;
  schedulate_origin: string | null;
  fecha_programada_dia: string | null;
  activo_en_resume: boolean;
  fecha_detectado: string;
  estado_programacion: EstadoProgramacion;
  observaciones: string | null;
}

export interface SolicitudVinculada {
  id: string;
  codigo_solicitud: string;
  external_ref: string | null;
  canal: string | null;
  creado_en: string;
  fecha_confirmacion: string | null;
  estado: string;
  solicitante: string | null;
  cliente: string;
  agencia: string;
}

export type SolicitudVinculadaResult =
  | { vinculada: false }
  | ({ vinculada: true } & SolicitudVinculada);
