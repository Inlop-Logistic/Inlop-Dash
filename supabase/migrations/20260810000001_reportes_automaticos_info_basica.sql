-- ─── REPORTES AUTOMÁTICOS — Fase 3: Información básica ──────────────────────
-- Añade los campos de la sección "Información básica" al formulario de creación.
--
-- Decisión arquitectónica: modulo_id y tipo_reporte son claves de máquina
-- estables. Los labels visibles viven solo en el catálogo del frontend —
-- si un label cambia, los reportes existentes no se rompen.

ALTER TABLE reportes_automaticos
  ADD COLUMN IF NOT EXISTS modulo_id  text  NOT NULL DEFAULT 'gestion_logistica',
  ADD COLUMN IF NOT EXISTS asunto     text,
  ADD COLUMN IF NOT EXISTS cuerpo     text,
  ADD COLUMN IF NOT EXISTS formato    text  NOT NULL DEFAULT 'excel'
                            CHECK (formato IN ('excel', 'html_filas', 'html_columnas'));

-- Backfill: los registros existentes (tipo_reporte = 'viajes_activos') ya
-- reciben 'gestion_logistica' por el DEFAULT. Confirmar explícitamente.
UPDATE reportes_automaticos
  SET modulo_id = 'gestion_logistica'
  WHERE tipo_reporte = 'viajes_activos';

COMMENT ON COLUMN reportes_automaticos.modulo_id IS 'Clave estable del módulo ERP (ej. gestion_logistica). Desacoplada del label visible — el label puede cambiar sin afectar registros.';
COMMENT ON COLUMN reportes_automaticos.asunto    IS 'Asunto del correo electrónico de entrega del reporte.';
COMMENT ON COLUMN reportes_automaticos.cuerpo    IS 'Cuerpo del correo (texto plano o HTML básico).';
COMMENT ON COLUMN reportes_automaticos.formato   IS 'Formato del adjunto: excel | html_filas | html_columnas.';
