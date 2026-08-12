import { req } from "@/services/http";
import { lineaNegocio } from "@/utils/lineaNegocio";
import { parseFechaTMS } from "@/utils/parseFecha";
import { extraerFechaColombia } from "@/utils/date";
import { normalizarClienteFiltro } from "../utils/normalizarCliente";
import { buscarReporte, type CampoDataset } from "../catalogos/datasetsReportes";
import type {
  ReporteAutomatico, ReporteBase, PersonalInlop, FiltroItem,
  ResultadoEnvioManual, ClienteFiltroOpcion,
} from "../types";

// ─── Preview de datos del reporte ────────────────────────────────────────────

/** Límite de filas para la muestra de datos en el wizard (Revisión, etapa 06). */
const LIMITE_PREVIEW = 10;

/**
 * Cuando hay filtros activos sobre `viajes_finalizados`, se pide un lote mayor
 * al backend (mismo endpoint, mismo param `?limit=N` de Fase 8C) para tener
 * suficientes candidatos sobre los que filtrar antes de recortar a
 * LIMITE_PREVIEW. Sin filtros se mantiene el límite justo de 8C (10).
 */
const LIMITE_FETCH_CON_FILTROS = 200;

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
 *
 * `cliente_normalizado` (Fase 11A) requiere `tipoReporte` porque el campo
 * crudo del nombre del cliente vive en una clave distinta según el dataset
 * — mismo mapeo (CAMPO_CLIENTE_POR_REPORTE) y mismo algoritmo de
 * normalización que services/reportes/datasetProvider.js#enriquecerFilas en
 * el backend, para que la Preview refleje el mismo filtro que se aplica de
 * verdad en generación.
 */
const CAMPO_CLIENTE_POR_REPORTE: Record<string, (fila: Record<string, unknown>) => unknown> = {
  viajes_activos:     f => f.razon_social ?? f.company_customer_name,
  solicitudes:        f => f.cliente,
  programacion:       f => f.nombre_cliente,
  viajes_finalizados: f => f.company_customer_name,
  centro_gps:         f => f.razon_social ?? f.company_customer_name,
};

function enriquecerFilas(
  filas: Record<string, unknown>[],
  tipoReporte: string
): Record<string, unknown>[] {
  const obtenerCliente = CAMPO_CLIENTE_POR_REPORTE[tipoReporte];

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

    // cliente_normalizado (Fase 11A) — ver comentario de la función arriba
    if (obtenerCliente) {
      fila.cliente_normalizado = normalizarClienteFiltro(obtenerCliente(fila) as string | null | undefined);
    }

    return fila;
  });
}

// ─── Filtros (Fase 8D) ────────────────────────────────────────────────────────
//
// Aplica `datos.filtros` (Etapa 02) a las filas de la preview. Reutiliza
// exclusivamente la metadata ya declarada en CATALOGO_REPORTES (via
// buscarReporte) — campo, operador y opciones vienen de ahí, no se redefine
// ningún catálogo de filtros aquí. Este módulo solo aporta la EVALUACIÓN
// (comparar un valor de fila contra la condición), que no existía antes.

/** Formato real de transporte de cada campo `fecha` filtrable, por reporte.
 *  Necesario porque los distintos orígenes (TMS vivo vs Supabase) no
 *  serializan las fechas de forma uniforme — ver erp/src/utils/parseFecha.ts
 *  y docs/ERP_DATE_TIME_STANDARD.md (estándar corporativo de fechas).
 *   - "mdy" → string TMS MM/DD/YYYY (activated_on)
 *   - "dmy" → string TMS DD/MM/YYYY (schedulate_origin, fecha_cumplido)
 *   - "iso" → timestamp ISO de Supabase (creado_en, fecha_requerida)
 */
const FORMATO_FECHA_POR_CAMPO: Record<string, Record<string, "iso" | "mdy" | "dmy">> = {
  viajes_activos:     { activated_on: "mdy" },
  solicitudes:        { creado_en: "iso", fecha_requerida: "iso" },
  programacion:       { schedulate_origin: "dmy" },
  viajes_finalizados: { activated_on: "mdy", fecha_cumplido: "dmy" },
};

/** Fecha de un campo, normalizada a YYYY-MM-DD en hora Colombia, o null si no es parseable. */
function fechaCampoYMD(valor: unknown, tipoReporte: string, campo: string): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const formato = FORMATO_FECHA_POR_CAMPO[tipoReporte]?.[campo] ?? "iso";
  if (formato === "iso") {
    const d = new Date(valor as string);
    return isNaN(d.getTime()) ? null : extraerFechaColombia(d);
  }
  const d = parseFechaTMS(valor as string, formato === "mdy" ? "MDY" : "DMY");
  return d ? extraerFechaColombia(d) : null;
}

/** Evalúa una condición de filtro contra una fila. Un filtro sin campo o sin
 *  valor configurado (aún incompleto en el wizard) no restringe resultados. */
function evaluaCondicion(
  fila: Record<string, unknown>,
  filtro: FiltroItem,
  tipoReporte: string,
  campoInfo: CampoDataset | undefined,
): boolean {
  if (!filtro.campo || !campoInfo) return true;

  // ── Campos de fecha: comparación por día calendario (Colombia) ──────────
  if (campoInfo.tipo === "fecha") {
    const ymd = fechaCampoYMD(fila[filtro.campo], tipoReporte, filtro.campo);
    switch (filtro.operador) {
      case "es":
        return !filtro.valor || (ymd !== null && ymd === filtro.valor);
      case "antes_de":
        return !filtro.valor || (ymd !== null && ymd < filtro.valor);
      case "despues_de":
        return !filtro.valor || (ymd !== null && ymd > filtro.valor);
      case "entre": {
        if (!filtro.valor_desde && !filtro.valor_hasta) return true;
        if (ymd === null) return false;
        if (filtro.valor_desde && ymd < filtro.valor_desde) return false;
        if (filtro.valor_hasta && ymd > filtro.valor_hasta) return false;
        return true;
      }
      default:
        return true;
    }
  }

  // ── Booleano: presencia/ausencia de valor ────────────────────────────────
  if (filtro.operador === "tiene_valor" || filtro.operador === "sin_valor") {
    const valor = fila[filtro.campo];
    const tieneValor = valor !== null && valor !== undefined && valor !== "" && valor !== false;
    return filtro.operador === "tiene_valor" ? tieneValor : !tieneValor;
  }

  // ── Multi-selección ("en") — mismo criterio que filterEngine.js (backend),
  // Fase 11A: sin valores elegidos ("Todos") no restringe.
  if (filtro.operador === "en") {
    if (!filtro.valores || filtro.valores.length === 0) return true;
    const valorComparar = campoInfo.tipo === "cliente"
      ? String(fila.cliente_normalizado ?? "")
      : String(fila[filtro.campo] ?? "");
    return filtro.valores.includes(valorComparar);
  }

  // ── Texto / enum: igualdad exacta ────────────────────────────────────────
  const valorStr = fila[filtro.campo] === null || fila[filtro.campo] === undefined
    ? ""
    : String(fila[filtro.campo]);
  if (filtro.operador === "es")    return !filtro.valor || valorStr === filtro.valor;
  if (filtro.operador === "no_es") return !filtro.valor || valorStr !== filtro.valor;

  return true;
}

/**
 * Aplica todos los `filtros` a `filas` en condición AND (mismo criterio que
 * EtapaFiltros: "se aplicarán todos los filtros"). Ignora filtros cuyo campo
 * no es filtrable para `tipoReporte` — evita restos de un reporte anterior.
 * Sin filtros → devuelve las filas sin tocar.
 */
function aplicarFiltros(
  filas: Record<string, unknown>[],
  filtros: FiltroItem[],
  tipoReporte: string,
): Record<string, unknown>[] {
  if (filtros.length === 0) return filas;

  const campos = buscarReporte(tipoReporte)?.campos ?? [];
  const campoPorKey = new Map(campos.filter(c => c.filtrable).map(c => [c.key, c]));

  const activos = filtros.filter(f => f.campo && campoPorKey.has(f.campo));
  if (activos.length === 0) return filas;

  return filas.filter(fila =>
    activos.every(f => evaluaCondicion(fila, f, tipoReporte, campoPorKey.get(f.campo)))
  );
}

/**
 * Carga hasta `limit` filas del dataset real correspondiente al `tipo_reporte`
 * seleccionado en el wizard, con los `filtros` del wizard ya aplicados.
 * Reutiliza los endpoints operativos existentes — no crea datos ni genera
 * archivos.
 *
 * Arquitectura:
 *  - viajes_activos / centro_gps: RAM cache (respuesta instantánea, sin param limit)
 *  - solicitudes / programacion:   DB con filtro de fecha por defecto (hoy)
 *  - viajes_finalizados:           DB con ?limit=N para no descargar todo;
 *    con filtros activos se pide un lote mayor (LIMITE_FETCH_CON_FILTROS)
 *    para tener candidatos suficientes antes de filtrar y recortar a `limit`.
 */
export async function cargarPreviewReporte(
  tipoReporte: string,
  filtros: FiltroItem[] = [],
  limit: number = LIMITE_PREVIEW
): Promise<Record<string, unknown>[]> {
  const endpoint = ENDPOINT_POR_REPORTE[tipoReporte];
  if (!endpoint) {
    throw new Error(`Sin fuente de datos configurada para: ${tipoReporte}`);
  }

  // Solo cumplidos acepta el param limit en el backend (evita scan completo).
  // Los demás endpoints son cache o filtran por fecha por defecto.
  const fetchLimit =
    tipoReporte === "viajes_finalizados"
      ? (filtros.length > 0 ? LIMITE_FETCH_CON_FILTROS : limit)
      : null;

  const url = fetchLimit !== null ? `${endpoint}?limit=${fetchLimit}` : endpoint;

  const datos = await req<Record<string, unknown>[]>(url);
  const enriquecidas = enriquecerFilas(datos ?? [], tipoReporte);
  const filtradas = aplicarFiltros(enriquecidas, filtros, tipoReporte);
  return filtradas.slice(0, limit);
}

/**
 * Clientes disponibles para el selector "Cliente" del filtro (Fase 11A),
 * derivados del MISMO dataset y normalización que aplica el filtro real en
 * generación — ver GET /api/reportes-automaticos/clientes (index.js) y
 * services/reportes/datasetProvider.js#listarClientesDataset.
 */
export function listarClientesReporte(tipoReporte: string): Promise<ClienteFiltroOpcion[]> {
  return req<ClienteFiltroOpcion[]>(
    `/api/reportes-automaticos/clientes?tipo_reporte=${encodeURIComponent(tipoReporte)}`
  );
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

/**
 * Eliminación definitiva (Fase 9I). No hay confirmación a nivel de API —
 * la confirmación explícita (nombre del reporte, advertencia si está activo)
 * vive en ModalEliminarReporte, antes de invocar esta función.
 */
export function eliminarReporteAutomatico(id: string): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>(
    `/api/reportes-automaticos/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

/**
 * Ejecución manual (Fase 9E): genera el archivo del reporte (Excel/HTML,
 * según su formato) y lo envía de inmediato por correo a sus destinatarios
 * configurados — sin tocar `proxima_ejecucion` ni `recurrencia`, sin crear
 * historial de ejecución.
 *
 * Los casos de rechazo del backend (reporte inexistente, borrador,
 * inactivo, sin destinatarios válidos, fallo de generación o de envío)
 * llegan como HTTP no-2xx — `req()` los convierte en una excepción con el
 * mensaje ya redactado en español (`error.message`), listo para mostrar en
 * la UI sin reinterpretar códigos.
 */
export function enviarReporteManual(id: string): Promise<ResultadoEnvioManual> {
  return req<ResultadoEnvioManual>(
    `/api/reportes-automaticos/${encodeURIComponent(id)}/enviar`,
    { method: "POST" }
  );
}
