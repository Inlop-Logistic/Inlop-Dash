-- ─── SEGUIMIENTO GPS EXTERNO — Reportes Automáticos (Fase 10B) ──────────────
-- Módulo: Reportes Automáticos (Gestión Logística) → enlace temporal de
-- seguimiento GPS, limitado a las placas incluidas en un reporte concreto.
--
-- Diseño (ver docs/REPORTES_SEGUIMIENTO_GPS_ARQUITECTURA.md, Fase 10A, §5):
--   - El enlace ("reportes_gps_enlaces") congela, al momento de crearse, la
--     lista de placas autorizadas y los correos externos autorizados — NUNCA
--     se recalculan en caliente contra el reporte, así que editar el reporte
--     después no cambia retroactivamente qué puede ver un enlace ya emitido.
--   - Solo se almacenan HASHES (sha256) del token del enlace y del código
--     OTP — nunca el secreto en texto plano. El valor en claro solo existe
--     en memoria durante la request que lo genera/valida, nunca se persiste.
--   - "reportes_gps_enlaces_otp" registra cada desafío OTP emitido para un
--     (enlace, correo) — de un solo uso, expiración corta, con contador de
--     intentos fallidos.
--   - "reportes_gps_enlaces_sesiones" es la sesión temporal de solo lectura
--     que se emite tras validar el OTP — su expiración nunca puede superar
--     la del enlace que la originó (se aplica en código, no en SQL, ver
--     services/gps/sesiones.js).
--   - "reportes_gps_enlaces_accesos" es un log de auditoría de solo
--     inserción (append-only) — cada intento de acceso (válido o no) queda
--     registrado, sin importar el resultado.
--
-- Sin RLS (igual que reportes_automaticos y el resto de tablas operativas
-- del backend): el acceso siempre pasa por el backend Express con
-- SUPABASE_SERVICE_KEY — nunca se consulta esta tabla directamente desde el
-- frontend.

-- ─── Enlaces ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reportes_gps_enlaces (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id                  uuid        NOT NULL REFERENCES reportes_automaticos(id) ON DELETE CASCADE,
  token_hash                  text        NOT NULL UNIQUE,
  placas                      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  destinatarios_autorizados   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  expira_en                   timestamptz NOT NULL,
  revocado                    boolean     NOT NULL DEFAULT false,
  revocado_en                 timestamptz,
  origen                      text,
  creado_por                  text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  reportes_gps_enlaces IS
  'Enlace temporal de seguimiento GPS para destinatarios externos de un Reporte Automático (Fase 10). Placas y destinatarios congelados al crearse.';
COMMENT ON COLUMN reportes_gps_enlaces.token_hash IS
  'sha256(token) en hexadecimal. El token en claro NUNCA se persiste — solo existe una vez, en la respuesta de creación.';
COMMENT ON COLUMN reportes_gps_enlaces.placas IS
  'Array de placas (string[]) congelado al momento de crear el enlace — nunca se recalcula contra el reporte en vivo.';
COMMENT ON COLUMN reportes_gps_enlaces.destinatarios_autorizados IS
  'Array de correos externos (string[]) congelado al crear el enlace — subconjunto de reportes_automaticos.destinatarios.correos_externos en ese momento.';
COMMENT ON COLUMN reportes_gps_enlaces.origen IS
  'Qué disparó la creación del enlace: manual | scheduler (mismo criterio que envíos — Fase 9E/9F). Informativo, no se usa para autorizar.';

CREATE INDEX IF NOT EXISTS idx_reportes_gps_enlaces_reporte ON reportes_gps_enlaces(reporte_id);

-- ─── Desafíos OTP ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reportes_gps_enlaces_otp (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  enlace_id   uuid        NOT NULL REFERENCES reportes_gps_enlaces(id) ON DELETE CASCADE,
  correo      text        NOT NULL,
  otp_hash    text        NOT NULL,
  expira_en   timestamptz NOT NULL,
  intentos    integer     NOT NULL DEFAULT 0,
  usado       boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  reportes_gps_enlaces_otp IS
  'Desafíos OTP emitidos para verificar el correo de un destinatario externo antes de abrir una sesión de seguimiento GPS. Un solo uso, expiración corta.';
COMMENT ON COLUMN reportes_gps_enlaces_otp.otp_hash IS
  'sha256(código de 6 dígitos). El código en claro solo se envía por correo — nunca se persiste.';
COMMENT ON COLUMN reportes_gps_enlaces_otp.intentos IS
  'Intentos de validación fallidos contra este desafío — se invalida al superar el máximo (ver services/gps/otp.js).';

CREATE INDEX IF NOT EXISTS idx_reportes_gps_enlaces_otp_enlace_correo
  ON reportes_gps_enlaces_otp(enlace_id, correo);

-- ─── Sesiones temporales (solo lectura) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS reportes_gps_enlaces_sesiones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  enlace_id           uuid        NOT NULL REFERENCES reportes_gps_enlaces(id) ON DELETE CASCADE,
  correo              text        NOT NULL,
  sesion_token_hash   text        NOT NULL UNIQUE,
  expira_en           timestamptz NOT NULL,
  revocada            boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  reportes_gps_enlaces_sesiones IS
  'Sesión temporal de solo lectura emitida tras validar el OTP — su expiración nunca supera la del enlace que la originó (aplicado en código).';
COMMENT ON COLUMN reportes_gps_enlaces_sesiones.sesion_token_hash IS
  'sha256(token de sesión). El token en claro solo se devuelve una vez, al validar el OTP.';

CREATE INDEX IF NOT EXISTS idx_reportes_gps_enlaces_sesiones_enlace ON reportes_gps_enlaces_sesiones(enlace_id);

-- ─── Auditoría de accesos (append-only) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS reportes_gps_enlaces_accesos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  enlace_id   uuid        REFERENCES reportes_gps_enlaces(id) ON DELETE SET NULL,
  correo      text,
  evento      text        NOT NULL,
  exitoso     boolean     NOT NULL DEFAULT true,
  detalle     jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  reportes_gps_enlaces_accesos IS
  'Log de auditoría de solo inserción: cada intento de validar enlace, solicitar/validar OTP o consultar vehículos, exitoso o no.';
COMMENT ON COLUMN reportes_gps_enlaces_accesos.evento IS
  'enlace_validado | otp_solicitado | otp_validado | otp_fallido | otp_limite_excedido | sesion_creada | vehiculos_consultados | rate_limit_excedido';

CREATE INDEX IF NOT EXISTS idx_reportes_gps_enlaces_accesos_enlace ON reportes_gps_enlaces_accesos(enlace_id);
CREATE INDEX IF NOT EXISTS idx_reportes_gps_enlaces_accesos_created_at ON reportes_gps_enlaces_accesos(created_at);
