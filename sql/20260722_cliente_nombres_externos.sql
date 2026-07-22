-- ─── Identity Rules: nombres externos de integraciones ──────────────────────
-- Almacena la relación N:1 entre nombres externos (ControlT, SYSCAR, etc.)
-- y el cliente oficial del ERP. Se crea automáticamente en cada Customer Merge
-- y puede gestionarse manualmente desde el Maestro de Clientes.
--
-- nombre_normalizado: salida de normalizeClient() — MAYÚS, sin acentos, sin
--   puntos, espacios simples. Indexado para lookup O(1) desde el resolver.
-- nombre_raw: nombre original tal como llega de la integración.
-- fuente: identificador de la integración de origen.
-- origen: 'merge' (automático) | 'manual' (creado por un usuario).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cliente_nombres_externos (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_cliente_id uuid        NOT NULL REFERENCES empresas_cliente(id),
  nombre_normalizado text        NOT NULL,
  nombre_raw         text        NOT NULL,
  fuente             text        NOT NULL DEFAULT 'controlt',
  origen             text        NOT NULL DEFAULT 'merge',
  creado_en          timestamptz NOT NULL DEFAULT now(),
  creado_por         text
);

-- Lookup primario: nombre normalizado + fuente → empresa (unicidad por fuente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cne_nombre_fuente
  ON cliente_nombres_externos (nombre_normalizado, fuente);

-- Lookup inverso: listar todos los nombres de una empresa
CREATE INDEX IF NOT EXISTS idx_cne_empresa
  ON cliente_nombres_externos (empresa_cliente_id);
