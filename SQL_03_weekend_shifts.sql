-- ════════════════════════════════════════════════════════════════
-- SCRIPT 03: weekend_shift_templates + weekend_shifts + weekend_shift_assignments
-- Gestión de Turnos de Fin de Semana
-- Ejecutar DESPUÉS del Script 01
-- ════════════════════════════════════════════════════════════════

-- ── Catálogo de áreas (plantilla fija) ────────────────────────
CREATE TABLE IF NOT EXISTS weekend_shift_templates (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  departamento    TEXT NOT NULL,
  area_nombre     TEXT NOT NULL,
  area_code       TEXT UNIQUE NOT NULL,
  color_hex       TEXT DEFAULT '#3b82f6',
  covers_both_days BOOLEAN DEFAULT true,  -- true = 1 persona cubre sáb+dom; false = persona diferente c/día
  is_critical     BOOLEAN DEFAULT true,   -- slot obligatorio antes de publicar
  display_order   INT DEFAULT 0,
  activo          BOOLEAN DEFAULT true
);

ALTER TABLE weekend_shift_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wst_select" ON weekend_shift_templates;
DROP POLICY IF EXISTS "wst_write"  ON weekend_shift_templates;

CREATE POLICY "wst_select" ON weekend_shift_templates
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "wst_write" ON weekend_shift_templates
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed: áreas del formato actual (basado en Excel compartido)
INSERT INTO weekend_shift_templates
  (departamento, area_nombre, area_code, color_hex, covers_both_days, is_critical, display_order)
VALUES
  ('GERENCIA',      'GERENCIA',            'GER',     '#1e3a5f', true,  true, 1),
  ('APROBACIONES',  'CONTABILIDAD',        'CONT',    '#f9a8d4', true,  true, 2),
  ('APROBACIONES',  'PAGOS',               'PAG',     '#bfdbfe', true,  true, 3),
  ('APROBACIONES',  'GESTIÓN DOCUMENTAL',  'GDOC',    '#fca5a5', true,  true, 4),
  ('APROBACIONES',  'HSE Y SEGURIDAD',     'HSE',     '#fed7aa', true,  true, 5),
  ('TRÁFICO',       'TURNO DÍA',           'TRA_D',   '#fde68a', false, true, 6),
  ('TRÁFICO',       'TURNO NOCHE',         'TRA_N',   '#c8c8a0', false, true, 7),
  ('OPERACIONES',   'C. LÍQUIDA',          'OP_LIQ',  '#c4b5fd', true,  true, 8),
  ('OPERACIONES',   'C. SECA',             'OP_SEC',  '#a5b4fc', true,  true, 9)
ON CONFLICT (area_code) DO NOTHING;

-- ── Cabecera de turno por fin de semana ───────────────────────
CREATE TABLE IF NOT EXISTS weekend_shifts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  weekend_start   DATE NOT NULL UNIQUE,  -- siempre el sábado
  status          TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','published','closed')),
  notes           TEXT,
  created_by      TEXT,
  published_by    TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws_weekend_start ON weekend_shifts(weekend_start);
CREATE INDEX IF NOT EXISTS idx_ws_status        ON weekend_shifts(status);

ALTER TABLE weekend_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ws_select" ON weekend_shifts;
DROP POLICY IF EXISTS "ws_insert" ON weekend_shifts;
DROP POLICY IF EXISTS "ws_update" ON weekend_shifts;

CREATE POLICY "ws_select" ON weekend_shifts
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "ws_insert" ON weekend_shifts
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "ws_update" ON weekend_shifts
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Asignaciones individuales por área/día ────────────────────
CREATE TABLE IF NOT EXISTS weekend_shift_assignments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id         UUID NOT NULL REFERENCES weekend_shifts(id) ON DELETE CASCADE,
  template_code    TEXT NOT NULL,
  shift_day        TEXT NOT NULL CHECK (shift_day IN ('saturday','sunday','both')),
  assigned_nombre  TEXT NOT NULL,
  confirmed        BOOLEAN DEFAULT false,
  confirmed_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, template_code, shift_day)  -- 1 persona por slot
);

CREATE INDEX IF NOT EXISTS idx_wsa_shift_id ON weekend_shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_wsa_code     ON weekend_shift_assignments(template_code);

ALTER TABLE weekend_shift_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wsa_select" ON weekend_shift_assignments;
DROP POLICY IF EXISTS "wsa_insert" ON weekend_shift_assignments;
DROP POLICY IF EXISTS "wsa_update" ON weekend_shift_assignments;
DROP POLICY IF EXISTS "wsa_delete" ON weekend_shift_assignments;

CREATE POLICY "wsa_select" ON weekend_shift_assignments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "wsa_insert" ON weekend_shift_assignments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "wsa_update" ON weekend_shift_assignments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "wsa_delete" ON weekend_shift_assignments
  FOR DELETE TO anon, authenticated USING (true);
