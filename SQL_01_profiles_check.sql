-- ════════════════════════════════════════════════════════════════
-- SCRIPT 01 (opcional): Verificación y ajuste mínimo de profiles
--
-- Este script NO crea ni recrea la tabla profiles.
-- Solo verifica su existencia y agrega columnas opcionales
-- que el módulo puede necesitar si aún no existen.
--
-- Ejecuta solo si necesitas agregar campos faltantes.
-- ════════════════════════════════════════════════════════════════

-- Agrega 'departamento' a profiles si no existe
-- (usado por el selector de responsables para mostrar el área)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS departamento TEXT;

-- Nota: Si tu tabla profiles usa 'full_name' en lugar de 'nombre',
-- el módulo buscará 'nombre' primero. Puedes crear una columna alias:
--   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nombre TEXT
--     GENERATED ALWAYS AS (COALESCE(full_name, email)) STORED;
-- O simplemente asegurarte de que el campo 'nombre' ya exista.

-- Confirmar estructura actual (ejecuta manualmente para revisar):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'profiles' ORDER BY ordinal_position;
