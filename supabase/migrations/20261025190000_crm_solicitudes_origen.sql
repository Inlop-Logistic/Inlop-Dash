-- CRM → ERP: persistencia de origen sin crear clientes maestros.
-- PROPUESTA PARA REVISIÓN: no ejecutar automáticamente ni aplicar a producción.
-- La recepción HTTP solo debe habilitarse después de validar esta migración,
-- el secreto CRM_INGESTION_API_KEY y el servicio backend de Desarrollo.

BEGIN;

ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS crm_solicitud_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_cliente_id TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nombre_externo TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nit_externo TEXT;

-- Las solicitudes CRM no tienen usuario interno ni cliente maestro ERP.
-- Las FK siguen protegiendo los valores no nulos; NULL representa un origen externo.
ALTER TABLE public.solicitudes
  ALTER COLUMN empresa_cliente_id DROP NOT NULL,
  ALTER COLUMN creado_por DROP NOT NULL;

-- Idempotencia: el ID estable de la solicitud CRM solo puede existir una vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_crm_solicitud_id
  ON public.solicitudes (crm_solicitud_id);

-- Secuencia común para todos los canales de creación de solicitudes.
-- Inicializarla con el máximo SOL- numérico existente evita reiniciar el contador.
CREATE SEQUENCE IF NOT EXISTS public.solicitudes_codigo_seq
  AS BIGINT
  INCREMENT BY 1
  MINVALUE 1
  START WITH 1
  CACHE 1;

DO $$
DECLARE
  max_codigo BIGINT;
BEGIN
  SELECT COALESCE(MAX(substring(codigo_solicitud FROM '^SOL-([0-9]+)$')::BIGINT), 0)
    INTO max_codigo
    FROM public.solicitudes;

  IF max_codigo > 0 THEN
    PERFORM setval('public.solicitudes_codigo_seq', max_codigo, true);
  ELSE
    PERFORM setval('public.solicitudes_codigo_seq', 1, false);
  END IF;
END
$$;

-- Función RPC para que ERP y CRM compartan el mismo generador atómico.
CREATE OR REPLACE FUNCTION public.generar_codigo_solicitud()
RETURNS TEXT
LANGUAGE SQL
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 'SOL-' || lpad(nextval('public.solicitudes_codigo_seq'::regclass)::TEXT, 5, '0');
$function$;

REVOKE ALL ON FUNCTION public.generar_codigo_solicitud() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generar_codigo_solicitud() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generar_codigo_solicitud() TO service_role;
GRANT USAGE ON SEQUENCE public.solicitudes_codigo_seq TO service_role;

COMMENT ON COLUMN public.solicitudes.crm_solicitud_id IS
  'Identificador estable de la solicitud de origen CRM; único para idempotencia.';
COMMENT ON COLUMN public.solicitudes.crm_cliente_id IS
  'Identificador del cliente en CRM; no es una FK al maestro de clientes ERP.';
COMMENT ON COLUMN public.solicitudes.cliente_nombre_externo IS
  'Nombre del cliente recibido desde CRM para mostrar sin crear cliente maestro.';
COMMENT ON COLUMN public.solicitudes.cliente_nit_externo IS
  'NIT recibido desde CRM como dato de referencia, no como alta de cliente ERP.';
COMMENT ON FUNCTION public.generar_codigo_solicitud() IS
  'Genera un código SOL- único y atómico compartido por todos los canales de solicitudes.';

COMMIT;
