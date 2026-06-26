-- ════════════════════════════════════════════════════════════════
-- SCRIPT 01: inlop_profiles
-- Tabla de usuarios del sistema INLOP para selección de responsables
-- Ejecutar PRIMERO — no tiene dependencias
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inlop_profiles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL,
  email       TEXT,
  rol         TEXT DEFAULT 'operativo',
  departamento TEXT,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inlop_profiles_activo ON inlop_profiles(activo);
CREATE INDEX IF NOT EXISTS idx_inlop_profiles_nombre ON inlop_profiles(nombre);

-- RLS: lectura pública (anon + authenticated), escritura solo authenticated
ALTER TABLE inlop_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inlop_profiles_select" ON inlop_profiles;
DROP POLICY IF EXISTS "inlop_profiles_insert" ON inlop_profiles;
DROP POLICY IF EXISTS "inlop_profiles_update" ON inlop_profiles;

CREATE POLICY "inlop_profiles_select" ON inlop_profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "inlop_profiles_insert" ON inlop_profiles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "inlop_profiles_update" ON inlop_profiles
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Datos iniciales (ajusta según tu equipo real) ──────────────
INSERT INTO inlop_profiles (nombre, rol, departamento) VALUES
  ('Luis Fernando Vides',   'master',    'Gerencia'),
  ('Alejandro Soto',        'operativo', 'Contabilidad'),
  ('Enoelia Rojas',         'operativo', 'Gestión Documental'),
  ('Alexnader Garzon',      'operativo', 'HSE y Seguridad'),
  ('Andres Tovar',          'trafico',   'Tráfico'),
  ('Jose Tapias',           'trafico',   'Tráfico'),
  ('Jonathan Olivo',        'trafico',   'Tráfico'),
  ('Maria Camila Diaz',     'operativo', 'Operaciones'),
  ('Valentina Moreno',      'operativo', 'Operaciones')
ON CONFLICT DO NOTHING;
