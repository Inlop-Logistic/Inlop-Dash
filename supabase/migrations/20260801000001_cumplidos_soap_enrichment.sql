-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: 20260801000001_cumplidos_soap_enrichment
-- Módulo:    ControlT SOAP — Fase 4 (enriquecimiento de cumplidos)
-- Fecha:     2026-08-01
-- Ref:       docs/integraciones/controlt/AUDITORIA_IMPACTO_MODELO_VIAJE.md
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Decisión de arquitectura certificada (Alternativa B):
--   Enriquecer la tabla existente `cumplidos` con datos del SOAP
--   GetDetailMonitoringOrder en lugar de crear una nueva entidad.
--
-- Principios de esta migración:
--   • Todas las columnas nuevas son NULLABLE.
--     NULL significa "SOAP nunca consultado para este viaje".
--     El valor vacío tiene semántica propia: no usar DEFAULT NOT NULL.
--   • Prefijo `soap_` en todas las columnas nuevas.
--     Garantiza cero colisión con columnas existentes y deja clara la
--     procedencia del dato (fuente SOAP vs fuente Resume API).
--   • Ninguna columna existente es modificada, renombrada ni eliminada.
--     Compatibilidad 100 % hacia atrás con el ERP.
--   • Sin FK nuevas — el módulo SOAP sigue desacoplado por diseño
--     (Adapter Pattern, §6.1 del documento de arquitectura).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cumplidos

  -- ── Estado del ciclo de vida derivado del SOAP ──────────────────────────────
  -- Derivado de las horas_real de las paradas por deriveEstado() en tripMapper.js.
  -- Diferente semántica a estado_cumplido (ERP): este describe el progreso
  -- físico del viaje según la telemetría de ControlT.
  -- Valores: PENDIENTE | EN_CARGUE | EN_TRANSITO | EN_DESCARGUE | COMPLETADO
  ADD COLUMN IF NOT EXISTS soap_estado_viaje          TEXT
    CONSTRAINT cumplidos_soap_estado_viaje_check CHECK (
      soap_estado_viaje IS NULL OR
      soap_estado_viaje IN ('PENDIENTE', 'EN_CARGUE', 'EN_TRANSITO', 'EN_DESCARGUE', 'COMPLETADO')
    ),

  -- ── Conductor (identificación completa desde SOAP) ───────────────────────────
  -- `cumplidos.conductor` viene del Resume API (nombre corto, campo libre).
  -- Estas dos columnas traen la cedula y el nombre completo desde el SOAP,
  -- que puede diferir del nombre abreviado del Resume.
  ADD COLUMN IF NOT EXISTS soap_conductor_cedula      TEXT,
  ADD COLUMN IF NOT EXISTS soap_conductor_nombre      TEXT,

  -- ── Codificaciones de catálogo ControlT ──────────────────────────────────────
  -- Enteros que identifican el tipo de operación, tipo de viaje y tipo de carga
  -- en los catálogos internos de ControlT. Útiles para filtros y reportes futuros.
  ADD COLUMN IF NOT EXISTS soap_tipo_operacion_codigo INTEGER,
  ADD COLUMN IF NOT EXISTS soap_tipo_viaje_codigo     INTEGER,
  ADD COLUMN IF NOT EXISTS soap_tipo_carga_codigo     INTEGER,

  -- ── Valores económicos de la carga ───────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS soap_valor_mercancia       NUMERIC,
  ADD COLUMN IF NOT EXISTS soap_moneda                TEXT,
  ADD COLUMN IF NOT EXISTS soap_valor_flete           NUMERIC,

  -- ── Valores físicos de la carga ───────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS soap_peso_total_ton        NUMERIC,
  ADD COLUMN IF NOT EXISTS soap_volumen_total         NUMERIC,

  -- ── Control de temperatura (carga refrigerada) ───────────────────────────────
  ADD COLUMN IF NOT EXISTS soap_temperatura_min       NUMERIC,
  ADD COLUMN IF NOT EXISTS soap_temperatura_max       NUMERIC,

  -- ── Instrucciones operativas de la orden ─────────────────────────────────────
  ADD COLUMN IF NOT EXISTS soap_instrucciones         TEXT,

  -- ── Paradas con coordenadas, estado y ETA ─────────────────────────────────────
  -- Array JSON completo de GetDetailMonitoringOrder.
  -- NULL  → SOAP nunca fue consultado para este viaje.
  -- '[]'  → SOAP consultado pero la orden no tenía paradas registradas.
  -- Estructura por elemento:
  --   { orden, nombre, direccion, lat, lng, estado,
  --     hora_programada, hora_real, eta, tipo,
  --     productos: [{ descripcion, cantidad, unidad, peso_ton, volumen }] }
  ADD COLUMN IF NOT EXISTS soap_paradas               JSONB,

  -- ── Timestamps de control del SOAP ───────────────────────────────────────────
  -- soap_fecha_evento: fecha del último evento registrado en ControlT
  --   (FechaUltimoEvento del SOAP, o la hora_real más reciente de las paradas).
  --   NULL → SOAP nunca consultado. No confundir con fecha_finalizacion (ERP).
  ADD COLUMN IF NOT EXISTS soap_fecha_evento          TIMESTAMPTZ,

  -- soap_sincronizado_en: timestamp de la última escritura exitosa desde el SOAP.
  --   NULL → SOAP nunca consultado para este viaje.
  --   NOT NULL → caché fresca; comparar con NOW() para detectar staleness.
  ADD COLUMN IF NOT EXISTS soap_sincronizado_en       TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice para consultas de frescura del caché SOAP y purgas periódicas.
-- Parcial sobre NOT NULL: excluye las filas sin enriquecimiento SOAP,
-- que son la mayoría en las primeras semanas de operación.
CREATE INDEX IF NOT EXISTS idx_cumplidos_soap_sync
  ON cumplidos (soap_sincronizado_en DESC)
  WHERE soap_sincronizado_en IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Comentarios de columnas
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN cumplidos.soap_estado_viaje IS
  'Estado del ciclo de vida derivado de paradas SOAP: '
  'PENDIENTE | EN_CARGUE | EN_TRANSITO | EN_DESCARGUE | COMPLETADO. '
  'Semántica distinta a estado_cumplido (ERP).';

COMMENT ON COLUMN cumplidos.soap_conductor_cedula IS
  'Cédula del conductor según GetDetailMonitoringOrder. '
  'Complementa conductor (nombre corto del Resume API).';

COMMENT ON COLUMN cumplidos.soap_conductor_nombre IS
  'Nombre completo del conductor según GetDetailMonitoringOrder.';

COMMENT ON COLUMN cumplidos.soap_tipo_operacion_codigo IS
  'Código entero del tipo de operación en catálogo ControlT.';

COMMENT ON COLUMN cumplidos.soap_tipo_viaje_codigo IS
  'Código entero del tipo de viaje en catálogo ControlT.';

COMMENT ON COLUMN cumplidos.soap_tipo_carga_codigo IS
  'Código entero del tipo de carga en catálogo ControlT.';

COMMENT ON COLUMN cumplidos.soap_valor_mercancia IS
  'Valor declarado de la mercancía (en la moneda de soap_moneda).';

COMMENT ON COLUMN cumplidos.soap_moneda IS
  'Código de moneda para soap_valor_mercancia y soap_valor_flete (ej. COP, USD).';

COMMENT ON COLUMN cumplidos.soap_valor_flete IS
  'Valor del flete según ControlT.';

COMMENT ON COLUMN cumplidos.soap_peso_total_ton IS
  'Peso total de la carga en toneladas.';

COMMENT ON COLUMN cumplidos.soap_volumen_total IS
  'Volumen total de la carga (unidad según catálogo ControlT).';

COMMENT ON COLUMN cumplidos.soap_temperatura_min IS
  'Temperatura mínima requerida (carga refrigerada). NULL si no aplica.';

COMMENT ON COLUMN cumplidos.soap_temperatura_max IS
  'Temperatura máxima requerida (carga refrigerada). NULL si no aplica.';

COMMENT ON COLUMN cumplidos.soap_instrucciones IS
  'Instrucciones operativas de la orden en ControlT.';

COMMENT ON COLUMN cumplidos.soap_paradas IS
  'Array JSON de paradas de GetDetailMonitoringOrder. '
  'NULL = SOAP nunca consultado. '
  '''[]'' = consultado, sin paradas. '
  'Estructura: [{ orden, nombre, direccion, lat, lng, estado, '
  'hora_programada, hora_real, eta, tipo, productos: [{...}] }]';

COMMENT ON COLUMN cumplidos.soap_fecha_evento IS
  'Fecha del último evento registrado en ControlT '
  '(FechaUltimoEvento SOAP, o la hora_real más reciente de paradas).';

COMMENT ON COLUMN cumplidos.soap_sincronizado_en IS
  'Timestamp de la última sincronización exitosa desde GetDetailMonitoringOrder. '
  'NULL = SOAP nunca consultado para este viaje. '
  'Usar con idx_cumplidos_soap_sync para detectar caché obsoleta.';
