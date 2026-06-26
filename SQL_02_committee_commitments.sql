-- ════════════════════════════════════════════════════════════════
-- SCRIPT 02: committee_commitments + committee_commitment_comments
-- Gestor de compromisos del Comité de Operaciones
-- Ejecutar DESPUÉS del Script 01
-- ════════════════════════════════════════════════════════════════

-- ── Tabla principal de compromisos ────────────────────────────
CREATE TABLE IF NOT EXISTS committee_commitments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code                TEXT UNIQUE,                          -- COM-2026-001
  title               TEXT NOT NULL,
  description         TEXT,
  observations        TEXT,
  closure_notes       TEXT,
  priority            TEXT DEFAULT 'medium'
    CHECK (priority IN ('critical','high','medium','low')),
  status              TEXT DEFAULT 'open'
    CHECK (status IN ('open','in_progress','blocked','completed','closed','cancelled')),
  responsible_nombre  TEXT NOT NULL,                        -- nombre del responsable
  created_by_nombre   TEXT,                                 -- nombre de quien creó
  committee_date      DATE,                                 -- fecha del comité origen
  due_date            DATE,                                 -- fecha límite
  closed_at           TIMESTAMPTZ,                          -- fecha real de cierre
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ                           -- soft delete
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_cc_status       ON committee_commitments(status);
CREATE INDEX IF NOT EXISTS idx_cc_responsible  ON committee_commitments(responsible_nombre);
CREATE INDEX IF NOT EXISTS idx_cc_due_date     ON committee_commitments(due_date);
CREATE INDEX IF NOT EXISTS idx_cc_deleted_at   ON committee_commitments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cc_created_at   ON committee_commitments(created_at);

-- RLS: todos ven todos los registros no eliminados; cualquier sesión puede escribir
ALTER TABLE committee_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_select" ON committee_commitments;
DROP POLICY IF EXISTS "cc_insert" ON committee_commitments;
DROP POLICY IF EXISTS "cc_update" ON committee_commitments;

CREATE POLICY "cc_select" ON committee_commitments
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "cc_insert" ON committee_commitments
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "cc_update" ON committee_commitments
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ── Tabla de comentarios y avances ────────────────────────────
CREATE TABLE IF NOT EXISTS committee_commitment_comments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commitment_id   UUID NOT NULL REFERENCES committee_commitments(id) ON DELETE CASCADE,
  author_nombre   TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccc_commitment ON committee_commitment_comments(commitment_id);
CREATE INDEX IF NOT EXISTS idx_ccc_created    ON committee_commitment_comments(created_at);

ALTER TABLE committee_commitment_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccc_select" ON committee_commitment_comments;
DROP POLICY IF EXISTS "ccc_insert" ON committee_commitment_comments;

CREATE POLICY "ccc_select" ON committee_commitment_comments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "ccc_insert" ON committee_commitment_comments
  FOR INSERT TO anon, authenticated WITH CHECK (true);
