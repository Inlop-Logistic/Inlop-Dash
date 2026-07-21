-- ══════════════════════════════════════════════════════════════════════════════
-- MAESTRO DE CLIENTES — Fase 2: código interno, estado propio, auditoría
-- ══════════════════════════════════════════════════════════════════════════════

-- ── empresas_cliente: campos nuevos ──────────────────────────────────────────

alter table empresas_cliente
  add column if not exists codigo_cliente text unique,
  add column if not exists dv             text,
  add column if not exists estado         text not null default 'prospecto'
    check (estado in ('activo','inactivo','suspendido','prospecto','bloqueado')),
  add column if not exists created_by     text,
  add column if not exists updated_at     timestamptz default now(),
  add column if not exists updated_by     text;

-- Índice para búsquedas por código
create unique index if not exists idx_empresas_cliente_codigo
  on empresas_cliente(codigo_cliente)
  where codigo_cliente is not null;

-- Secuencia para generar CLI-XXXXXX
create sequence if not exists seq_codigo_cliente start 1;

-- Función que devuelve el próximo código
create or replace function next_codigo_cliente()
returns text language sql as $$
  select 'CLI-' || lpad(nextval('seq_codigo_cliente')::text, 6, '0')
$$;

-- ── clientes_info_general: campos adicionales del perfil ─────────────────────

alter table clientes_info_general
  add column if not exists tipo_empresa    text
    check (tipo_empresa in ('micro','pequena','mediana','grande')),
  add column if not exists tipo_cliente    text
    check (tipo_cliente in ('cargador','operador_logistico','distribuidor','industria','comercio','servicios','otro')),
  add column if not exists email_principal text,
  add column if not exists updated_by      text;

-- ── clientes_info_tributaria: auditoría ──────────────────────────────────────

alter table clientes_info_tributaria
  add column if not exists updated_by text;

-- ── clientes_relaciones_comerciales: 5 estados + auditoría ───────────────────

-- Ampliar el check de estado_comercial a 5 valores
alter table clientes_relaciones_comerciales
  drop constraint if exists clientes_relaciones_comerciales_estado_comercial_check;

alter table clientes_relaciones_comerciales
  add constraint clientes_relaciones_comerciales_estado_comercial_check
    check (estado_comercial in ('activo','inactivo','suspendido','prospecto','bloqueado')),
  add column if not exists updated_by text;

-- ── clientes_historial: campo usuario_email para trazabilidad ────────────────

alter table clientes_historial
  add column if not exists usuario_email text;
