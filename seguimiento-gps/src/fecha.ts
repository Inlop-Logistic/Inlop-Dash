/**
 * src/fecha.ts — Reexporta el estándar corporativo de fechas TMS (Fase 10C).
 *
 * Regla P-09 (ERP_DATE_TIME_STANDARD.md): "toda función de parseo de fecha
 * TMS del frontend importa desde este módulo. No reimplementar fuera de
 * aquí." `erp/src/utils/parseFecha.ts` es autocontenido (sin imports
 * propios) — se reutiliza por ruta relativa, igual que los design tokens
 * en src/index.css, en vez de reimplementar el parseo/format de
 * `latest_gps_report` en este proyecto independiente.
 */
export { parseFechaTMS, gpsRelativo, fmtTms, type GpsFreshness } from "../../erp/src/utils/parseFecha";
