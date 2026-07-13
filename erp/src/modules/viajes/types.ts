/** Valores posibles del campo state_travel recibidos del TMS. */
export type EstadoViaje =
  | "en transíto"
  | "iniciado"
  | "descargando"
  | "cargando"
  | "completado"
  | "pernoctando"
  | "finalizado"
  | "cancelado"
  | "sin activar"
  | "sin asignar";

/** Objeto de viaje recibido de GET /api/viajes. */
export interface TmsViaje {
  trip_number: string;
  id_monitoring_order: string | null;
  /** Número de remisión / manifiesto. */
  number_order: string | null;
  license_plate: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  /** Campo compuesto "NOMBRE, TELÉFONO" que llega en algunos registros del TMS. */
  full_driver: string | null;
  /** Nombre de empresa tal como llega del TMS — sin normalizar. */
  company_customer_name: string | null;
  origin_city_name: string | null;
  destiny_city_name: string | null;
  type_operation: string | null;
  stops: string | null;
  state_travel: string;
  /** Porcentaje de avance 0–100; puede llegar como string o number. */
  percentage_travel: string | number | null;
  last_event: string | null;
  appointment_fulfillment: string | null;
  latitude: string | null;
  longitude: string | null;
  /** Formato TMS: MM/DD/YYYY HH:MM:SS — usar parseFechaMDY. */
  latest_gps_report: string | null;
  current_address_location: string | null;
  last_alarm_name: string | null;
  /** Formato TMS: MM/DD/YYYY HH:MM:SS — usar parseFechaMDY. */
  created_on: string | null;
  /** Formato TMS: DD/MM/YYYY HH:MM:SS — usar parseFechaDMY. */
  activated_on: string | null;

  // Campos de alarma — reservados para expansión futura del TMS.
  alarm_priority?:    string | null;
  alarm_code?:        string | null;
  alarm_description?: string | null;
}

/** Evento derivado o real para el timeline cronológico del viaje. */
export interface TmsEvent {
  id:           string;
  label:        string;
  description?: string | null;
  timestamp?:   string | null;
  status:       "completed" | "active" | "pending" | "cancelled";
}

/** KPIs calculados del array de viajes activos. */
export interface KpisViaje {
  total: number;
  activos: number;
  enCargue: number;
  enRuta: number;
  enDescargue: number;
  finalizados: number;
  conNovedad: number;
}
