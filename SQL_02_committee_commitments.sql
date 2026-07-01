-- ════════════════════════════════════════════════════════════════
-- SCRIPT 02: committee_commitments + committee_commitment_comments
-- Gestor de compromisos del Comité de Operaciones
-- FK a profiles.id (tabla oficial de usuarios del ERP)
-- Ejecutar ANTES del Script 03, DESPUÉS de tener profiles lista
-- ════════════════════════════════════════════════════════════════

-- ── Tabla principal de compromisos ────────────────────────────
CREATE TABLE IF NOT EXISTS committee_commitments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code                TEXT UNIQUE,                             -- COM-2026-001 (autogenerado)
  title               TEXT NOT NULL,
  description         TEXT,
  observations        TEXT,
  closure_notes       TEXT,
  priority            TEXT DEFAULT 'medium'
    CHECK (priority IN ('critical','high','medium','low')),
  status              TEXT DEFAULT 'open'
    CHECK (status IN ('open','in_progress','blocked','completed','closed','cancelled')),

  -- Responsable: FK a profiles + nombre desnormalizado para display rápido
  responsible_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  responsible_nombre  TEXT NOT NULL DEFAULT '',

  -- Creador
  created_by_nombre   TEXT,

  -- Fechas
  committee_date      DATE,              -- fecha del comité que originó el compromiso
  due_date            DATE,              -- fecha límite de cumplimiento
  closed_at           TIMESTAMPTZ,       -- fecha real de cierre
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ        -- soft delete (no borra registros)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_cc_status        ON committee_commitments(status);
CREATE INDEX IF NOT EXISTS idx_cc_responsible   ON committee_commitments(responsible_id);
CREATE INDEX IF NOT EXISTS idx_cc_due_date      ON committee_commitments(due_date);
CREATE INDEX IF NOT EXISTS idx_cc_deleted_at    ON committee_commitments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cc_created_at    ON committee_commitments(created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
-- Todos los usuarios autenticados y anónimos pueden leer registros no eliminados.
-- Cualquier sesión puede crear y modificar (control de roles en la UI).
ALTER TABLE committee_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_select"  ON committee_commitments;
DROP POLICY IF EXISTS "cc_insert"  ON committee_commitments;
DROP POLICY IF EXISTS "cc_update"  ON committee_commitments;

CREATE POLICY "cc_select" ON committee_commitments
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "cc_insert" ON committee_commitments
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "cc_update" ON committee_commitments
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ── Comentarios y avances ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_commitment_comments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commitment_id   UUID NOT NULL
    REFERENCES committee_commitments(id) ON DELETE CASCADE,
  author_nombre   TEXT NOT NULL,                -- nombre del autor (display)
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccc_commitment ON committee_commitment_comments(commitment_id);
CREATE INDEX IF NOT EXISTS idx_ccc_created    ON committee_commitment_comments(created_at ASC);

ALTER TABLE committee_commitment_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccc_select" ON committee_commitment_comments;
DROP POLICY IF EXISTS "ccc_insert" ON committee_commitment_comments;

CREATE POLICY "ccc_select" ON committee_commitment_comments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "ccc_insert" ON committee_commitment_comments
  FOR INSERT TO anon, authenticated WITH CHECK (true);
