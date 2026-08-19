-- ════════════════════════════════════════════════════════════════
-- Sprint 3B — RBAC ERP: infraestructura de datos (DDL)
-- ════════════════════════════════════════════════════════════════
-- Alcance: EXCLUSIVAMENTE /erp. NO toca Portal Cliente (admin_cliente,
-- usuarios_cliente), NO toca GPS Externo, NO toca legacy (TorreControl,
-- Operaciones_project.html), NO modifica `profiles` ni su RLS.
--
-- Este script SOLO crea tablas — no inserta datos (ver
-- 20260819_rbac_seed.sql) y no implementa lógica de autorización
-- (requirePermiso / tienePermiso se implementan en un sprint posterior).
--
-- Referencia de diseño: Sprint 3A — Modelo RBAC para INLOP ERP
-- (artifact publicado, sin persistir en el repo).
--
-- Ejecución: MANUAL, por el administrador, en el SQL Editor de Supabase.
-- No se ejecuta desde este sprint contra producción.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. roles ──────────────────────────────────────────────────────────────
-- Catálogo de roles del ERP. Los 5 roles del sistema (es_sistema=true) son
-- inmutables — no se editan ni eliminan, solo se (des)asignan a usuarios.
CREATE TABLE IF NOT EXISTS roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT        NOT NULL UNIQUE,
  descripcion TEXT,
  es_sistema  BOOLEAN     NOT NULL DEFAULT false,
  activo      BOOLEAN     NOT NULL DEFAULT true,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por  TEXT
);

-- ─── 2. permisos ───────────────────────────────────────────────────────────
-- Catálogo de permisos granulares. `nombre` sigue la convención
-- "modulo:accion" (ej: "cumplidos:documentos:eliminar").
CREATE TABLE IF NOT EXISTS permisos (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT    NOT NULL UNIQUE,
  modulo      TEXT    NOT NULL,
  descripcion TEXT,
  es_sistema  BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_permisos_modulo ON permisos(modulo);

-- ─── 3. rol_permisos ───────────────────────────────────────────────────────
-- N:M entre roles y permisos. Define qué puede hacer cada rol.
-- `master` NO recibe filas aquí (ver nota en el seed) — su acceso total se
-- resuelve en tienePermiso() en un sprint posterior, no por filas explícitas.
CREATE TABLE IF NOT EXISTS rol_permisos (
  rol_id     UUID NOT NULL REFERENCES roles(id)    ON DELETE CASCADE,
  permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

-- ─── 4. usuario_roles ────────────────────────────────────────────────────
-- Asignación de roles a usuarios del ERP (profiles). Un usuario puede tener
-- múltiples roles activos (unión de permisos). Vacía en este sprint — la
-- migración desde profiles.rol se hace en un sprint posterior.
CREATE TABLE IF NOT EXISTS usuario_roles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rol_id       UUID        NOT NULL REFERENCES roles(id)    ON DELETE RESTRICT,
  asignado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  asignado_por TEXT,
  activo       BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (profile_id, rol_id)
);

CREATE INDEX IF NOT EXISTS idx_ur_profile ON usuario_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_ur_rol     ON usuario_roles(rol_id);

-- ─── 5. usuario_permisos ───────────────────────────────────────────────────
-- Excepciones individuales de permiso por usuario, superpuestas a los
-- permisos que ya concede su rol. NO reemplaza rol_permisos.
--
-- Permiso efectivo (a implementar en el motor de autorización, no aquí):
--   permisos del rol + grants individuales − revokes individuales
--
-- Vacía en este sprint — no se asignan excepciones todavía.
CREATE TABLE IF NOT EXISTS usuario_permisos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  permiso_id   UUID        NOT NULL REFERENCES permisos(id)  ON DELETE CASCADE,
  efecto       TEXT        NOT NULL CHECK (efecto IN ('grant', 'revoke')),
  asignado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  asignado_por TEXT,
  activo       BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (profile_id, permiso_id)
);

CREATE INDEX IF NOT EXISTS idx_up_profile ON usuario_permisos(profile_id);
CREATE INDEX IF NOT EXISTS idx_up_permiso ON usuario_permisos(permiso_id);

-- ════════════════════════════════════════════════════════════════
-- RLS — acceso exclusivo por service_role (backend), sin policies
-- abiertas para anon ni authenticated. Mismo patrón defensivo que
-- las tablas ERP-exclusivas identificadas en Sprint 2B-2.
--
-- Nota: no se crea ninguna policy — con RLS habilitado y sin
-- policies, solo service_role (que bypassea RLS) puede leer/escribir.
-- anon y authenticated quedan bloqueados por defecto.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rol_permisos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_permisos ENABLE ROW LEVEL SECURITY;

-- No se modifica RLS de ninguna tabla existente (profiles, personal,
-- reportes_automaticos, etc.) — fuera de alcance de este sprint.
