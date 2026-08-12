-- ─── REPORTES AUTOMÁTICOS — Fase 3.1: Borrador ──────────────────────────────
-- Distingue los reportes guardados como borrador (configurador en progreso)
-- de los reportes inactivos intencionalmente (activo = false pero completos).
-- Esto evita que los borradores aparezcan en el listado operativo junto con
-- los reportes desactivados por el usuario.

ALTER TABLE reportes_automaticos
  ADD COLUMN IF NOT EXISTS borrador boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN reportes_automaticos.borrador IS
  'true = guardado como borrador (configurador en progreso, puede estar incompleto); '
  'false = reporte publicado, ya sea activo o inactivo intencionalmente.';
