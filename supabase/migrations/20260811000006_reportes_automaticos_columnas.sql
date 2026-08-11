-- ─── REPORTES AUTOMÁTICOS — Columnas seleccionadas (Etapa 03) ───────────────
-- Agrega la columna `columnas` para persistir el conjunto ordenado de
-- columnas seleccionadas por el usuario en la etapa 03 del wizard.
--
-- Estructura: array JSON de claves técnicas estables (campo.key del catálogo),
-- en el orden que el usuario haya definido. El generador de reportes usará
-- este orden al construir Excel o HTML. Array vacío = todas las columnas
-- disponibles en el orden del catálogo (comportamiento por omisión).
--
-- Ejemplo: ["trip_number", "state_travel", "linea_negocio", "activated_on"]

ALTER TABLE reportes_automaticos
  ADD COLUMN IF NOT EXISTS columnas jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reportes_automaticos.columnas IS
  'Columnas seleccionadas para el reporte, como array JSON de keys técnicas '
  '(campo.key del catálogo). El orden del array determina el orden de las '
  'columnas en Excel/HTML. Array vacío = todas las columnas disponibles del '
  'reporte en el orden del catálogo central.';
