-- Migration 0004: notification_preferences
-- Sprint 6.0 — Sistema de Preferencias de Notificaciones
--
-- Modelo opt-out: si un usuario no tiene fila para un canal, se interpreta
-- como habilitado (true). Solo se crea fila cuando el usuario cambia una
-- preferencia explícitamente. Esto elimina necesidad de seed/trigger al
-- crear usuarios y escala a N canales sin overhead.
--
-- La validación de canales válidos vive en la lógica del backend, no en la
-- base de datos, para permitir agregar canales futuros (whatsapp, sms, teams,
-- slack) sin migraciones adicionales.
--
-- empresa_id incluido para soportar la visión multiempresa del ERP: permite
-- queries administrativas por empresa sin join a usuarios_cliente, y habilita
-- futuras políticas de preferencias a nivel empresa.

CREATE TABLE IF NOT EXISTS notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL,
  canal       TEXT NOT NULL,
  habilitado  BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_notification_pref_usuario_canal UNIQUE (usuario_id, canal)
);

CREATE INDEX idx_notification_pref_usuario
  ON notification_preferences (usuario_id);

CREATE INDEX idx_notification_pref_empresa
  ON notification_preferences (empresa_id);

-- RLS: cada usuario solo ve y modifica sus propias preferencias.
-- El backend (service_role key) bypassa RLS para consultas administrativas.
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_lee_sus_preferencias"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "usuario_inserta_sus_preferencias"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "usuario_actualiza_sus_preferencias"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "usuario_elimina_sus_preferencias"
  ON notification_preferences FOR DELETE
  USING (auth.uid() = usuario_id);
