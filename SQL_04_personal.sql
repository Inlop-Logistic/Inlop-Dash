-- ════════════════════════════════════════════════════════════════
-- SCRIPT 04: personal
-- Directorio de personas de la organización (independiente de Auth)
-- Ejecutar DESPUÉS del Script 03
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS personal (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre            TEXT NOT NULL,
  cargo             TEXT,
  area              TEXT,
  correo_compartido TEXT,          -- correo del área (puede repetirse)
  observaciones     TEXT,
  profile_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- nullable: no todos tienen acceso al ERP
  activo            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_area     ON personal(area);
CREATE INDEX IF NOT EXISTS idx_personal_activo   ON personal(activo);
CREATE INDEX IF NOT EXISTS idx_personal_profile  ON personal(profile_id);

ALTER TABLE personal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_select" ON personal;
DROP POLICY IF EXISTS "personal_write"  ON personal;

CREATE POLICY "personal_select" ON personal
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "personal_write" ON personal
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Seed: personal operativo inicial ─────────────────────────
-- Ajusta nombres, cargos y áreas según la nómina real de INLOP.
-- correo_compartido permite registrar personas que comparten un correo institucional.
INSERT INTO personal (nombre, cargo, area, correo_compartido, activo) VALUES
  -- GERENCIA
  ('Gerente General',            'Gerente General',           'GERENCIA',            NULL,                    true),

  -- APROBACIONES – Contabilidad
  ('Coordinador Contabilidad',   'Coordinador Contabilidad',  'CONTABILIDAD',        'contabilidad@inlop.com.co', true),

  -- APROBACIONES – Pagos
  ('Coordinador Pagos',          'Coordinador Pagos',         'PAGOS',               'pagos@inlop.com.co',    true),

  -- APROBACIONES – Gestión Documental
  ('Responsable Documental 1',   'Analista Documental',       'GESTIÓN DOCUMENTAL',  'gdoc@inlop.com.co',     true),
  ('Responsable Documental 2',   'Analista Documental',       'GESTIÓN DOCUMENTAL',  'gdoc@inlop.com.co',     true),

  -- APROBACIONES – HSE
  ('Coordinador HSE',            'Coordinador HSE y Seguridad','HSE Y SEGURIDAD',    'hse@inlop.com.co',      true),

  -- TRÁFICO (3 personas, 1 correo)
  ('Controlador Tráfico 1',      'Controlador de Tráfico',    'TRÁFICO',             'trafico@inlop.com.co',  true),
  ('Controlador Tráfico 2',      'Controlador de Tráfico',    'TRÁFICO',             'trafico@inlop.com.co',  true),
  ('Controlador Tráfico 3',      'Controlador de Tráfico',    'TRÁFICO',             'trafico@inlop.com.co',  true),

  -- OPERACIONES – Carga Líquida
  ('Coordinador C. Líquida',     'Coordinador Carga Líquida', 'OPERACIONES',         'operaciones@inlop.com.co', true),

  -- OPERACIONES – Carga Seca
  ('Coordinador C. Seca',        'Coordinador Carga Seca',    'OPERACIONES',         'operaciones@inlop.com.co', true)

ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: ajustar FKs de committee_commitments y weekend_shift_assignments
-- para apuntar a personal(id) en lugar de profiles(id)
-- (ejecutar solo si las tablas ya existen de scripts anteriores)
-- ════════════════════════════════════════════════════════════════

-- committee_commitments: responsible_id → personal
ALTER TABLE committee_commitments
  DROP CONSTRAINT IF EXISTS committee_commitments_responsible_id_fkey;

ALTER TABLE committee_commitments
  ADD CONSTRAINT committee_commitments_responsible_id_fkey
  FOREIGN KEY (responsible_id) REFERENCES personal(id) ON DELETE SET NULL;

-- weekend_shift_assignments: assigned_user_id → personal
ALTER TABLE weekend_shift_assignments
  DROP CONSTRAINT IF EXISTS weekend_shift_assignments_assigned_user_id_fkey;

ALTER TABLE weekend_shift_assignments
  ADD CONSTRAINT weekend_shift_assignments_assigned_user_id_fkey
  FOREIGN KEY (assigned_user_id) REFERENCES personal(id) ON DELETE SET NULL;
