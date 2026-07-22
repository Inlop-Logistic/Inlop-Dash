-- ─── Identity Rules: cliente_alias ──────────────────────────────────────────
-- Mapeo N:1 entre nombres externos (ControlT, SYSCAR, etc.) y el cliente
-- oficial del ERP. Se crea automáticamente en cada Customer Merge y puede
-- gestionarse manualmente desde la pestaña "Identidades" del Workspace.
--
-- nombre_normalizado: salida de normalizeClient() — MAYÚS, sin acentos, sin
--   puntos, espacios simples. Indexado para lookup O(1) desde el resolver.
-- nombre_raw: nombre original tal como llega de la integración.
-- integracion: identificador de la integración de origen.
-- creado_via: 'merge' (automático) | 'manual' (creado por un usuario).
-- activo: false desactiva la regla sin eliminarla físicamente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cliente_alias (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_cliente_id uuid        NOT NULL REFERENCES empresas_cliente(id),
  nombre_raw         text        NOT NULL,
  nombre_normalizado text        NOT NULL,
  integracion        text        NOT NULL DEFAULT 'controlt',
  creado_via         text        NOT NULL DEFAULT 'merge',
  activo             boolean     NOT NULL DEFAULT true,
  observacion        text,
  creado_en          timestamptz NOT NULL DEFAULT now(),
  creado_por         text
);

-- Lookup primario: nombre normalizado + integración → empresa (unicidad solo sobre activos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ca_nombre_integracion_activo
  ON cliente_alias (nombre_normalizado, integracion) WHERE activo = true;

-- Lookup inverso: listar todos los alias de una empresa
CREATE INDEX IF NOT EXISTS idx_ca_empresa
  ON cliente_alias (empresa_cliente_id);
