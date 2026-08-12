-- ─── REPORTES AUTOMÁTICOS — Recurrencia estructurada (Etapa 04) ─────────────
-- Agrega la columna `recurrencia` para persistir la configuración completa
-- de periodicidad definida en el wizard: tipo, hora(s) de envío, días/día
-- según el tipo, y el rango de repetición (comienzo + una única modalidad
-- de finalización). Diseñada para que un scheduler futuro (Fase 6+) calcule
-- la próxima ejecución sin reinterpretar texto libre.
--
-- La columna `frecuencia` (texto, agregada en la migración base) se
-- mantiene como espejo de `recurrencia.tipo` — la sigue usando el listado
-- de Reportes Automáticos para el badge de periodicidad sin tener que leer
-- el JSON completo.
--
-- Estructura:
--   {
--     "tipo":         "diaria" | "semanal" | "mensual",
--     "horas":        ["08:00", "14:30"],
--     "dias_semana":  [1, 3, 5],            -- solo si tipo = "semanal" (0=domingo..6=sábado)
--     "dia_mes":      15,                   -- solo si tipo = "mensual" (1-31)
--     "fecha_inicio": "2026-08-11",         -- obligatoria
--     "fin": { "modo": "nunca" }
--         | { "modo": "fecha", "fecha": "2026-12-31" }
--         | { "modo": "repeticiones", "cantidad": 10 }
--   }
--
-- Objeto vacío ({}) = recurrencia aún no configurada (borrador incompleto).

ALTER TABLE reportes_automaticos
  ADD COLUMN IF NOT EXISTS recurrencia jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN reportes_automaticos.recurrencia IS
  'Configuración estructurada de periodicidad: { tipo, horas[], dias_semana?, '
  'dia_mes?, fecha_inicio, fin }. fin es una de tres modalidades mutuamente '
  'excluyentes: { modo: "nunca" } | { modo: "fecha", fecha } | '
  '{ modo: "repeticiones", cantidad }. Preparada para que el scheduler '
  '(Fase 6+) calcule proxima_ejecucion sin reinterpretar texto libre. '
  'Objeto vacío = recurrencia aún no configurada.';
