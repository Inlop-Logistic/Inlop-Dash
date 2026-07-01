-- ════════════════════════════════════════════════════════════════
-- SCRIPT 06: co_actas — Actas del Comité Operativo
-- Ejecutar DESPUÉS de SQL_02 (committee_commitments debe existir)
-- ════════════════════════════════════════════════════════════════

-- ── Tabla principal de actas ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS co_actas (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificador funcional visible: S27-2026
  codigo              TEXT,                              -- generado en cliente al finalizar

  -- Clave de negocio
  semana              TEXT NOT NULL,                     -- ej: S27
  anio                INT  NOT NULL,                     -- ej: 2026
  cargo               TEXT NOT NULL
    CHECK (cargo IN ('liq','sec')),

  -- Estado del ciclo de vida
  status              TEXT NOT NULL DEFAULT 'finalizado'
    CHECK (status IN ('finalizado','anulado','corregido')),

  -- Versionamiento para correcciones
  version             INT  NOT NULL DEFAULT 1,
  version_padre_id    UUID REFERENCES co_actas(id) ON DELETE SET NULL,

  -- El Snapshot — toda la información del comité congelada
  snapshot            JSONB NOT NULL,

  -- PDF almacenado en Supabase Storage (fase futura)
  pdf_url             TEXT,

  -- Auditoría
  created_by_nombre   TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  finalizado_at       TIMESTAMPTZ DEFAULT NOW(),
  anulado_by          TEXT,
  anulado_at          TIMESTAMPTZ,
  anulado_motivo      TEXT,
  deleted_at          TIMESTAMPTZ                        -- soft delete
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_co_semana   ON co_actas(semana, anio, cargo);
CREATE INDEX IF NOT EXISTS idx_co_status   ON co_actas(status);
CREATE INDEX IF NOT EXISTS idx_co_created  ON co_actas(created_at DESC);

-- Unicidad de acta activa por semana+cargo (permite múltiples versiones y anuladas)
-- Solo puede existir UNA acta en estado 'finalizado' por semana+cargo
CREATE UNIQUE INDEX IF NOT EXISTS uq_co_acta_activa
  ON co_actas(semana, anio, cargo)
  WHERE status = 'finalizado' AND deleted_at IS NULL;

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE co_actas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "co_actas_select" ON co_actas;
DROP POLICY IF EXISTS "co_actas_insert" ON co_actas;
DROP POLICY IF EXISTS "co_actas_update" ON co_actas;

CREATE POLICY "co_actas_select" ON co_actas
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "co_actas_insert" ON co_actas
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "co_actas_update" ON co_actas
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- MIGRATION: agregar acta_id a committee_commitments
-- Ejecutar solo si la columna no existe aún
-- ════════════════════════════════════════════════════════════════
ALTER TABLE committee_commitments
  ADD COLUMN IF NOT EXISTS acta_id UUID REFERENCES co_actas(id) ON DELETE SET NULL;

ALTER TABLE committee_commitments
  ADD COLUMN IF NOT EXISTS es_acuerdo_hse BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cc_acta_id
  ON committee_commitments(acta_id);
