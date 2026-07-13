import { req } from "@/services/http";
import type { CumplidoRecord } from "../types";
import { ESTADOS_CUMPLIBLES, DOCUMENTOS_BASE } from "../constants";

/**
 * Estructura mínima del TMS que necesitamos para derivar un CumplidoRecord.
 * No importamos TmsViaje de viajes para mantener los módulos desacoplados.
 */
interface _TmsViajeRaw {
  trip_number:           string;
  number_order:          string | null;
  company_customer_name: string | null;
  license_plate:         string | null;
  driver_name:           string | null;
  origin_city_name:      string | null;
  destiny_city_name:     string | null;
  state_travel:          string;
  activated_on:          string | null;
  created_on:            string | null;
}

/**
 * Deriva un CumplidoRecord desde datos del TMS.
 * Los campos documentales se inicializan con valores por defecto hasta que
 * el backend exponga /api/cumplidos con el expediente completo.
 */
function derivarCumplido(v: _TmsViajeRaw): CumplidoRecord {
  const documentos = DOCUMENTOS_BASE.map((d) => ({
    ...d,
    // Si tiene número de remisión, asumimos que el documento físico existe
    presente: d.id === "remision" ? !!v.number_order : false,
  }));

  return {
    id:                    v.trip_number,
    trip_number:           v.trip_number,
    number_order:          v.number_order,
    company_customer_name: v.company_customer_name,
    license_plate:         v.license_plate,
    driver_name:           v.driver_name,
    origin_city_name:      v.origin_city_name,
    destiny_city_name:     v.destiny_city_name,
    state_travel:          v.state_travel,
    activated_on:          v.activated_on,
    created_on:            v.created_on,
    fecha_cumplido:        v.activated_on,   // placeholder hasta endpoint propio

    estado_documental: "pendiente",
    documentos,
    observaciones:     null,
    responsable:       null,
    fecha_validacion:  null,
    aprobado_por:      null,
  };
}

/**
 * Lista los cumplidos derivándolos del endpoint TMS existente.
 * FASE 2: reemplazar por req<CumplidoRecord[]>("/api/cumplidos") cuando el
 * backend exponga el endpoint con el expediente documental completo.
 */
export async function listarCumplidos(): Promise<CumplidoRecord[]> {
  const viajes = await req<_TmsViajeRaw[]>("/api/data");
  return viajes
    .filter((v) => ESTADOS_CUMPLIBLES.has((v.state_travel ?? "").toLowerCase()))
    .map(derivarCumplido);
}
