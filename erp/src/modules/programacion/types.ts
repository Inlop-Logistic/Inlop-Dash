export type EstadoProgramacion = "programado" | "cancelado";

export interface ViajeResumen {
  trip_number: string;
  license_plate: string | null;
  driver_name: string | null;
  /** Valor original recibido del TMS. Conservado para auditoría y trazabilidad. */
  company_customer_name: string | null;
  /** Nombre oficial resuelto por el backend: razon_social cuando homologado, company_customer_name como fallback. */
  nombre_cliente: string | null;
  empresa_cliente_id: string | null;
  city_origin: string | null;
  city_destination: string | null;
  origin_address: string | null;
  schedulate_origin: string | null;
  fecha_programada_dia: string | null;
  activo_en_resume: boolean;
  fecha_detectado: string;
  estado_programacion: EstadoProgramacion;
  observaciones: string | null;
  /** Tipo de servicio derivado: 'Urbano' si Origen == Destino, 'Nacional' si difieren. */
  tipo_servicio: string | null;
  /** Teléfono normalizado del conductor — disponible cuando el viaje está activo en Resume. */
  conductor_tel: string | null;
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
