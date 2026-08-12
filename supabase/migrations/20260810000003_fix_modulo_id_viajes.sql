-- ─── REPORTES AUTOMÁTICOS — Corrección modulo_id ────────────────────────────
-- "gestion_logistica" era el id de la sección/agrupador del sidebar (NavSection),
-- no el módulo funcional. El módulo real es el NavItem identificado por su Vista id.
--
-- Jerarquía correcta:
--   Categoría : NavSection.id = "logistica"   → label "GESTIÓN LOGÍSTICA"
--   Módulo    : NavItem.id    = "viajes"       → label "Viajes Activos"
--   Reporte   : tipo_reporte  = "viajes_activos"
--
-- Este script:
--   1. Corrige los registros existentes.
--   2. Actualiza el DEFAULT de la columna.

UPDATE reportes_automaticos
  SET modulo_id = 'viajes'
  WHERE modulo_id = 'gestion_logistica'
    AND tipo_reporte = 'viajes_activos';

ALTER TABLE reportes_automaticos
  ALTER COLUMN modulo_id SET DEFAULT 'viajes';

COMMENT ON COLUMN reportes_automaticos.modulo_id IS
  'Clave estable del módulo funcional — corresponde al NavItem.id del sidebar ERP '
  '(ej. "viajes" → Viajes Activos). NO es la sección/agrupador (NavSection).';
