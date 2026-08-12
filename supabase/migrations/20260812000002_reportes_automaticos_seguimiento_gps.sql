-- ─── REPORTES AUTOMÁTICOS — Seguimiento GPS por ejecución (Fase 10D) ────────
-- Agrega la opción de configuración "Incluir seguimiento GPS" a un reporte
-- de Gestión Logística. NO dispara nada por sí sola: el enlace temporal se
-- crea en cada EJECUCIÓN (services/reportes/enlaceGps.js, invocado desde
-- ejecutarReporteManual — Fase 9E/10D), nunca al guardar esta configuración.
--
-- No hay CHECK que restrinja esta columna a modulo_id = 'gestion_logistica'
-- a nivel de base de datos — la restricción se aplica en dos capas de
-- aplicación independientes: la ruta CRUD (index.js, al guardar) y el motor
-- de ejecución (services/reportes/enlaceGps.js + services/gps/enlaces.js,
-- al ejecutar) — la segunda es la que realmente importa: aunque esta
-- columna quedara en `true` sobre un reporte de otro módulo por cualquier
-- vía, nunca se genera un enlace para él.

ALTER TABLE reportes_automaticos
  ADD COLUMN IF NOT EXISTS seguimiento_gps boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN reportes_automaticos.seguimiento_gps IS
  'Si es true (solo tiene efecto en reportes de modulo_id = gestion_logistica), cada ejecución (manual o por scheduler) genera un enlace temporal de Seguimiento GPS (Fase 10B) para los destinatarios externos de ESA ejecución, con las placas realmente incluidas en ella. El enlace se crea por ejecución, nunca al guardar esta configuración.';
