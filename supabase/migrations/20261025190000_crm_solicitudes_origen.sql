-- CRM → ERP: persistencia de origen sin crear clientes maestros.
-- PROPUESTA PARA REVISIÓN: no ejecutar automáticamente ni aplicar a producción.
-- La recepción HTTP solo debe habilitarse después de revisar este cambio y
-- configurar un secreto dedicado para el entorno de Desarrollo.

BEGIN;

ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS crm_solicitud_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_cliente_id TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nombre_externo TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nit_externo TEXT;

-- Las solicitudes originadas en CRM no deben exigir una fila de cliente ni
-- un usuario humano del ERP. Las filas existentes conservan sus valores.
ALTER TABLE public.solicitudes
  ALTER COLUMN empresa_cliente_id DROP NOT NULL,
  ALTER COLUMN creado_por DROP NOT NULL;

-- Protección en base de datos contra reintentos concurrentes del mismo origen.
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_crm_solicitud_id
  ON public.solicitudes (crm_solicitud_id)
  WHERE crm_solicitud_id IS NOT NULL;

COMMENT ON COLUMN public.solicitudes.crm_solicitud_id IS
  'Identificador estable de la solicitud de origen CRM; único para idempotencia.';
COMMENT ON COLUMN public.solicitudes.crm_cliente_id IS
  'Identificador del cliente en CRM; no es una FK al maestro de clientes ERP.';
COMMENT ON COLUMN public.solicitudes.cliente_nombre_externo IS
  'Nombre del cliente recibido desde CRM para mostrar sin crear cliente maestro.';
COMMENT ON COLUMN public.solicitudes.cliente_nit_externo IS
  'NIT recibido desde CRM como dato de referencia, no como alta de cliente ERP.';

COMMIT;
