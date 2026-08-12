-- ─── REPORTES AUTOMÁTICOS — Destinatarios: corrección de fuente (Etapa 05) ──
-- Corrige la documentación de la columna `destinatarios` (agregada en
-- 20260811000006_reportes_automaticos_destinatarios.sql — no requiere
-- cambio de tipo, sigue siendo jsonb con la misma forma):
--
-- ERROR: la migración original documentaba personal_ids como referencias a
-- `profiles.id`. Es incorrecto — `profiles` es la cuenta de acceso al ERP
-- (no todo el personal la tiene). La fuente oficial de personal interno de
-- INLOP es la tabla `personal` (ver SQL_04_personal.sql) — el maestro real
-- de personal, independiente de Auth y base futura de Talento Humano.
--
-- Estructura (sin cambios de forma, solo de fuente referenciada):
--   {
--     "personal_ids":     ["<uuid de personal.id>", ...],
--     "correos_externos": ["externo@dominio.com", ...]
--   }

COMMENT ON COLUMN reportes_automaticos.destinatarios IS
  'Destinatarios del reporte: { personal_ids: string[], correos_externos: string[] }. '
  'personal_ids referencia personal.id (tabla `personal` — maestro real de personal '
  'de INLOP, ver SQL_04_personal.sql y GET /api/personal). NO referencia profiles.id. '
  'correos_externos son direcciones agregadas manualmente y validadas en el wizard. '
  'Nunca se persiste como cadena de correos concatenada. Ambos arrays vacíos = '
  'sin destinatarios configurados (la etapa exige al menos uno para activar).';
