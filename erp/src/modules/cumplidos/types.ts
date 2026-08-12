/** Estado del expediente documental asociado a un viaje cumplido. */
export type EstadoDocumental =
  | "pendiente"
  | "en_revision"
  | "con_observaciones"
  | "aprobado"
  | "rechazado"
  | "listo_facturacion";

/**
 * Tipos de documento conocidos — misma lista que usa el backend
 * (TIPOS_DOCUMENTO_CUMPLIDO en index.js) para inferir el tipo a partir de la
 * descripción. `null` significa "soporte general", sin tipo asignado.
 */
export type TipoDocumento = "remesa" | "cumplido" | "manifiesto" | "evidencias" | "tiquete" | "gut";

/**
 * Soporte de cumplido — metadata persistida en la tabla `cumplidos_documentos`.
 * El archivo físico vive en Storage bajo un nombre UUID opaco; este objeto es
 * la única fuente de verdad que el frontend usa para mostrarlo y operarlo.
 */
export interface SoporteCumplido {
  id:              string;
  nombre_generado: string;
  nombre_original: string;
  descripcion:     string | null;
  tipo_documento:  TipoDocumento | null;
  tamano_bytes:    number;
  mime_type:       string | null;
  usuario:         string | null;
  creado_en:       string;
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

  /** Estado real del expediente documental — persistido en Supabase (ver refrescarEstadoSoportes en index.js). */
  estado_documental:  EstadoDocumental;

  // Campos del sistema TorreControl (bucket Supabase)
  /** Estado operativo según TorreControl: PENDIENTE / SOLICITADO / CUMPLIDO RECIBIDO / etc. */
  estado_cumplido:  string | null;
  /** Indica si hay al menos un soporte cargado. */
  tiene_soporte:    boolean;
  /** Observaciones libres registradas en TorreControl. */
  obs:              string | null;
  /** URL del soporte registrado en TorreControl (campo legado, solo lectura). */
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
