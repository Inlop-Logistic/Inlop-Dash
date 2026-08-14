/**
 * src/api.ts — Cliente HTTP de la API pública de Seguimiento GPS (Fase 10B).
 *
 * Nunca envía placa, reporte_id ni ningún identificador propio — solo el
 * token del enlace (en la URL, tal como llegó por correo/enlace),
 * correo/código durante la verificación, y el token de sesión como Bearer
 * una vez autenticado. El backend es la única fuente de autorización (ver
 * services/gps/*.js) — este cliente nunca decide localmente qué placas
 * "debería" poder ver.
 */
import type {
  RespuestaValidarEnlace, RespuestaSolicitarOtp, RespuestaValidarOtp, RespuestaVehiculos,
  RespuestaIniciarAcceso,
} from "./types";

// `import.meta.env` solo existe bajo Vite — al correr src/api.test.ts
// directamente con `node --test` (fuera de Vite) es undefined; el
// encadenamiento opcional evita que el simple hecho de importar este
// módulo reviente en ese contexto.
const API_URL: string = (import.meta.env?.VITE_API_URL as string | undefined) ?? "";
const BASE = `${API_URL}/api/seguimiento-gps`;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function pedir<T>(path: string, opts: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...opts.headers },
    });
  } catch {
    // Fallo de red real (sin conexión, DNS, etc.) — distinto de un error HTTP.
    throw new ApiError(0, "Sin conexión. Verifica tu internet e inténtalo de nuevo.");
  }
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, cuerpo?.error ?? "Ocurrió un error inesperado.");
  }
  return cuerpo as T;
}

export function validarEnlace(token: string): Promise<RespuestaValidarEnlace> {
  return pedir(`/enlaces/${encodeURIComponent(token)}`);
}

export function solicitarOtp(token: string, correo: string): Promise<RespuestaSolicitarOtp> {
  return pedir(`/enlaces/${encodeURIComponent(token)}/otp`, {
    method: "POST",
    body: JSON.stringify({ correo }),
  });
}

/**
 * Primer paso compartido de internos y externos (Fase 11B): "pedir correo".
 * El backend decide si el correo califica para acceso interno directo (sin
 * OTP) o si debe pasar por el flujo OTP externo de siempre — este cliente
 * nunca decide localmente cuál aplica, solo interpreta `modo` en la
 * respuesta (ver useSeguimiento.ts).
 */
export function iniciarAcceso(token: string, correo: string): Promise<RespuestaIniciarAcceso> {
  return pedir(`/enlaces/${encodeURIComponent(token)}/acceso`, {
    method: "POST",
    body: JSON.stringify({ correo }),
  });
}

export function validarOtp(token: string, correo: string, codigo: string): Promise<RespuestaValidarOtp> {
  return pedir(`/enlaces/${encodeURIComponent(token)}/otp/validar`, {
    method: "POST",
    body: JSON.stringify({ correo, codigo }),
  });
}

export function obtenerVehiculos(sesionToken: string): Promise<RespuestaVehiculos> {
  return pedir(`/vehiculos`, {
    headers: { Authorization: `Bearer ${sesionToken}` },
  });
}
