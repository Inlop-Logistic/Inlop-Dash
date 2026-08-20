-- ════════════════════════════════════════════════════════════════
-- Sprint 3C-3 — RBAC ERP: roles complementarios (trafico, financiero, gerencia)
-- ════════════════════════════════════════════════════════════════
-- Ejecutar DESPUÉS de 20260819_rbac_ddl.sql y 20260819_rbac_seed.sql.
--
-- Idempotente: INSERT usa ON CONFLICT DO NOTHING sobre la
-- restricción UNIQUE de roles.nombre — seguro de correr más de una vez.
--
-- Alcance: SOLO agrega 3 roles nuevos al catálogo. NO modifica
-- roles existentes (operador, supervisor, comercial, admin, master).
-- NO modifica permisos. NO asigna rol_permisos (ver archivo aparte).
-- NO crea usuario_roles. NO modifica profiles.
--
-- Fuente: catálogo definitivo aprobado en Sprint 3C-1.
--
-- Ejecución: MANUAL, por el administrador, en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════

-- ─── 3 roles nuevos del sistema ─────────────────────────────────────────────
INSERT INTO roles (nombre, descripcion, es_sistema) VALUES
  ('trafico',    'Gestión de tráfico — coordinación operativa de viajes y programación', true),
  ('financiero', 'Acceso financiero — lectura operativa + verificación para facturación', true),
  ('gerencia',   'Visión ejecutiva — lectura amplia + gestión de reportes',              true)
ON CONFLICT (nombre) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- VALIDACIÓN — ejecutar después del INSERT para confirmar resultado
-- ════════════════════════════════════════════════════════════════

-- V1. Verificar que existen exactamente 8 roles del sistema
SELECT
  CASE
    WHEN COUNT(*) = 8 THEN '✅ V1 OK — 8 roles del sistema encontrados'
    ELSE '❌ V1 FALLO — se esperaban 8, encontrados: ' || COUNT(*)::text
  END AS validacion_v1
FROM roles
WHERE es_sistema = true AND activo = true;

-- V2. Verificar que los 8 roles esperados existen por nombre
SELECT
  CASE
    WHEN COUNT(*) = 8 THEN '✅ V2 OK — los 8 roles existen por nombre'
    ELSE '❌ V2 FALLO — faltan roles, encontrados: ' || COUNT(*)::text
  END AS validacion_v2
FROM roles
WHERE nombre IN (
  'operador', 'trafico', 'comercial', 'financiero',
  'gerencia', 'supervisor', 'admin', 'master'
);

-- V3. Listar todos los roles del sistema con su estado
SELECT nombre, descripcion, es_sistema, activo, creado_en
FROM roles
WHERE es_sistema = true
ORDER BY
  CASE nombre
    WHEN 'operador'   THEN 1
    WHEN 'trafico'    THEN 2
    WHEN 'comercial'  THEN 3
    WHEN 'financiero' THEN 4
    WHEN 'gerencia'   THEN 5
    WHEN 'supervisor' THEN 6
    WHEN 'admin'      THEN 7
    WHEN 'master'     THEN 8
  END;
