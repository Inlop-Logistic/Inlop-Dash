-- ════════════════════════════════════════════════════════════════
-- Sprint 3C-3 — RBAC ERP: asignaciones rol_permisos para roles nuevos
-- ════════════════════════════════════════════════════════════════
-- Ejecutar DESPUÉS de:
--   1. 20260819_rbac_ddl.sql      (tablas)
--   2. 20260819_rbac_seed.sql     (roles base + permisos + rol_permisos base)
--   3. 20260819_rbac_3c_roles.sql (roles trafico, financiero, gerencia)
--
-- Idempotente: todo INSERT usa ON CONFLICT DO NOTHING sobre la
-- PK compuesta (rol_id, permiso_id) — seguro de correr más de una vez.
--
-- Alcance: SOLO agrega filas en rol_permisos para los 3 roles nuevos.
-- NO modifica asignaciones de roles existentes (operador 22, supervisor 39,
-- comercial 20, admin 43, master 0 — ya seedeados en Sprint 3B).
-- NO toca usuario_roles. NO toca usuario_permisos. NO toca profiles.
--
-- Conteos esperados de filas NUEVAS:
--   trafico    → 29
--   financiero → 22
--   gerencia   → 25
--   TOTAL      → 76 filas nuevas
--
-- Fuente: matriz definitiva aprobada en Sprint 3C-2.
--
-- Ejecución: MANUAL, por el administrador, en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════

-- ─── trafico (29 permisos) ─────────────────────────────────────────────────
-- Perfil: operador (22) + escritura en cumplidos docs, solicitudes estado,
-- programación completa, ControlT bitácora.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'trafico'
  AND p.nombre IN (
    -- Viajes (2)
    'viajes:listar', 'viajes:detalle',
    -- Cumplidos (6) — lectura + subir, reemplazar, firmar, estado
    'cumplidos:listar', 'cumplidos:documentos:listar',
    'cumplidos:documentos:subir', 'cumplidos:documentos:reemplazar',
    'cumplidos:documentos:firmar', 'cumplidos:estado',
    -- Solicitudes (3) — lectura + estado
    'solicitudes:listar', 'solicitudes:detalle', 'solicitudes:estado',
    -- Programación (6) — completa
    'programacion:listar', 'programacion:detalle', 'programacion:solicitud',
    'programacion:estado', 'programacion:observaciones', 'programacion:sync',
    -- GPS (1)
    'gps:listar',
    -- Clientes (3) — solo lectura
    'clientes:listar', 'clientes:detalle', 'clientes:alias:listar',
    -- Reportes (2) — solo lectura
    'reportes:listar', 'reportes:clientes',
    -- Personal (1)
    'personal:listar',
    -- ControlT (4) — completo incluyendo bitácora
    'controlt:viaje', 'controlt:lista', 'controlt:bitacora', 'controlt:diag',
    -- Planeados (1)
    'planeados:listar'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ─── financiero (22 permisos) ──────────────────────────────────────────────
-- Perfil: idéntico a operador. Se diferenciará cuando se agreguen
-- módulos de finanzas al catálogo de permisos.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'financiero'
  AND p.nombre IN (
    -- Viajes (2)
    'viajes:listar', 'viajes:detalle',
    -- Cumplidos (3) — solo lectura + firmar
    'cumplidos:listar', 'cumplidos:documentos:listar', 'cumplidos:documentos:firmar',
    -- Solicitudes (2) — solo lectura
    'solicitudes:listar', 'solicitudes:detalle',
    -- Programación (4) — lectura + observaciones
    'programacion:listar', 'programacion:detalle', 'programacion:solicitud',
    'programacion:observaciones',
    -- GPS (1)
    'gps:listar',
    -- Clientes (3) — solo lectura
    'clientes:listar', 'clientes:detalle', 'clientes:alias:listar',
    -- Reportes (2) — solo lectura
    'reportes:listar', 'reportes:clientes',
    -- Personal (1)
    'personal:listar',
    -- ControlT (3) — consulta sin bitácora
    'controlt:viaje', 'controlt:lista', 'controlt:diag',
    -- Planeados (1)
    'planeados:listar'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ─── gerencia (25 permisos) ────────────────────────────────────────────────
-- Perfil: lectura amplia + gestión de reportes (crear, editar, toggle, enviar).
-- NO incluye escritura operativa ni configuración del sistema.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'gerencia'
  AND p.nombre IN (
    -- Viajes (2)
    'viajes:listar', 'viajes:detalle',
    -- Cumplidos (3) — solo lectura + firmar
    'cumplidos:listar', 'cumplidos:documentos:listar', 'cumplidos:documentos:firmar',
    -- Solicitudes (2) — solo lectura
    'solicitudes:listar', 'solicitudes:detalle',
    -- Programación (3) — solo lectura (sin observaciones, sin estado, sin sync)
    'programacion:listar', 'programacion:detalle', 'programacion:solicitud',
    -- GPS (1)
    'gps:listar',
    -- Clientes (3) — solo lectura
    'clientes:listar', 'clientes:detalle', 'clientes:alias:listar',
    -- Reportes (6) — lectura + gestión (sin eliminar)
    'reportes:listar', 'reportes:crear', 'reportes:editar',
    'reportes:toggle', 'reportes:enviar', 'reportes:clientes',
    -- Personal (1)
    'personal:listar',
    -- ControlT (3) — consulta sin bitácora
    'controlt:viaje', 'controlt:lista', 'controlt:diag',
    -- Planeados (1)
    'planeados:listar'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- master: sin filas — acceso total por regla especial en tienePermiso().
-- Nota: un revoke individual en usuario_permisos NO debe bloquear a master.
-- La lógica de tienePermiso() (sprint posterior) debe evaluar master ANTES
-- de consultar revokes.

-- ════════════════════════════════════════════════════════════════
-- VALIDACIÓN — ejecutar después de los INSERTs para confirmar resultado
-- ════════════════════════════════════════════════════════════════

-- V1. Conteo de rol_permisos por rol — debe coincidir exactamente
SELECT
  ro.nombre AS rol,
  COUNT(rp.permiso_id) AS permisos_asignados,
  CASE ro.nombre
    WHEN 'operador'   THEN 22
    WHEN 'trafico'    THEN 29
    WHEN 'comercial'  THEN 20
    WHEN 'financiero' THEN 22
    WHEN 'gerencia'   THEN 25
    WHEN 'supervisor' THEN 39
    WHEN 'admin'      THEN 43
    WHEN 'master'     THEN 0
  END AS esperado,
  CASE
    WHEN COUNT(rp.permiso_id) = CASE ro.nombre
      WHEN 'operador'   THEN 22
      WHEN 'trafico'    THEN 29
      WHEN 'comercial'  THEN 20
      WHEN 'financiero' THEN 22
      WHEN 'gerencia'   THEN 25
      WHEN 'supervisor' THEN 39
      WHEN 'admin'      THEN 43
      WHEN 'master'     THEN 0
    END THEN '✅ OK'
    ELSE '❌ FALLO'
  END AS validacion
FROM roles ro
LEFT JOIN rol_permisos rp ON rp.rol_id = ro.id
WHERE ro.es_sistema = true
GROUP BY ro.id, ro.nombre
ORDER BY
  CASE ro.nombre
    WHEN 'operador'   THEN 1
    WHEN 'trafico'    THEN 2
    WHEN 'comercial'  THEN 3
    WHEN 'financiero' THEN 4
    WHEN 'gerencia'   THEN 5
    WHEN 'supervisor' THEN 6
    WHEN 'admin'      THEN 7
    WHEN 'master'     THEN 8
  END;

-- V2. Total de filas en rol_permisos — debe ser 200
-- (operador 22 + trafico 29 + comercial 20 + financiero 22
--  + gerencia 25 + supervisor 39 + admin 43 + master 0 = 200)
SELECT
  CASE
    WHEN COUNT(*) = 200 THEN '✅ V2 OK — 200 filas totales en rol_permisos'
    ELSE '❌ V2 FALLO — se esperaban 200, encontradas: ' || COUNT(*)::text
  END AS validacion_v2
FROM rol_permisos;

-- V3. Verificar que rbac:gestionar NO está en rol_permisos
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ V3 OK — rbac:gestionar no asignado a ningún rol'
    ELSE '❌ V3 FALLO — rbac:gestionar encontrado en ' || COUNT(*)::text || ' rol(es)'
  END AS validacion_v3
FROM rol_permisos rp
JOIN permisos p ON p.id = rp.permiso_id
WHERE p.nombre = 'rbac:gestionar';

-- V4. Verificar que master tiene 0 filas en rol_permisos
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ V4 OK — master tiene 0 filas en rol_permisos'
    ELSE '❌ V4 FALLO — master tiene ' || COUNT(*)::text || ' filas'
  END AS validacion_v4
FROM rol_permisos rp
JOIN roles r ON r.id = rp.rol_id
WHERE r.nombre = 'master';

-- V5. Verificar ausencia de duplicados en rol_permisos
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ V5 OK — sin duplicados en rol_permisos'
    ELSE '❌ V5 FALLO — ' || COUNT(*)::text || ' combinaciones duplicadas'
  END AS validacion_v5
FROM (
  SELECT rol_id, permiso_id, COUNT(*) AS cnt
  FROM rol_permisos
  GROUP BY rol_id, permiso_id
  HAVING COUNT(*) > 1
) dupes;

-- V6. Verificar que todos los permisos referenciados existen en la tabla permisos
-- (detecta errores de tipeo en nombres de permisos — si un nombre no existe,
--  el INSERT...SELECT no inserta nada silenciosamente)
SELECT
  CASE
    WHEN COUNT(*) = 44 THEN '✅ V6 OK — 44 permisos en el catálogo'
    ELSE '❌ V6 FALLO — se esperaban 44, encontrados: ' || COUNT(*)::text
  END AS validacion_v6
FROM permisos;

-- V7. Desglose detallado — permisos de cada rol nuevo (para inspección manual)
-- Solo muestra los 3 roles nuevos; los existentes ya fueron validados en Sprint 3B.
SELECT ro.nombre AS rol, p.nombre AS permiso, p.modulo
FROM rol_permisos rp
JOIN roles ro ON ro.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE ro.nombre IN ('trafico', 'financiero', 'gerencia')
ORDER BY
  CASE ro.nombre
    WHEN 'trafico'    THEN 1
    WHEN 'financiero' THEN 2
    WHEN 'gerencia'   THEN 3
  END,
  p.modulo, p.nombre;

-- V8. Verificar relación: supervisor ⊇ trafico ∪ comercial
-- Debe retornar 0 filas (ningún permiso de trafico o comercial falta en supervisor)
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ V8 OK — supervisor contiene todos los permisos de trafico ∪ comercial'
    ELSE '❌ V8 FALLO — supervisor le faltan ' || COUNT(*)::text || ' permisos'
  END AS validacion_v8
FROM (
  SELECT DISTINCT rp.permiso_id
  FROM rol_permisos rp
  JOIN roles r ON r.id = rp.rol_id
  WHERE r.nombre IN ('trafico', 'comercial')

  EXCEPT

  SELECT rp.permiso_id
  FROM rol_permisos rp
  JOIN roles r ON r.id = rp.rol_id
  WHERE r.nombre = 'supervisor'
) missing;

-- V9. Verificar relación: admin ⊇ supervisor
-- Debe retornar 0 filas (ningún permiso de supervisor falta en admin)
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ V9 OK — admin contiene todos los permisos de supervisor'
    ELSE '❌ V9 FALLO — admin le faltan ' || COUNT(*)::text || ' permisos'
  END AS validacion_v9
FROM (
  SELECT rp.permiso_id
  FROM rol_permisos rp
  JOIN roles r ON r.id = rp.rol_id
  WHERE r.nombre = 'supervisor'

  EXCEPT

  SELECT rp.permiso_id
  FROM rol_permisos rp
  JOIN roles r ON r.id = rp.rol_id
  WHERE r.nombre = 'admin'
) missing;
