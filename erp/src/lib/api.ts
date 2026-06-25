const API = "https://inlop-dash-production.up.railway.app";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

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

export function getSolicitudes(desde: string, hasta: string) {
  return req<Solicitud[]>(`/api/solicitudes?desde=${desde}&hasta=${hasta}`);
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
