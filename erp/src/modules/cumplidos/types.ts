/** Estado del expediente documental asociado a un viaje cumplido. */
export type EstadoDocumental =
  | "pendiente"
  | "en_revision"
  | "con_observaciones"
  | "aprobado"
  | "rechazado"
  | "listo_facturacion";

/** Tipos de documento del bucket Supabase `cumplidos` (según TorreControl). */
export type TipoDocumento = "remesa" | "cumplido" | "manifiesto" | "evidencias" | "tiquete" | "gut";

/** Archivo almacenado en el bucket `cumplidos` para un viaje. */
export interface DocumentoArchivo {
  nombre:     string;
  ruta:       string;
  size:       number;
  mimetype:   string;
  created_at: string | null;
  updated_at: string | null;
}

/** Ítem individual del checklist documental. */
export interface DocumentoCheck {
  id:         string;
  label:      string;
  requerido:  boolean;
  presente:   boolean;
}

/** Registro de cumplido: combina datos del viaje con expediente documental. */
export interface CumplidoRecord {
  /** Identificador único — mismo que trip_number del viaje. */
  id:                    string;
  trip_number:           string;
  number_order:          string | null;
  company_customer_name: string | null;
  license_plate:         string | null;
  driver_name:           string | null;
  conductor_tel:         string | null;
  /** Valor original de type_operation del TMS — determina la línea de negocio. */
  type_operation:        string | null;
  origin_city_name:      string | null;
  destiny_city_name:     string | null;
  state_travel:          string;
  /** MM/DD/YYYY HH:MM:SS — formato TMS (mismo campo que en TmsViaje). */
  activated_on:          string | null;
  /** MM/DD/YYYY HH:MM:SS */
  created_on:            string | null;
  fecha_cumplido:        string | null;

  // Expediente documental (ERP)
  estado_documental:  EstadoDocumental;
  documentos:         DocumentoCheck[];
  observaciones:      string | null;
  responsable:        string | null;
  fecha_validacion:   string | null;
  aprobado_por:       string | null;

  // Campos del sistema TorreControl (bucket Supabase)
  /** Estado operativo según TorreControl: PENDIENTE / SOLICITADO / CUMPLIDO RECIBIDO / etc. */
  estado_cumplido:  string | null;
  /** Indica si hay al menos un documento subido al bucket. */
  tiene_soporte:    boolean;
  /** Observaciones libres registradas en TorreControl. */
  obs:              string | null;
  /** URL del soporte registrado en TorreControl. */
  link_soporte:     string | null;
}

/** KPIs calculados del conjunto filtrado activo. */
export interface KpisCumplidos {
  total:       number;
  pendientes:  number;
  finalizados: number;
  cumplidos:   number;
  liquidados:  number;
  facturados:  number;
}
