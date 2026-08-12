-- ─── REPORTES AUTOMÁTICOS ────────────────────────────────────────────────────
-- Módulo: Configuración → Parámetros → Reportes Automáticos
-- Sprint: Fase 2 — estructura base (sin scheduler ni envío — Fase 3).

CREATE TABLE IF NOT EXISTS reportes_automaticos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              text        NOT NULL,
  tipo_reporte        text        NOT NULL,
  frecuencia          text        NOT NULL DEFAULT 'diaria'
                      CHECK (frecuencia IN ('diaria', 'semanal', 'mensual')),
  activo              boolean     NOT NULL DEFAULT true,
  proxima_ejecucion   timestamptz,               -- poblado por scheduler (Fase 3)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          text,                       -- email del usuario que lo creó
  updated_by          text                        -- email del último editor
);

COMMENT ON TABLE  reportes_automaticos IS 'Reportes automáticos configurados en Configuración → Parámetros';
COMMENT ON COLUMN reportes_automaticos.tipo_reporte        IS 'Clave del tipo de reporte: viajes_activos, etc.';
COMMENT ON COLUMN reportes_automaticos.frecuencia          IS 'Periodicidad de ejecución: diaria | semanal | mensual';
COMMENT ON COLUMN reportes_automaticos.proxima_ejecucion   IS 'Calculado por el scheduler — nulo hasta Fase 3 (scheduler + envío)';

-- Trigger: mantener updated_at al día en cada UPDATE
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER reportes_automaticos_set_updated_at
  BEFORE UPDATE ON reportes_automaticos
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
