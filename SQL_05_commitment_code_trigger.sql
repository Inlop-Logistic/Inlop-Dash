-- ════════════════════════════════════════════════════════════════
-- SCRIPT 05: generación automática de code en committee_commitments
-- El consecutivo COM-YYYY-NNN lo produce PostgreSQL, no el frontend.
-- Ejecutar una sola vez en Supabase.
-- ════════════════════════════════════════════════════════════════

-- ── Secuencia anual ──────────────────────────────────────────────
-- Una secuencia global que reinicia manualmente cada año.
-- Si se necesita reinicio automático por año se puede reemplazar
-- por la función con lógica de año (ver comentario al final).
CREATE SEQUENCE IF NOT EXISTS committee_commitments_code_seq
  START 1
  INCREMENT 1
  NO CYCLE;

-- ── Función generadora ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_commitment_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  yr   TEXT := to_char(NOW(), 'YYYY');
  seq  BIGINT;
BEGIN
  -- Solo genera el código si no viene ya establecido
  IF NEW.code IS NULL OR NEW.code = '' THEN
    seq := nextval('committee_commitments_code_seq');
    NEW.code := 'COM-' || yr || '-' || lpad(seq::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger BEFORE INSERT ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_commitment_code ON committee_commitments;

CREATE TRIGGER trg_commitment_code
  BEFORE INSERT ON committee_commitments
  FOR EACH ROW
  EXECUTE FUNCTION generate_commitment_code();

-- ════════════════════════════════════════════════════════════════
-- NOTA SOBRE EL REINICIO ANUAL
-- La secuencia es continua (COM-2026-001, COM-2026-002, ...,
-- COM-2027-003, COM-2027-004 ...). El año en el prefijo cambia solo,
-- pero el número NO reinicia a 001 al cambiar el año.
-- Si se requiere reinicio anual, ejecutar en enero:
--   ALTER SEQUENCE committee_commitments_code_seq RESTART WITH 1;
-- O reemplazar la función para usar un contador por año:
--
-- CREATE OR REPLACE FUNCTION generate_commitment_code() ...
--   SELECT COALESCE(MAX(
--     CAST(split_part(code, '-', 3) AS INT)
--   ), 0) + 1
--   INTO seq
--   FROM committee_commitments
--   WHERE code LIKE 'COM-' || yr || '-%';
--   NEW.code := 'COM-' || yr || '-' || lpad(seq::TEXT, 3, '0');
-- (Este enfoque es equivalente al JS anterior y tiene el mismo race
--  condition; usar la secuencia es siempre preferible.)
-- ════════════════════════════════════════════════════════════════
