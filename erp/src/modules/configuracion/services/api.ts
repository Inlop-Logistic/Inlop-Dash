import { req } from "@/services/http";
import { lineaNegocio } from "@/utils/lineaNegocio";
import type { ReporteAutomatico, ReporteBase, PersonalInlop } from "../types";

// ─── Preview de datos del reporte ────────────────────────────────────────────

/** Límite de filas para la muestra de datos en el wizard (Revisión, etapa 06). */
const LIMITE_PREVIEW = 10;

/**
 * Mapeo tipo_reporte → endpoint interno.
 * Fuente: comentarios de auditoría en datasetsReportes.ts (Fase 5, 2026-08-11).
 */
const ENDPOINT_POR_REPORTE: Record<string, string> = {
  viajes_activos:     "/api/viajes",
  solicitudes:        "/api/solicitudes",
  programacion:       "/api/programacion",
  viajes_finalizados: "/api/cumplidos",
  centro_gps:         "/api/gps",
};

/**
 * Enriquece filas con campos derivados que el catálogo declara pero el
 * API no devuelve directamente (conforme al origen documentado en
 * datasetsReportes.ts):
 *  - `tipo_servicio`  → origin_city_name === destiny_city_name → "Urbano" | "Nacional"
 *  - `linea_negocio`  → type_operation con "granel" → "Carga Líquida" | "Carga Seca"
 *
 * Solo completa campos que el API no devuelve (`!fila[campo]`).
 * No modifica campos que ya vienen poblados (ej. programacion sí devuelve tipo_servicio).
 */
function enriquecerFilas(
  filas: Record<string, unknown>[]
): Record<string, unknown>[] {
  return filas.map(r => {
    const fila: Record<string, unknown> = { ...r };

    // tipo_servicio
    if (!fila.tipo_servicio) {
      const orig = ((fila.origin_city_name ?? fila.city_origin ?? "") as string)
        .trim().toLowerCase();
      const dest = ((fila.destiny_city_name ?? fila.city_destination ?? "") as string)
        .trim().toLowerCase();
      if (orig && dest) {
        fila.tipo_servicio = orig === dest ? "Urbano" : "Nacional";
      }
    }

    // linea_negocio — usa el mismo utility que los módulos operativos
    if (!fila.linea_negocio && fila.type_operation) {
      fila.linea_negocio = lineaNegocio(fila.type_operation as string);
    }

    return fila;
  });
}

/**
 * Carga hasta `limit` filas del dataset real correspondiente al `tipo_reporte`
 * seleccionado en el wizard. Reutiliza los endpoints operativos existentes —
 * no crea datos ni genera archivos.
 *
 * Arquitectura:
 *  - viajes_activos / centro_gps: RAM cache (respuesta instantánea, sin param limit)
 *  - solicitudes / programacion:   DB con filtro de fecha por defecto (hoy)
 *  - viajes_finalizados:           DB con ?limit=N para no descargar todo
 */
export async function cargarPreviewReporte(
  tipoReporte: string,
  limit: number = LIMITE_PREVIEW
): Promise<Record<string, unknown>[]> {
  const endpoint = ENDPOINT_POR_REPORTE[tipoReporte];
  if (!endpoint) {
    throw new Error(`Sin fuente de datos configurada para: ${tipoReporte}`);
  }

  // Solo cumplidos acepta el param limit en el backend (evita scan completo).
  // Los demás endpoints son cache o filtran por fecha por defecto — se limitan en el cliente.
  const url =
    tipoReporte === "viajes_finalizados"
      ? `${endpoint}?limit=${limit}`
      : endpoint;

  const datos = await req<Record<string, unknown>[]>(url);
  const filas = (datos ?? []).slice(0, limit);
  return enriquecerFilas(filas);
}

export function listarReportesAutomaticos(): Promise<ReporteAutomatico[]> {
  return req<ReporteAutomatico[]>("/api/reportes-automaticos");
}

/**
 * Personal INLOP disponible como destinatario de reportes — proyectado por
 * el backend desde `personal` (el maestro real de personal de INLOP,
 * independiente de Auth — ver SQL_04_personal.sql). Ver GET /api/personal
 * en index.js.
 */
export function listarPersonal(): Promise<PersonalInlop[]> {
  return req<PersonalInlop[]>("/api/personal");
}

export function crearReporteAutomatico(data: ReporteBase): Promise<ReporteAutomatico> {
  return req<ReporteAutomatico>("/api/reportes-automaticos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarReporteAutomatico(
  id: string,
  data: Partial<ReporteBase>
): Promise<ReporteAutomatico> {
  return req<ReporteAutomatico>(`/api/reportes-automaticos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function toggleReporteActivo(
  id: string,
  activo: boolean
): Promise<{ ok: boolean; activo: boolean }> {
  return req<{ ok: boolean; activo: boolean }>(
    `/api/reportes-automaticos/${encodeURIComponent(id)}/activo`,
    { method: "PATCH", body: JSON.stringify({ activo }) }
  );
}
