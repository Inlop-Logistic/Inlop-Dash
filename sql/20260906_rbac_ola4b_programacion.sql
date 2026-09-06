-- ════════════════════════════════════════════════════════════════
-- Sprint 3D-7.11K.2-H — RBAC Ola 4B: permiso de acción de Programación
-- ════════════════════════════════════════════════════════════════
-- Ejecutar DESPUÉS de los scripts de Sprint 3B, 3C-3, Ola 4A.
--
-- Idempotente: todo INSERT usa ON CONFLICT DO NOTHING — seguro de
-- correr más de una vez.
--
-- Alcance:
--   1. Agrega 1 permiso nuevo al catálogo (si no existe).
--   2. Asigna ese permiso a los roles indicados en rol_permisos.
--   NO modifica permisos existentes.
--   NO modifica roles existentes.
--   NO modifica usuario_roles ni usuario_permisos.
--
-- Permiso creado:
--   programacion:gestionar — Operaciones manuales sobre viajes en programación:
--                            cambiar estado (solo estados humanos: programado,
--                            cancelado), editar observaciones, y sincronización
--                            manual individual vía POST /sync.
--                            Los estados automáticos (asignado, en_ruta, sin_asignar,
--                            completado) los gestiona syncPlaneados — nunca este endpoint.
--
-- Asignaciones:
--   programacion:gestionar → admin, supervisor, trafico, operador
--
-- Ejecución: MANUAL, por el administrador, en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════

-- ─── Verificación previa (opcional — retorna 0 filas si es correcto) ─────────
-- SELECT nombre FROM permisos WHERE nombre = 'programacion:gestionar';

-- ─── 1. Nuevo permiso ─────────────────────────────────────────────────────────

INSERT INTO permisos (nombre, modulo, descripcion) VALUES
  ('programacion:gestionar',
   'programacion',
   'Operaciones manuales de programación: cambiar estado (programado/cancelado), editar observaciones y sync individual')
ON CONFLICT (nombre) DO NOTHING;

-- ─── 2. Asignaciones rol_permisos ─────────────────────────────────────────────

-- operador, trafico, supervisor, admin — todos reciben programacion:gestionar
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre IN ('operador', 'trafico', 'supervisor', 'admin')
  AND p.nombre = 'programacion:gestionar'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- master: sin filas — acceso total por regla especial en tienePermiso().
-- comercial, financiero, gerencia: no reciben este permiso (consulta solo).

-- ════════════════════════════════════════════════════════════════
-- VALIDACIÓN — ejecutar después de los INSERTs para confirmar resultado
-- ════════════════════════════════════════════════════════════════

-- V1. El permiso existe
SELECT
  CASE
    WHEN COUNT(*) = 1 THEN '✅ V1 OK — programacion:gestionar creado'
    ELSE '❌ V1 FALLO — se esperaba 1, encontrados: ' || COUNT(*)::text
  END AS validacion_v1
FROM permisos
WHERE nombre = 'programacion:gestionar';

-- V2. Asignaciones por rol
SELECT ro.nombre AS rol,
       COUNT(rp.permiso_id) FILTER (
         WHERE p.nombre = 'programacion:gestionar'
       ) AS permisos_ola4b
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
--   operador   → 1
--   trafico    → 1
--   supervisor → 1
--   admin      → 1
--   master     → 0 (acceso total por regla especial)
--   comercial  → 0
--   financiero → 0
--   gerencia   → 0

-- V3. Sin duplicados
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ V3 OK — sin duplicados en rol_permisos para Ola 4B'
    ELSE '❌ V3 FALLO — ' || COUNT(*)::text || ' combinaciones duplicadas'
  END AS validacion_v3
FROM (
  SELECT rol_id, permiso_id, COUNT(*) AS cnt
  FROM rol_permisos
  GROUP BY rol_id, permiso_id
  HAVING COUNT(*) > 1
) dupes;
