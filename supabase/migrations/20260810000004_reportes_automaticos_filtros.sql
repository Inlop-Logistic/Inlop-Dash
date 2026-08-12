-- ─── REPORTES AUTOMÁTICOS — Fase 4: Filtros ─────────────────────────────────
-- Agrega la columna filtros (JSONB) para persistir las condiciones de filtrado
-- configuradas en el wizard de creación de reportes.
--
-- Estructura de cada elemento del array:
--   { "campo": "state_travel",  "operador": "es",      "valor": "en transíto" }
--   { "campo": "activated_on",  "operador": "entre",   "valor_desde": "YYYY-MM-DD", "valor_hasta": "YYYY-MM-DD" }
--   { "campo": "last_alarm_name", "operador": "tiene_valor" }
--
-- Campos admitidos actualmente para tipo_reporte = 'viajes_activos':
--   state_travel    — enum   — Estado del viaje (valores de ESTADO_CFG)
--   linea_negocio   — enum   — Derivado de type_operation: "Carga Seca" | "Carga Líquida"
--   last_alarm_name — bool   — Tiene novedad / Sin novedad
--   activated_on    — fecha  — Fecha de activación del viaje
--
-- El campo filtros=[] (array vacío) significa "sin condiciones: incluir todos".

ALTER TABLE reportes_automaticos
  ADD COLUMN IF NOT EXISTS filtros jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reportes_automaticos.filtros IS
  'Array de condiciones de filtrado configuradas en el wizard. '
  'Estructura: [{ campo, operador, valor?, valor_desde?, valor_hasta? }]. '
  'Array vacío = sin filtros (incluir todos los registros).';
