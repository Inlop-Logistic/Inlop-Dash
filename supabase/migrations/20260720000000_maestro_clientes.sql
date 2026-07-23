-- ══════════════════════════════════════════════════════════════════════════════
-- MAESTRO DE CLIENTES — Tablas satélite de empresas_cliente
-- Fase 1A: estructura base para el workspace de clientes del ERP INLOP
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Información General (1:1) ─────────────────────────────────────────────────
create table if not exists clientes_info_general (
  empresa_id          uuid primary key references empresas_cliente(id) on delete cascade,
  nombre_comercial    text,
  sector_economico    text,
  ciudad_principal    text,
  departamento        text,
  pais                text default 'Colombia',
  direccion           text,
  telefono            text,
  pagina_web          text,
  descripcion         text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── Información Tributaria (1:1) ──────────────────────────────────────────────
create table if not exists clientes_info_tributaria (
  empresa_id          uuid primary key references empresas_cliente(id) on delete cascade,
  regimen_tributario  text,       -- simple, ordinario
  tipo_contribuyente  text,       -- persona_natural, persona_juridica
  responsable_iva     boolean default false,
  gran_contribuyente  boolean default false,
  autorretenedor      boolean default false,
  actividad_economica text,       -- código CIIU
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── Relaciones Comerciales (1:1) ──────────────────────────────────────────────
create table if not exists clientes_relaciones_comerciales (
  empresa_id              uuid primary key references empresas_cliente(id) on delete cascade,
  ejecutivo_comercial     text,
  coordinador_operativo   text,
  director_comercial      text,
  segmento                text,
  canal_comercial         text,
  clasificacion_abc       char(1) check (clasificacion_abc in ('A','B','C')),
  nivel_estrategico       text    check (nivel_estrategico in ('estrategico','clave','estandar','transaccional')),
  estado_comercial        text    check (estado_comercial in ('activo','inactivo','suspendido','prospecto')) default 'activo',
  etiquetas               text[]  default '{}',
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ── Condiciones Comerciales (1:1) ─────────────────────────────────────────────
create table if not exists clientes_condiciones_comerciales (
  empresa_id              uuid primary key references empresas_cliente(id) on delete cascade,
  forma_pago              text,       -- contado, credito_30, credito_60, credito_90
  plazo_pago_dias         integer,
  limite_credito          numeric(18,2),
  moneda                  text default 'COP',
  descuento_comercial_pct numeric(5,2) default 0,
  correo_facturacion      text,
  forma_envio_factura     text,       -- email, fisico, portal
  requiere_orden_compra   boolean default false,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ── Condiciones Operativas (1:1) ──────────────────────────────────────────────
create table if not exists clientes_condiciones_operativas (
  empresa_id              uuid primary key references empresas_cliente(id) on delete cascade,
  horario_atencion        text,
  requiere_epp            boolean default false,
  epp_detalle             text,
  requiere_induccion      boolean default false,
  induccion_detalle       text,
  restricciones_vehiculo  text,
  restricciones_conductor text,
  observaciones           text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ── Contactos (1:N) ───────────────────────────────────────────────────────────
create table if not exists clientes_contactos (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references empresas_cliente(id) on delete cascade,
  nombre              text not null,
  cargo               text,
  area                text,
  telefono            text,
  celular             text,
  email               text,
  es_principal        boolean default false,
  es_facturacion      boolean default false,
  activo              boolean default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_clientes_contactos_empresa on clientes_contactos(empresa_id);

-- ── Sedes (1:N) ───────────────────────────────────────────────────────────────
create table if not exists clientes_sedes (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references empresas_cliente(id) on delete cascade,
  nombre              text not null,
  direccion           text,
  ciudad              text,
  departamento        text,
  es_principal        boolean default false,
  telefono            text,
  email               text,
  observaciones       text,
  activa              boolean default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_clientes_sedes_empresa on clientes_sedes(empresa_id);

-- ── Documentos (1:N) ──────────────────────────────────────────────────────────
create table if not exists clientes_documentos (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references empresas_cliente(id) on delete cascade,
  tipo                text not null,   -- rut, camara_comercio, contrato, otro
  nombre              text not null,
  url                 text,
  numero              text,
  fecha_emision       date,
  fecha_vencimiento   date,
  estado              text default 'vigente' check (estado in ('vigente','por_vencer','vencido')),
  observaciones       text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_clientes_documentos_empresa on clientes_documentos(empresa_id);

-- ── Historial (1:N) ───────────────────────────────────────────────────────────
create table if not exists clientes_historial (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references empresas_cliente(id) on delete cascade,
  tipo                text not null,   -- cambio_estado, nota, documento, contacto
  descripcion         text not null,
  usuario             text,
  metadata            jsonb,
  created_at          timestamptz default now()
);

create index if not exists idx_clientes_historial_empresa on clientes_historial(empresa_id);
create index if not exists idx_clientes_historial_fecha   on clientes_historial(created_at desc);
