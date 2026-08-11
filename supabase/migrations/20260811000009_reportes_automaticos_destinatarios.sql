-- ─── REPORTES AUTOMÁTICOS — Destinatarios (Etapa 05) ────────────────────────
-- Agrega la columna `destinatarios` para persistir a quién se envía el
-- reporte: referencias estructuradas al Personal INLOP real (profiles.id)
-- más correos externos agregados manualmente. Nunca una cadena de correos
-- concatenada — el generador de envíos (fase futura) resuelve los nombres
-- de personal contra `profiles` en el momento de enviar.
--
-- Estructura:
--   {
--     "personal_ids":     ["<uuid de profiles.id>", ...],
--     "correos_externos": ["externo@dominio.com", ...]
--   }
--
-- Objeto con ambos arrays vacíos = sin destinatarios configurados todavía
-- (borrador incompleto — la etapa exige al menos uno para activar).

ALTER TABLE reportes_automaticos
  ADD COLUMN IF NOT EXISTS destinatarios jsonb NOT NULL
    DEFAULT '{"personal_ids":[],"correos_externos":[]}'::jsonb;

COMMENT ON COLUMN reportes_automaticos.destinatarios IS
  'Destinatarios del reporte: { personal_ids: string[], correos_externos: string[] }. '
  'personal_ids referencia profiles.id (Personal INLOP real — ver GET /api/personal); '
  'correos_externos son direcciones agregadas manualmente y validadas en el wizard. '
  'Nunca se persiste como cadena de correos concatenada. Ambos arrays vacíos = '
  'sin destinatarios configurados (la etapa exige al menos uno para activar).';
