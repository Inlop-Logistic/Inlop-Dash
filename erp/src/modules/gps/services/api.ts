import { req } from "@/services/http";
import type { GpsRecord, EstadoGps } from "../types";
import {
  ESTADOS_MONITOREABLES,
  GPS_THRESHOLD_DETENIDO,
  GPS_THRESHOLD_DESCONECTADO,
} from "../constants";
import { parseFechaMDY } from "@/utils/parseFecha";

interface _TmsRaw {
  trip_number:              string;
  number_order:             string | null;
  license_plate:            string | null;
  driver_name:              string | null;
  company_customer_name:    string | null;
  origin_city_name:         string | null;
  destiny_city_name:        string | null;
  state_travel:             string;
  latitude:                 string | null;
  longitude:                string | null;
  latest_gps_report:        string | null;
  current_address_location: string | null;
  last_alarm_name:          string | null;
}

function derivarEstadoGps(v: _TmsRaw): EstadoGps {
  const alarm = (v.last_alarm_name ?? "").toLowerCase();
  if (alarm.includes("pánico") || alarm.includes("panico")) return "panico";
  if (v.last_alarm_name)                                     return "con_alarma";

  const ts = parseFechaMDY(v.latest_gps_report);
  if (!ts) return "desconectado";

  const horas = (Date.now() - ts.getTime()) / 3_600_000;
  if (horas > GPS_THRESHOLD_DESCONECTADO) return "desconectado";
  if (horas > GPS_THRESHOLD_DETENIDO)     return "detenido";
  return "activo";
}

function toGpsRecord(v: _TmsRaw): GpsRecord {
  const lat = v.latitude  ? parseFloat(v.latitude)  : null;
  const lon = v.longitude ? parseFloat(v.longitude) : null;
  return {
    id:                    v.trip_number,
    trip_number:           v.trip_number,
    number_order:          v.number_order,
    license_plate:         v.license_plate,
    driver_name:           v.driver_name,
    company_customer_name: v.company_customer_name,
    origin_city_name:      v.origin_city_name,
    destiny_city_name:     v.destiny_city_name,
    state_travel:          v.state_travel,
    lat:                   lat !== null && !isNaN(lat) ? lat : null,
    lon:                   lon !== null && !isNaN(lon) ? lon : null,
    latest_gps_report:     v.latest_gps_report,
    current_address_location: v.current_address_location,
    last_alarm_name:       v.last_alarm_name,
    estadoGps:             derivarEstadoGps(v),
  };
}

/** Retorna todos los vehículos activos del TMS con datos GPS enriquecidos. */
export async function listarVehiculosGps(): Promise<GpsRecord[]> {
  const viajes = await req<_TmsRaw[]>("/api/data");
  return viajes
    .filter((v) => ESTADOS_MONITOREABLES.has((v.state_travel ?? "").toLowerCase()))
    .map(toGpsRecord);
}
