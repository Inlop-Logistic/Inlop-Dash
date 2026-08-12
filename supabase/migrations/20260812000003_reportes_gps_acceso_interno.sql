-- ─── SEGUIMIENTO GPS — ACCESO INTERNO SIN OTP (Fase 11B) ────────────────────
-- Internos y externos ahora comparten el MISMO enlace/token/aplicación
-- (seguimiento-gps/) — solo cambia el método de autenticación: un
-- destinatario interno (personal.correo_compartido, personal.activo=true,
-- autorizado para ESTE enlace) entra directo, sin OTP; un externo sigue el
-- flujo OTP existente sin cambios (ver services/gps/otp.js, intacto).
--
-- `destinatarios_internos_autorizados` es la contraparte de
-- `destinatarios_autorizados` (ya existente, para externos): mismo criterio
-- de "whitelist congelada" al crear el enlace — nunca se recalcula contra el
-- reporte en vivo. La pertenencia a `personal` y `personal.activo=true` SÍ
-- se revalida en cada intento de acceso (ver
-- services/gps/accesoInterno.js#resolverAccesoInterno) — un empleado
-- desactivado después de emitido el enlace pierde el acceso inmediato,
-- aunque su correo siga en esta lista congelada.

ALTER TABLE reportes_gps_enlaces
  ADD COLUMN IF NOT EXISTS destinatarios_internos_autorizados jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reportes_gps_enlaces.destinatarios_internos_autorizados IS
  'Array de correos internos (string[], personal.correo_compartido) congelado al crear el enlace — subconjunto de reportes_automaticos.destinatarios.personal_ids resuelto en ese momento. Acceso sin OTP: requiere ADEMÁS que personal.activo=true en el momento del intento (revalidado en cada acceso, no congelado).';
