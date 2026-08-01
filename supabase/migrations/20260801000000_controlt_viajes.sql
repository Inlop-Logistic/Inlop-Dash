-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: 20260801000000_controlt_viajes
-- Módulo:    ControlT SOAP — GetDetailMonitoringOrder
-- Fase:      1 — Infraestructura base
-- ────────────────────────────────���────────────────────────────────────────────
--
-- Crea la tabla controlt_viajes que sirve como caché persistente (fallback) de
-- las respuestas SOAP de GetDetailMonitoringOrder.
--
-- Decisiones de diseño (Arquitectura v1.0 §6.3 — Cache-aside):
--   • PK = codigo_controlt (número de viaje ControlT, ej. "IN018108").
--     No se usa un ID numérico interno porque el código ControlT es la clave
--     de reconciliación en todos los sistemas INLOP.
--   • Sin FK a otras tablas — el módulo SOAP está desacoplado por diseño
--     (Adapter Pattern §6.1). Si un viaje es eliminado de solicitudes,
--     los datos de ControlT persisten para auditoría.
--   • paradas como JSONB — la estructura de paradas puede variar entre
--     operaciones y tipos de viaje. JSONB evita una tabla relacional de paradas
--     para Fase 1 sin perder la capacidad de consulta indexada en Fase 2+.
--   • sincronizado_en registra cuándo se obtuvo el dato del SOAP, no la fecha
--     del evento de negocio (fecha_evento). El índice sobre sincronizado_en
--     permite purgas periódicas de registros obsoletos en el futuro.
--
-- Esta tabla NO reemplaza ninguna tabla existente (cumplidos, planeados,
-- solicitudes_cliente). Es una capa de caché independiente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS controlt_viajes (
  -- Identificación
  codigo_controlt         TEXT        NOT NULL,

  -- Estado derivado del ciclo de vida del viaje
  -- Valores: PENDIENTE | EN_CARGUE | EN_TRANSITO | EN_DESCARGUE | COMPLETADO
  -- Derivado de los campos de fecha de las paradas (ver tripMapper.js)
  estado_viaje            TEXT        NOT NULL,

  -- Conductor asignado
  conductor_cedula        TEXT,
  conductor_nombre        TEXT,

  -- Codificaciones ControlT (enteros de catálogo)
  tipo_operacion_codigo   INTEGER,
  tipo_viaje_codigo       INTEGER,
  tipo_carga_codigo       INTEGER,

  -- Valores económicos y físicos de la carga
  valor_mercancia         NUMERIC,
  moneda                  TEXT,
  valor_flete             NUMERIC,
  peso_total_ton          NUMERIC,
  volumen_total           NUMERIC,

  -- Control de temperatura (aplica para carga refrigerada)
  temperatura_min         NUMERIC,
  temperatura_max         NUMERIC,

  -- Instrucciones operativas de la orden
  instrucciones           TEXT,

  -- Paradas con coordenadas, estado y ETA (estructura completa del SOAP)
  -- [ { orden, nombre, direccion, lat, lng, estado, hora_programada,
  --     hora_real, eta, tipo } ]
  paradas                 JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Timestamps de control
  -- fecha_evento: fecha del último evento registrado en la orden de ControlT
  fecha_evento            TIMESTAMPTZ,
  -- sincronizado_en: momento en que este registro fue escrito/actualizado
  -- desde el SOAP. Usado para detectar caché obsoleta.
  sincronizado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT controlt_viajes_pkey PRIMARY KEY (codigo_controlt),

  CONSTRAINT controlt_viajes_estado_check CHECK (
    estado_viaje IN ('PENDIENTE', 'EN_CARGUE', 'EN_TRANSITO', 'EN_DESCARGUE', 'COMPLETADO')
  )
);

-- Índice para purgas periódicas y consultas por frescura del dato
CREATE INDEX IF NOT EXISTS idx_controlt_viajes_sync
  ON controlt_viajes (sincronizado_en DESC);

-- Comentarios de tabla y columnas
COMMENT ON TABLE controlt_viajes IS
  'Caché persistente de respuestas SOAP GetDetailMonitoringOrder (ControlT). '
  'Fallback cuando el servicio SOAP no está disponible. '
  'Sin FK a otras tablas — desacoplamiento por diseño (Arquitectura v1.0 §6.1).';

COMMENT ON COLUMN controlt_viajes.codigo_controlt IS
  'Número de viaje ControlT (ej. IN018108). Clave de reconciliación con solicitudes_cliente.controlt_trip_number.';

COMMENT ON COLUMN controlt_viajes.estado_viaje IS
  'Estado derivado del ciclo de vida: PENDIENTE | EN_CARGUE | EN_TRANSITO | EN_DESCARGUE | COMPLETADO.';

COMMENT ON COLUMN controlt_viajes.paradas IS
  'Array JSON de paradas con coordenadas, estado y tiempos. Estructura completa del SOAP GetDetailMonitoringOrder.';

COMMENT ON COLUMN controlt_viajes.sincronizado_en IS
  'Timestamp de la última sincronización exitosa desde el SOAP. NULL imposible — default now().';
