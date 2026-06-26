import { req } from "@/services/http";

// ── Tipos ──────────────────────────────────────────────────────────────────────

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
  estado: "pendiente" | "aprobado" | "en_ruta" | "completado" | "cancelado";
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

// ── Funciones ──────────────────────────────────────────────────────────────────

export function getSolicitudes(desde: string, hasta: string) {
  return req<Solicitud[]>(`/api/solicitudes?desde=${desde}&hasta=${hasta}`);
}

export function getSolicitudDetalle(id: string) {
  return req<SolicitudDetalle>(`/api/solicitudes/${encodeURIComponent(id)}`);
}

export function cambiarEstadoSolicitud(
  id: string,
  estado: string,
  extra: Record<string, unknown> = {}
) {
  return req(`/api/solicitudes/${encodeURIComponent(id)}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado, ...extra }),
  });
}
