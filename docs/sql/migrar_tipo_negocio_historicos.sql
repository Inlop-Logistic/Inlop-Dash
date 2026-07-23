-- Migración: tipo_negocio en registros históricos de cumplidos
-- Evolución 02 — Fase 2
--
-- Propósito: añadir la columna tipo_negocio y clasificar registros históricos
--            que no tienen ese dato porque fueron sincronizados antes de la Evolución 02.
--
-- Precondiciones:
--   - Ejecutar en Supabase SQL Editor con rol service_role.
--   - Aplicar UNA sola vez. El WHERE tipo_negocio = '' evita sobreescribir datos ya correctos.
--
-- Exclusión expresa:
--   - Registros del cliente "Integral Logistics Operations SAS" NO se modifican.
--   - Registros sin coincidencia de cliente quedan en '' (Carga Seca por defecto en app).
--
-- Clasificación: basada únicamente en nombre de cliente almacenado en columna `cliente`.
--   A futuro, type_operation del TMS determina la línea de negocio automáticamente.

-- ── Paso 1: Añadir columna si no existe ───────────────────────────────────────

ALTER TABLE cumplidos
  ADD COLUMN IF NOT EXISTS tipo_negocio TEXT NOT NULL DEFAULT '';

-- ── Paso 2: Marcar Carga Líquida ─────────────────────────────────────────────

UPDATE cumplidos
SET    tipo_negocio = 'Granel Liquido'
WHERE  tipo_negocio = ''
  AND  cliente NOT ILIKE '%Integral Logistics Operations SAS%'
  AND  (
         cliente ILIKE '%ATLANTIC MARINE FUELS%'
      OR cliente ILIKE '%CI PRODEXPORT DE COLOMBIA%'
      OR cliente ILIKE '%FRONTERA ENERGY COLOMBIA%'
      OR cliente ILIKE '%INDUSTRIA AMBIENTAL%'
      OR cliente ILIKE '%TRANSOIL DE COLOMBIA%'
       );

-- ── Paso 3: Marcar Carga Seca ─────────────────────────────────────────────────
-- Solo los clientes conocidos; el resto permanece vacío
-- (la app los muestra como "Carga Seca" por ser el valor por defecto).

UPDATE cumplidos
SET    tipo_negocio = 'Carga Seca'
WHERE  tipo_negocio = ''
  AND  cliente NOT ILIKE '%Integral Logistics Operations SAS%'
  AND  (
         cliente ILIKE '%EMPRESA COLOMBIANA DE PRODUCTOS VETERINARIOS%'
      OR cliente ILIKE '%JEHS INGENIERIA%'
      OR cliente ILIKE '%LHOIST COLOMBIA%'
      OR cliente ILIKE '%LOGISTICA Y DISTRIBUCION ESPECIALIZADA%'
      OR cliente ILIKE '%PRODUCTOS RAMO%'
      OR cliente ILIKE '%QMAX SOLUTIONS COLOMBIA%'
       );

-- ── Verificación post-migración ───────────────────────────────────────────────

SELECT
  tipo_negocio,
  COUNT(*) AS registros
FROM  cumplidos
GROUP BY tipo_negocio
ORDER BY registros DESC;
