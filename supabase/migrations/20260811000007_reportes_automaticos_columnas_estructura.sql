-- ─── REPORTES AUTOMÁTICOS — Columnas: estructura campo/título/orden ─────────
-- Fase 5 — Constructor de columnas (dos paneles + nombre visible editable).
--
-- La columna `columnas` (agregada en 20260811000006) sigue siendo jsonb y no
-- requiere cambio de tipo. Este archivo solo actualiza su documentación: cada
-- elemento del array pasó de ser una clave técnica suelta a un objeto con
-- { campo, titulo, orden } para soportar el nombre visible personalizable.
--
-- Ejemplo:
--   [
--     { "campo": "trip_number",  "titulo": "Manifiesto", "orden": 0 },
--     { "campo": "state_travel", "titulo": "Estado",     "orden": 1 }
--   ]

COMMENT ON COLUMN reportes_automaticos.columnas IS
  'Columnas del reporte, como array JSON de objetos { campo, titulo, orden }. '
  'campo = clave técnica estable del catálogo central (CATALOGO_REPORTES), '
  'nunca editada por el usuario. titulo = nombre visible de la columna en el '
  'reporte generado, editable. orden = posición 0-based en el reporte. Array '
  'vacío = todas las columnas disponibles del reporte, en el orden del catálogo.';
