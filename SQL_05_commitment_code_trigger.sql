-- ════════════════════════════════════════════════════════════════
-- SCRIPT 05: generación automática de code en committee_commitments
-- Secuencia + trigger en PostgreSQL. Sin lógica en el frontend.
-- Idempotente: se puede ejecutar aunque ya existan registros.
-- ════════════════════════════════════════════════════════════════

-- 1. Crear la secuencia si no existe (arranca en 1, se ajusta abajo)
CREATE SEQUENCE IF NOT EXISTS committee_commitments_code_seq
  START 1 INCREMENT 1 NO CYCLE;

-- 2. Sincronizar la secuencia con el mayor consecutivo existente.
--    Si la tabla está vacía MAX() = NULL → COALESCE → setval a 0,
--    con lo cual el próximo nextval() devuelve 1.
--    Si ya existe COM-2026-003 → MAX = 3 → próximo nextval() = 4.
SELECT setval(
  'committee_commitments_code_seq',
  COALESCE(
    MAX(CAST(split_part(code, '-', 3) AS INTEGER)),
    0
  ),
  true   -- 'true' significa "este valor ya fue usado"; nextval dará MAX+1
)
FROM committee_commitments
WHERE code ~ '^COM-\d{4}-\d+$';   -- ignora registros con código mal formado

-- 3. Función generadora
CREATE OR REPLACE FUNCTION generate_commitment_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  yr  TEXT   := to_char(NOW(), 'YYYY');
  seq BIGINT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    seq := nextval('committee_commitments_code_seq');
    NEW.code := 'COM-' || yr || '-' || lpad(seq::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger BEFORE INSERT (DROP primero para que sea idempotente)
DROP TRIGGER IF EXISTS trg_commitment_code ON committee_commitments;

CREATE TRIGGER trg_commitment_code
  BEFORE INSERT ON committee_commitments
  FOR EACH ROW EXECUTE FUNCTION generate_commitment_code();
