-- ════════════════════════════════════════════════════════════════
-- PATCH: ejecutar ANTES de SQL_04_personal.sql
-- Limpia todas las referencias a UUIDs de profiles en las tablas
-- operativas. Los nombres ya están guardados en las columnas *_nombre,
-- por lo que no se pierde información de display.
-- ════════════════════════════════════════════════════════════════

-- 1. Eliminar FK antigua (si aún existe bajo cualquier nombre)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'committee_commitments'::regclass
      AND contype = 'f'
      AND conname LIKE '%responsible%'
  LOOP
    EXECUTE 'ALTER TABLE committee_commitments DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;

  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'weekend_shift_assignments'::regclass
      AND contype = 'f'
      AND conname LIKE '%assigned_user%'
  LOOP
    EXECUTE 'ALTER TABLE weekend_shift_assignments DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 2. Poner en NULL todos los IDs heredados de profiles
UPDATE committee_commitments    SET responsible_id  = NULL WHERE responsible_id  IS NOT NULL;
UPDATE weekend_shift_assignments SET assigned_user_id = NULL WHERE assigned_user_id IS NOT NULL;
