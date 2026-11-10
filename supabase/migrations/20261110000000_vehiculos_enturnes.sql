-- ════════════════════════════════════════════════════════════════
-- Enturne de Vehículos — tabla y políticas RLS
-- ════════════════════════════════════════════════════════════════
-- PREPARADA PARA REVISIÓN. NO EJECUTADA contra Supabase de producción
-- por esta sesión — ejecutar manualmente en el SQL Editor de Supabase
-- tras aprobación.
--
-- Regla de negocio: una placa solo puede tener UN enturne por día
-- calendario Colombia (America/Bogota). La columna `fecha_operativa`
-- la calcula el backend (utils/fechas.js → fechaHoyColombia(), ya
-- vigente en todo el ERP — ver docs/ERP_DATE_TIME_STANDARD.md) en el
-- momento del INSERT; nunca se confía en la fecha del navegador ni se
-- recalcula en Postgres con NOW(), que correría en UTC del servidor
-- Railway y rompería el corte a medianoche Colombia (ver P-02 del
-- estándar). La restricción UNIQUE es la que garantiza, a nivel de
-- base de datos, que dos solicitudes simultáneas de una misma placa
-- no puedan generar dos filas — Postgres resuelve la carrera, no la
-- aplicación.
--
-- Seguridad — por qué esta tabla NO sigue el patrón RLS permisivo
-- (anon+authenticated USING true) que usan weekend_shifts/personal/
-- committee_commitments en este mismo repo: aquellas tablas nunca son
-- alcanzadas por un usuario genuinamente público sin cuenta — esta sí
-- (el conductor que escanea el QR). Además, `authenticated` en este
-- proyecto Supabase lo comparten el staff ERP (tabla `profiles`) y los
-- usuarios del Portal Cliente (tabla `usuarios_cliente`, ver
-- requireClienteAuth en index.js) — ambos obtienen el mismo rol
-- Postgres `authenticated` al autenticarse, aunque sean audiencias
-- completamente distintas. Un policy `TO authenticated USING (true)`
-- dejaría leer los enturnes a cualquier usuario del Portal Cliente,
-- no solo al staff ERP. Por eso el SELECT exige además una fila en
-- `profiles` con `activo = true` — el mismo predicado exacto que ya
-- aplica verificarJwtErpActivo() en index.js para aceptar un JWT como
-- "ERP activo" (fail-closed, mismo criterio en ambas capas).
--
-- El INSERT público NO tiene policy para `anon` ni `authenticated`:
-- el único camino de escritura es el backend (POST /api/enturnes),
-- que usa SUPABASE_SERVICE_KEY — ese rol de Postgres (`service_role`)
-- atraviesa RLS por diseño de Supabase, así que no necesita policy
-- propia. Esto es intencional: nadie puede insertar directo contra
-- Supabase con la anon key, solo a través del endpoint que valida y
-- normaliza en el servidor.

CREATE TABLE IF NOT EXISTS vehiculos_enturnes (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre                TEXT        NOT NULL,
  placa                 TEXT        NOT NULL,              -- tal como la escribió el conductor, sin normalizar
  placa_normalizada     TEXT        NOT NULL,               -- mayúsculas, sin espacios — ver normalizarPlaca() en index.js
  tipo_vehiculo         TEXT        NOT NULL CHECK (tipo_vehiculo IN ('NHR','Turbo','Sencillo','Dobletroque','Patineta','Tractomula')),
  tipo_carroceria       TEXT        NOT NULL CHECK (tipo_carroceria IN ('Estaca','Furgón','Plancha','Cisterna')),
  capacidad_toneladas   NUMERIC     NOT NULL CHECK (capacidad_toneladas > 0),
  volumen_m3            NUMERIC     NULL CHECK (volumen_m3 IS NULL OR volumen_m3 > 0),
  ruta_frecuente        TEXT        NOT NULL,
  fecha_operativa       DATE        NOT NULL,               -- calculada en el backend con fechaHoyColombia(), nunca con NOW()
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Regla fundamental del proyecto: una placa, un enturne por día calendario Colombia.
  CONSTRAINT vehiculos_enturnes_placa_dia_unico UNIQUE (placa_normalizada, fecha_operativa)
);

CREATE INDEX IF NOT EXISTS idx_vehiculos_enturnes_fecha
  ON vehiculos_enturnes (fecha_operativa DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehiculos_enturnes_busqueda
  ON vehiculos_enturnes (placa_normalizada);

ALTER TABLE vehiculos_enturnes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ve_select_erp_activo" ON vehiculos_enturnes;

CREATE POLICY "ve_select_erp_activo" ON vehiculos_enturnes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.activo = true
    )
  );

-- Sin policy de INSERT/UPDATE/DELETE para anon ni authenticated a propósito
-- (ver nota arriba) — el servicio backend usa service_role, que atraviesa RLS.

-- ════════════════════════════════════════════════════════════════
-- VALIDACIÓN — ejecutar después de aplicar, antes de dar por buena la migración
-- ════════════════════════════════════════════════════════════════

-- V1. La tabla y la restricción UNIQUE existen
SELECT
  CASE WHEN COUNT(*) = 1 THEN '✅ V1 OK — tabla vehiculos_enturnes existe'
       ELSE '❌ V1 FALLO' END AS validacion_v1
FROM information_schema.tables
WHERE table_name = 'vehiculos_enturnes';

SELECT
  CASE WHEN COUNT(*) = 1 THEN '✅ V2 OK — restricción UNIQUE(placa_normalizada, fecha_operativa) existe'
       ELSE '❌ V2 FALLO' END AS validacion_v2
FROM pg_constraint
WHERE conname = 'vehiculos_enturnes_placa_dia_unico';

-- V3. RLS está habilitado
SELECT
  CASE WHEN relrowsecurity THEN '✅ V3 OK — RLS habilitado'
       ELSE '❌ V3 FALLO — RLS deshabilitado' END AS validacion_v3
FROM pg_class WHERE relname = 'vehiculos_enturnes';

-- V4. Exactamente una policy (SELECT), sin policies de escritura para anon/authenticated
SELECT
  CASE WHEN COUNT(*) = 1 THEN '✅ V4 OK — solo 1 policy (SELECT erp activo)'
       ELSE '❌ V4 FALLO — se esperaba 1 policy, encontradas: ' || COUNT(*)::text END AS validacion_v4
FROM pg_policies WHERE tablename = 'vehiculos_enturnes';
