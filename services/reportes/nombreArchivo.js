/**
 * services/reportes/nombreArchivo.js — Nombre de archivo del generador de
 * reportes, compartido entre excelBuilder.js (Fase 9C) y htmlBuilder.js
 * (Fase 9D) — mismo criterio de nombre para ambos formatos, solo cambia la
 * extensión.
 */
import { fechaHoyColombia } from '../../utils/fechas.js';

/**
 * Nombre de archivo derivado del reporte y su fecha de ejecución — nunca un
 * literal hardcodeado. Prioriza `reporte.nombre` (el nombre que el usuario
 * le dio en el wizard); si no está disponible, usa `tipo_reporte`.
 * Ej.: "viajes_activos_diario_2026-08-11.xlsx" / "....html".
 */
export function construirNombreArchivo(reporte, metadata, extension) {
  const fuente = (reporte?.nombre?.trim() || reporte?.tipo_reporte || metadata?.tipoReporte || 'reporte');
  const base = fuente
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'reporte';
  const fecha = metadata?.fechaEjecucion || fechaHoyColombia();
  return `${base}_${fecha}.${extension}`;
}
