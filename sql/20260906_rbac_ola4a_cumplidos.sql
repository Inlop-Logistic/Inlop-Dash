-- ════════════════════════════════════════════════════════════════
-- Sprint 3D-7.11K.2-G — RBAC Ola 4A: permisos de acción de Cumplidos
-- ════════════════════════════════════════════════════════════════
-- Ejecutar DESPUÉS de los scripts de Sprint 3B, 3C-3.
--
-- Idempotente: todo INSERT usa ON CONFLICT DO NOTHING — seguro de
-- correr más de una vez.
--
-- Alcance:
--   1. Agrega 2 permisos nuevos al catálogo de permisos.
--   2. Asigna esos permisos a los roles indicados en rol_permisos.
--   NO modifica permisos existentes.
--   NO modifica roles existentes.
--   NO modifica usuario_roles ni usuario_permisos.
--   NO modifica profiles.
--
-- Permisos creados:
--   cumplidos:gestionar-docs  — Subir, reemplazar y eliminar soportes
--                               (POST, PUT /reemplazar, DELETE en documentos)
--   cumplidos:cambiar-estado  — Cambiar estado del cumplido manualmente
--                               (PATCH /estado — solo estados humanos;
--                                la validación de dominio bloquea LIVE,
--                                FINALIZADO CONTROLT y PENDIENTE LIQUIDACION
--                                independientemente de este permiso)
--
-- Asignaciones:
--   gestionar-docs → admin, supervisor, trafico, operador
--   cambiar-estado → admin, supervisor, trafico
--
-- Ejecución: MANUAL, por el administrador, en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Nuevos permisos ──────────────────────────────────────────────────────

-- Verificar que NO existen antes de crear (la consulta retorna 0 filas si es correcto):
-- SELECT nombre FROM permisos WHERE nombre IN ('cumplidos:gestionar-docs','cumplidos:cambiar-estado');

INSERT INTO permisos (nombre, modulo, descripcion) VALUES
  ('cumplidos:gestionar-docs',
   'cumplidos',
   'Subir, reemplazar y eliminar soportes documentales de cumplidos'),
  ('cumplidos:cambiar-estado',
   'cumplidos',
   'Cambiar el estado del cumplido manualmente (solo estados humanos)')
ON CONFLICT (nombre) DO NOTHING;

-- ─── 2. Asignaciones rol_permisos ────────────────────────────────────────────

-- operador — gestionar-docs únicamente (sin cambiar-estado)
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'operador'
  AND p.nombre IN ('cumplidos:gestionar-docs')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- trafico — ambos permisos
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'trafico'
  AND p.nombre IN ('cumplidos:gestionar-docs', 'cumplidos:cambiar-estado')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- supervisor — ambos permisos
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'supervisor'
  AND p.nombre IN ('cumplidos:gestionar-docs', 'cumplidos:cambiar-estado')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- admin — ambos permisos
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'admin'
  AND p.nombre IN ('cumplidos:gestionar-docs', 'cumplidos:cambiar-estado')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- master: sin filas — acceso total por regla especial en tienePermiso().
-- comercial, financiero, gerencia: no reciben estos permisos (consulta solo).

-- ════════════════════════════════════════════════════════════════
-- VALIDACIÓN — ejecutar después de los INSERTs para confirmar resultado
-- ════════════════════════════════════════════════════════════════

-- V1. Los 2 nuevos permisos existen
SELECT
  CASE
    WHEN COUNT(*) = 2 THEN '✅ V1 OK — 2 permisos Ola 4A creados'
    ELSE '❌ V1 FALLO — se esperaban 2, encontrados: ' || COUNT(*)::text
  END AS validacion_v1
FROM permisos
WHERE nombre IN ('cumplidos:gestionar-docs', 'cumplidos:cambiar-estado');

-- V2. Asignaciones por rol (esperado: operador +1, trafico +2, supervisor +2, admin +2)
SELECT ro.nombre AS rol,
       COUNT(rp.permiso_id) FILTER (
         WHERE p.nombre IN ('cumplidos:gestionar-docs','cumplidos:cambiar-estado')
       ) AS permisos_ola4a
FROM roles ro
LEFT JOIN rol_permisos rp ON rp.rol_id = ro.id
LEFT JOIN permisos p ON p.id = rp.permiso_id
WHERE ro.nombre IN ('operador','trafico','supervisor','admin','master','comercial','financiero','gerencia')
GROUP BY ro.nombre
ORDER BY
  CASE ro.nombre
    WHEN 'operador'   THEN 1 WHEN 'trafico'    THEN 2 WHEN 'supervisor' THEN 3
    WHEN 'admin'      THEN 4 WHEN 'master'     THEN 5 WHEN 'comercial'  THEN 6
    WHEN 'financiero' THEN 7 WHEN 'gerencia'   THEN 8
  END;
-- Resultado esperado:
--   operador   → 1 (solo gestionar-docs)
--   trafico    → 2
--   supervisor → 2
--   admin      → 2
--   master     → 0 (acceso total por regla especial)
--   comercial  → 0
--   financiero → 0
--   gerencia   → 0

-- V3. Sin duplicados en las filas nuevas
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ V3 OK — sin duplicados en rol_permisos para Ola 4A'
    ELSE '❌ V3 FALLO — ' || COUNT(*)::text || ' combinaciones duplicadas'
  END AS validacion_v3
FROM (
  SELECT rol_id, permiso_id, COUNT(*) AS cnt
  FROM rol_permisos
  GROUP BY rol_id, permiso_id
  HAVING COUNT(*) > 1
) dupes;
