/**
 * Estado derivado del vehículo en el Centro de Monitoreo.
 * Se calcula en la capa de servicio a partir de GPS freshness y alarmas.
 */
export type EstadoGps =
  | "activo"
  | "detenido"
  | "con_alarma"
  | "panico"
  | "desconectado";

/**
 * Registro de vehículo enriquecido para el Centro de Monitoreo.
 * Derivado de TmsViaje con lat/lon parseados y estadoGps calculado.
 */
export interface GpsRecord {
  id:                    string;   // = trip_number
  trip_number:           string;
  number_order:          string | null;
  license_plate:         string | null;
  driver_name:           string | null;
  company_customer_name: string | null;
  empresa_cliente_id:    string | null;
  razon_social:          string | null;
  origin_city_name:      string | null;
  destiny_city_name:     string | null;
  state_travel:          string;
  lat:                   number | null;
  lon:                   number | null;
  latest_gps_report:     string | null;
  current_address_location: string | null;
  last_alarm_name:       string | null;
  estadoGps:             EstadoGps;
}

/** KPIs del Centro de Monitoreo calculados sobre todos los registros. */
export interface KpisGps {
  total:        number;
  activos:      number;
  detenidos:    number;
  sinReporte:   number;
  conAlarmas:   number;
  panico:       number;
  desconectados: number;
}
