-- ─── REPORTES AUTOMÁTICOS — Corrección modulo_id (segunda pasada) ────────────
-- La corrección anterior (migración 003) reemplazó "gestion_logistica" por
-- "viajes" — usando el NavItem.id del sidebar como clave de módulo.
-- Eso era semánticamente incorrecto: el NavItem "viajes" identifica una
-- funcionalidad concreta (Viajes Activos), no el módulo/área que la agrupa.
--
-- El campo `modulo_id` en reportes_automaticos representa el área funcional
-- del ERP a la que pertenece el conjunto de reportes.  En el wizard, el
-- selector "Módulo" agrupa varios reportes bajo un mismo área; dentro de
-- ese área, el selector "Reporte" elige el tipo específico.
--
-- Jerarquía correcta para el wizard:
--   Módulo  :  modulo_id    = "gestion_logistica"  → label "Gestión Logística"
--   Reporte :  tipo_reporte = "viajes_activos"      → label "Viajes Activos"
--
-- Este script:
--   1. Corrige los registros existentes (viajes → gestion_logistica).
--   2. Actualiza el DEFAULT de la columna.

UPDATE reportes_automaticos
  SET modulo_id = 'gestion_logistica'
  WHERE modulo_id = 'viajes'
    AND tipo_reporte = 'viajes_activos';

ALTER TABLE reportes_automaticos
  ALTER COLUMN modulo_id SET DEFAULT 'gestion_logistica';

COMMENT ON COLUMN reportes_automaticos.modulo_id IS
  'Clave estable del área funcional del ERP a la que pertenece el reporte '
  '(ej. "gestion_logistica" → Gestión Logística). Agrupa varios tipo_reporte '
  'bajo un mismo selector "Módulo" en el wizard. NO es un NavItem ni un NavSection '
  'del sidebar — es una clave propia del catálogo de reportes.';
