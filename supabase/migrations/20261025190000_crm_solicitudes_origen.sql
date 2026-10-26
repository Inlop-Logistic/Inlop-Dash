-- CRM → ERP: identidad externa estable y recepción transaccional.
-- PROPUESTA PARA REVISIÓN. No ejecutar automáticamente ni aplicar a la base compartida
-- hasta validar respaldo, esquema real y pruebas de contrato.
--
-- Reglas:
-- 1. crm_cliente_id identifica al cliente de origen CRM; no se usa el NIT como clave.
-- 2. Si el cliente no existe, se crea en empresas_cliente y se registra su ID CRM.
-- 3. creador_email debe resolver exactamente un usuario en profiles.
-- 4. empresa_cliente_id y creado_por de solicitudes permanecen NOT NULL.
-- 5. Empresa y solicitud se escriben en una sola transacción mediante RPC.

BEGIN;

ALTER TABLE public.empresas_cliente
  ADD COLUMN IF NOT EXISTS crm_cliente_id TEXT;

-- PostgreSQL permite múltiples NULL en un índice UNIQUE; los IDs CRM no nulos son únicos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_cliente_crm_cliente_id
  ON public.empresas_cliente (crm_cliente_id)
  WHERE crm_cliente_id IS NOT NULL;

ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS crm_solicitud_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_cliente_id TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nombre_externo TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nit_externo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_crm_solicitud_id
  ON public.solicitudes (crm_solicitud_id)
  WHERE crm_solicitud_id IS NOT NULL;

-- Secuencia compartida para códigos de solicitud. Se inicializa al máximo existente.
CREATE SEQUENCE IF NOT EXISTS public.solicitudes_codigo_seq
  AS BIGINT INCREMENT BY 1 MINVALUE 1 START WITH 1 CACHE 1;

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

CREATE OR REPLACE FUNCTION public.recibir_solicitud_crm(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_codigo_solicitud TEXT;
  v_empresa_id UUID;
  v_usuario_ids UUID[];
  v_creador_email TEXT;
  v_cliente_id TEXT;
  v_cliente_nombre TEXT;
  v_cliente_nit TEXT;
  v_cliente_dv TEXT;
  v_agencia_nombre TEXT;
  v_agencia_id UUID;
  v_agencia_ids UUID[];
  v_empresa_creada BOOLEAN := FALSE;
  v_inserted_empresa_id UUID;
  v_inserted_solicitud_id UUID;
  v_inserted_codigo TEXT;
  v_fecha TIMESTAMPTZ;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid_payload');
  END IF;

  -- El ID externo del CRM se maneja como texto estable; no se fuerza a UUID.
  IF NULLIF(btrim(p_payload->>'crm_solicitud_id'), '') IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'crm_solicitud_id_required');
  END IF;
  v_cliente_id := NULLIF(btrim(p_payload->>'crm_cliente_id'), '');
  v_cliente_nombre := NULLIF(btrim(p_payload->>'cliente_nombre'), '');
  v_cliente_nit := NULLIF(btrim(p_payload->>'cliente_nit'), '');
  v_cliente_dv := NULLIF(btrim(p_payload->>'cliente_dv'), '');
  v_creador_email := lower(NULLIF(btrim(p_payload->>'creador_email'), ''));
  v_agencia_nombre := NULLIF(btrim(p_payload#>>'{agencia,nombre}'), '');

  IF v_cliente_id IS NULL OR v_cliente_nombre IS NULL OR v_creador_email IS NULL
     OR v_agencia_nombre IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'required_identity_missing');
  END IF;

  -- Idempotencia temprana: un reintento no depende de que el usuario siga activo.
  SELECT s.id, s.codigo_solicitud, s.empresa_cliente_id
    INTO v_inserted_solicitud_id, v_codigo_solicitud, v_empresa_id
    FROM public.solicitudes s
   WHERE s.crm_solicitud_id = btrim(p_payload->>'crm_solicitud_id')
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', TRUE, 'duplicada', TRUE,
      'solicitud_id', v_inserted_solicitud_id,
      'codigo_solicitud', v_codigo_solicitud,
      'empresa_cliente_id', v_empresa_id,
      'empresa_creada', FALSE
    );
  END IF;

  -- El correo es la llave de correspondencia del creador. Cero o múltiples
  -- perfiles se consideran errores de datos, nunca se usa un creador por defecto.
  SELECT array_agg(p.id)
    INTO v_usuario_ids
    FROM public.profiles p
   WHERE lower(btrim(p.email)) = v_creador_email;

  IF COALESCE(cardinality(v_usuario_ids), 0) = 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'creator_not_found');
  END IF;
  IF cardinality(v_usuario_ids) <> 1 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'creator_ambiguous');
  END IF;

  -- Primero se resuelve la identidad estable CRM. El NIT es solo un atributo.
  SELECT e.id
    INTO v_empresa_id
    FROM public.empresas_cliente e
   WHERE e.crm_cliente_id = v_cliente_id
   LIMIT 1;

  IF v_empresa_id IS NULL THEN
    INSERT INTO public.empresas_cliente (
      razon_social, nombre_controlt, nit, dv, activa, estado, codigo_cliente,
      created_by, updated_at, updated_by, crm_cliente_id
    )
    VALUES (
      v_cliente_nombre, v_cliente_nombre, v_cliente_nit, v_cliente_dv,
      FALSE, 'prospecto', public.next_codigo_cliente(),
      v_creador_email, now(), v_creador_email, v_cliente_id
    )
    ON CONFLICT (crm_cliente_id) WHERE crm_cliente_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_inserted_empresa_id;

    IF v_inserted_empresa_id IS NOT NULL THEN
      v_empresa_id := v_inserted_empresa_id;
      v_empresa_creada := TRUE;

      INSERT INTO public.clientes_info_general (empresa_id, nombre_comercial, pais, updated_by)
      VALUES (v_empresa_id, v_cliente_nombre, 'Colombia', v_creador_email)
      ON CONFLICT (empresa_id) DO NOTHING;

      INSERT INTO public.clientes_relaciones_comerciales (empresa_id, estado_comercial, updated_by)
      VALUES (v_empresa_id, 'prospecto', v_creador_email)
      ON CONFLICT (empresa_id) DO NOTHING;

      INSERT INTO public.clientes_info_tributaria (empresa_id, updated_by)
      VALUES (v_empresa_id, v_creador_email)
      ON CONFLICT (empresa_id) DO NOTHING;

      INSERT INTO public.clientes_historial (
        empresa_id, tipo, descripcion, usuario, usuario_email, metadata
      )
      VALUES (
        v_empresa_id,
        'creacion_automatica',
        'Empresa creada automáticamente desde CRM.',
        v_creador_email,
        v_creador_email,
        jsonb_build_object('origen', 'CRM', 'crm_cliente_id', v_cliente_id)
      );
    ELSE
      -- Otra solicitud concurrente pudo crear el mismo cliente CRM.
      SELECT e.id INTO v_empresa_id
        FROM public.empresas_cliente e
       WHERE e.crm_cliente_id = v_cliente_id
       LIMIT 1;
      IF v_empresa_id IS NULL THEN
        RETURN jsonb_build_object('ok', FALSE, 'error_code', 'customer_identity_conflict');
      END IF;
    END IF;
  END IF;

  -- La agencia enviada por CRM debe resolverse contra el catálogo ERP de la misma empresa.
  -- No se acepta agencia por nombre únicamente ni se confía en un UUID externo.
  IF NULLIF(btrim(p_payload#>>'{agencia,id}'), '') IS NOT NULL THEN
    BEGIN
      v_agencia_id := (p_payload#>>'{agencia,id}')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      v_agencia_id := NULL;
    END;
  END IF;

  IF v_agencia_id IS NOT NULL THEN
    SELECT array_agg(a.id)
      INTO v_agencia_ids
      FROM public.agencias_cliente a
     WHERE a.id = v_agencia_id
       AND a.empresa_cliente_id = v_empresa_id
       AND COALESCE(a.activa, TRUE) = TRUE;
  ELSE
    SELECT array_agg(a.id)
      INTO v_agencia_ids
      FROM public.agencias_cliente a
     WHERE lower(btrim(a.nombre)) = lower(v_agencia_nombre)
       AND a.empresa_cliente_id = v_empresa_id
       AND COALESCE(a.activa, TRUE) = TRUE;
  END IF;

  IF COALESCE(cardinality(v_agencia_ids), 0) = 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'agency_not_found');
  END IF;
  IF cardinality(v_agencia_ids) > 1 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'agency_ambiguous');
  END IF;
  v_agencia_id := v_agencia_ids[1];

  v_fecha := NULLIF(btrim(p_payload->>'fecha_requerida'), '')::TIMESTAMPTZ;
  v_codigo_solicitud := public.generar_codigo_solicitud();

  INSERT INTO public.solicitudes (
    codigo_solicitud, crm_solicitud_id, crm_cliente_id,
    cliente_nombre_externo, cliente_nit_externo,
    empresa_cliente_id, creado_por,
    tipo_vehiculo, tipo_operacion, origen, destino,
    agencia_id, agencia_nombre, external_ref, fecha_requerida,
    observacion_coordinadora, metadata, estado, canal, creado_en
  )
  VALUES (
    v_codigo_solicitud,
    btrim(p_payload->>'crm_solicitud_id'),
    v_cliente_id,
    v_cliente_nombre,
    v_cliente_nit,
    v_empresa_id,
    v_usuario_ids[1],
    btrim(p_payload->>'tipo_vehiculo'),
    lower(btrim(p_payload->>'tipo_operacion')),
    btrim(p_payload->>'origen'),
    btrim(p_payload->>'destino'),
    v_agencia_id,
    v_agencia_nombre,
    btrim(p_payload->>'external_ref'),
    v_fecha,
    NULLIF(btrim(p_payload->>'observaciones_cliente'), ''),
    COALESCE(p_payload->'metadata', '{}'::jsonb) || jsonb_build_object('origen_integracion', 'CRM'),
    'pendiente',
    'CRM',
    now()
  )
  ON CONFLICT (crm_solicitud_id) WHERE crm_solicitud_id IS NOT NULL DO NOTHING
  RETURNING id, codigo_solicitud INTO v_inserted_solicitud_id, v_inserted_codigo;

  IF v_inserted_solicitud_id IS NULL THEN
    SELECT s.id, s.codigo_solicitud, s.empresa_cliente_id
      INTO v_inserted_solicitud_id, v_inserted_codigo, v_empresa_id
      FROM public.solicitudes s
     WHERE s.crm_solicitud_id = btrim(p_payload->>'crm_solicitud_id')
     LIMIT 1;
    RETURN jsonb_build_object(
      'ok', TRUE, 'duplicada', TRUE,
      'solicitud_id', v_inserted_solicitud_id,
      'codigo_solicitud', v_inserted_codigo,
      'empresa_cliente_id', v_empresa_id,
      'empresa_creada', FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE, 'duplicada', FALSE,
    'solicitud_id', v_inserted_solicitud_id,
    'codigo_solicitud', v_inserted_codigo,
    'empresa_cliente_id', v_empresa_id,
    'empresa_creada', v_empresa_creada
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.recibir_solicitud_crm(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recibir_solicitud_crm(JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recibir_solicitud_crm(JSONB) TO service_role;

COMMENT ON COLUMN public.empresas_cliente.crm_cliente_id IS
  'Identificador estable del cliente en el CRM de origen; no depende del NIT.';
COMMENT ON COLUMN public.solicitudes.crm_solicitud_id IS
  'Identificador estable de la solicitud de origen CRM; único para idempotencia.';
COMMENT ON COLUMN public.solicitudes.crm_cliente_id IS
  'Identificador del cliente en CRM que originó la solicitud.';
COMMENT ON FUNCTION public.recibir_solicitud_crm(JSONB) IS
  'Resuelve/crea la empresa por ID CRM, resuelve creador por email y registra la solicitud en una transacción.';

COMMIT;
