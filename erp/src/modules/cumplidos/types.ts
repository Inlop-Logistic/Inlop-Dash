/** Estado del expediente documental asociado a un viaje cumplido. */
export type EstadoDocumental =
  | "pendiente"
  | "en_revision"
  | "con_observaciones"
  | "aprobado"
  | "rechazado"
  | "listo_facturacion";

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
  origin_city_name:      string | null;
  destiny_city_name:     string | null;
  state_travel:          string;
  /** DD/MM/YYYY HH:MM:SS */
  activated_on:          string | null;
  /** MM/DD/YYYY HH:MM:SS */
  created_on:            string | null;
  fecha_cumplido:        string | null;

  // Expediente documental
  estado_documental:  EstadoDocumental;
  documentos:         DocumentoCheck[];
  observaciones:      string | null;
  responsable:        string | null;
  fecha_validacion:   string | null;
  aprobado_por:       string | null;
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
