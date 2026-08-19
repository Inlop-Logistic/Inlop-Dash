-- ════════════════════════════════════════════════════════════════
-- Sprint 3B — RBAC ERP: seed de catálogo (roles, permisos, rol_permisos)
-- ════════════════════════════════════════════════════════════════
-- Ejecutar DESPUÉS de 20260819_rbac_ddl.sql.
--
-- Idempotente: todo INSERT usa ON CONFLICT DO NOTHING sobre la
-- restricción UNIQUE correspondiente — seguro de correr más de una vez.
--
-- Alcance: SOLO catálogo. NO asigna roles a usuarios (usuario_roles
-- queda vacía). NO migra profiles.rol. NO asigna excepciones en
-- usuario_permisos.
--
-- Fuente: matriz de permisos aprobada en Sprint 3A. Ningún permiso
-- fue inventado fuera de esa matriz.
--
-- Ejecución: MANUAL, por el administrador, en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════

-- ─── Roles del sistema ───────────────────────────────────────────────────
INSERT INTO roles (nombre, descripcion, es_sistema) VALUES
  ('operador',   'Consulta operativa — lectura de todos los módulos',        true),
  ('supervisor', 'Gestión operativa — lectura y escritura',                  true),
  ('comercial',  'Gestión comercial de clientes',                           true),
  ('admin',      'Administración operativa completa',                       true),
  ('master',     'Superusuario — acceso total + gestión RBAC (ver nota)',   true)
ON CONFLICT (nombre) DO NOTHING;

-- ─── Catálogo de permisos ────────────────────────────────────────────────
-- Agrupados por módulo, en el mismo orden del inventario de Sprint 3A.

INSERT INTO permisos (nombre, modulo, descripcion) VALUES
  -- Viajes Activos
  ('viajes:listar',                     'viajes',       'Listar viajes activos'),
  ('viajes:detalle',                    'viajes',       'Ver detalle de un viaje'),

  -- Cumplidos (Viajes Finalizados)
  ('cumplidos:listar',                  'cumplidos',    'Listar viajes finalizados'),
  ('cumplidos:documentos:listar',       'cumplidos',    'Ver soportes documentales de un cumplido'),
  ('cumplidos:documentos:subir',        'cumplidos',    'Subir soporte documental'),
  ('cumplidos:documentos:reemplazar',   'cumplidos',    'Reemplazar archivo de soporte'),
  ('cumplidos:documentos:eliminar',     'cumplidos',    'Eliminar soporte documental'),
  ('cumplidos:documentos:firmar',       'cumplidos',    'Obtener URL firmada de un soporte'),
  ('cumplidos:estado',                  'cumplidos',    'Cambiar estado documental del cumplido'),

  -- Solicitudes
  ('solicitudes:listar',                'solicitudes',  'Listar solicitudes'),
  ('solicitudes:detalle',               'solicitudes',  'Ver detalle de una solicitud'),
  ('solicitudes:estado',                'solicitudes',  'Cambiar estado de una solicitud'),

  -- Programación
  ('programacion:listar',               'programacion', 'Listar programación'),
  ('programacion:detalle',              'programacion', 'Ver detalle de una programación'),
  ('programacion:solicitud',            'programacion', 'Ver solicitud vinculada a una programación'),
  ('programacion:estado',               'programacion', 'Cambiar estado de programación'),
  ('programacion:observaciones',        'programacion', 'Editar observaciones de programación'),
  ('programacion:sync',                 'programacion', 'Sincronizar programación con Resume API'),

  -- Centro GPS
  ('gps:listar',                        'gps',          'Ver vehículos en Centro GPS'),

  -- Clientes / Comercial
  ('clientes:listar',                   'clientes',     'Listar clientes del maestro'),
  ('clientes:detalle',                  'clientes',     'Ver detalle de un cliente'),
  ('clientes:crear',                    'clientes',     'Crear nuevo cliente'),
  ('clientes:editar',                   'clientes',     'Editar datos de un cliente'),
  ('clientes:estado',                   'clientes',     'Cambiar estado de un cliente'),
  ('clientes:merge:preview',            'clientes',     'Ver preview de fusión de duplicados'),
  ('clientes:merge:ejecutar',           'clientes',     'Ejecutar fusión de clientes (irreversible)'),
  ('clientes:alias:listar',             'clientes',     'Listar identidades/alias de un cliente'),
  ('clientes:alias:crear',              'clientes',     'Crear alias manual'),
  ('clientes:alias:toggle',             'clientes',     'Activar/desactivar alias'),

  -- Reportes Automáticos
  ('reportes:listar',                   'reportes',     'Listar reportes automáticos configurados'),
  ('reportes:crear',                    'reportes',     'Crear reporte automático'),
  ('reportes:editar',                   'reportes',     'Editar configuración de reporte'),
  ('reportes:toggle',                   'reportes',     'Activar/desactivar reporte'),
  ('reportes:eliminar',                 'reportes',     'Eliminar reporte automático'),
  ('reportes:enviar',                   'reportes',     'Envío manual inmediato de un reporte'),
  ('reportes:clientes',                 'reportes',     'Ver opciones de filtro por cliente'),

  -- Personal
  ('personal:listar',                   'personal',     'Listar personal INLOP'),

  -- ControlT
  ('controlt:viaje',                    'controlt',     'Consultar viaje en ControlT'),
  ('controlt:lista',                    'controlt',     'Listar viajes en ControlT'),
  ('controlt:bitacora',                 'controlt',     'Registrar en bitácora ControlT'),
  ('controlt:diag',                     'controlt',     'Diagnóstico de conectividad SOAP ControlT'),

  -- Planeados
  ('planeados:listar',                  'planeados',    'Listar planeados'),

  -- Configuración (sistema)
  ('configuracion:acceso',              'configuracion','Acceder al módulo de Configuración'),

  -- Admin RBAC (exclusivo master — sin filas en rol_permisos en este sprint)
  ('rbac:gestionar',                    'rbac',         'Gestionar roles y permisos del sistema RBAC')
ON CONFLICT (nombre) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- rol_permisos — matriz aprobada en Sprint 3A
-- ════════════════════════════════════════════════════════════════
-- `master` queda deliberadamente SIN filas aquí. Su acceso total se
-- resuelve por regla especial en tienePermiso() (sprint posterior),
-- no por membresía explícita en rol_permisos.
--
-- `rbac:gestionar` queda deliberadamente SIN asignar a ningún rol —
-- es exclusivo de master vía la misma regla especial.
--
-- Patrón: un INSERT...SELECT por rol, listando los permisos de ese
-- rol por nombre. Idempotente vía ON CONFLICT en la PK compuesta.

-- ─── operador ──────────────────────────────────────────────────────────────
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'operador'
  AND p.nombre IN (
    'viajes:listar', 'viajes:detalle',
    'cumplidos:listar', 'cumplidos:documentos:listar', 'cumplidos:documentos:firmar',
    'solicitudes:listar', 'solicitudes:detalle',
    'programacion:listar', 'programacion:detalle', 'programacion:solicitud', 'programacion:observaciones',
    'gps:listar',
    'clientes:listar', 'clientes:detalle', 'clientes:alias:listar',
    'reportes:listar', 'reportes:clientes',
    'personal:listar',
    'controlt:viaje', 'controlt:lista', 'controlt:diag',
    'planeados:listar'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ─── supervisor ────────────────────────────────────────────────────────────
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'supervisor'
  AND p.nombre IN (
    'viajes:listar', 'viajes:detalle',
    'cumplidos:listar', 'cumplidos:documentos:listar', 'cumplidos:documentos:firmar',
    'cumplidos:documentos:subir', 'cumplidos:documentos:reemplazar', 'cumplidos:estado',
    'solicitudes:listar', 'solicitudes:detalle', 'solicitudes:estado',
    'programacion:listar', 'programacion:detalle', 'programacion:solicitud',
    'programacion:estado', 'programacion:observaciones', 'programacion:sync',
    'gps:listar',
    'clientes:listar', 'clientes:detalle', 'clientes:alias:listar',
    'clientes:crear', 'clientes:editar', 'clientes:estado',
    'clientes:alias:crear', 'clientes:alias:toggle',
    'reportes:listar', 'reportes:clientes',
    'reportes:crear', 'reportes:editar', 'reportes:toggle', 'reportes:enviar',
    'personal:listar',
    'controlt:viaje', 'controlt:lista', 'controlt:diag', 'controlt:bitacora',
    'planeados:listar',
    'configuracion:acceso'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ─── comercial ─────────────────────────────────────────────────────────────
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'comercial'
  AND p.nombre IN (
    'viajes:listar', 'viajes:detalle',
    'cumplidos:listar', 'cumplidos:documentos:listar', 'cumplidos:documentos:firmar',
    'solicitudes:listar', 'solicitudes:detalle',
    'programacion:listar', 'programacion:detalle', 'programacion:solicitud',
    'gps:listar',
    'clientes:listar', 'clientes:detalle', 'clientes:alias:listar',
    'clientes:crear', 'clientes:editar', 'clientes:estado',
    'clientes:alias:crear', 'clientes:alias:toggle',
    'planeados:listar'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ─── admin ─────────────────────────────────────────────────────────────────
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre = 'admin'
  AND p.nombre IN (
    'viajes:listar', 'viajes:detalle',
    'cumplidos:listar', 'cumplidos:documentos:listar', 'cumplidos:documentos:firmar',
    'cumplidos:documentos:subir', 'cumplidos:documentos:reemplazar', 'cumplidos:documentos:eliminar',
    'cumplidos:estado',
    'solicitudes:listar', 'solicitudes:detalle', 'solicitudes:estado',
    'programacion:listar', 'programacion:detalle', 'programacion:solicitud',
    'programacion:estado', 'programacion:observaciones', 'programacion:sync',
    'gps:listar',
    'clientes:listar', 'clientes:detalle', 'clientes:alias:listar',
    'clientes:crear', 'clientes:editar', 'clientes:estado',
    'clientes:alias:crear', 'clientes:alias:toggle',
    'clientes:merge:preview', 'clientes:merge:ejecutar',
    'reportes:listar', 'reportes:clientes',
    'reportes:crear', 'reportes:editar', 'reportes:toggle', 'reportes:enviar', 'reportes:eliminar',
    'personal:listar',
    'controlt:viaje', 'controlt:lista', 'controlt:diag', 'controlt:bitacora',
    'planeados:listar',
    'configuracion:acceso'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- master: sin filas — ver nota arriba.
-- usuario_roles / usuario_permisos: sin filas — fuera de alcance de este sprint.
