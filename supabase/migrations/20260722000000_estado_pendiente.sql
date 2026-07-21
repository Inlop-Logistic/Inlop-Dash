-- ══════════════════════════════════════════════════════════════════════════════
-- MAESTRO DE CLIENTES — Sprint P0.5: estado "pendiente" para creación automática
-- Contexto: la integración TMS → Programación crea clientes al vuelo cuando el
-- viaje referencia una empresa que aún no existe en el maestro. Estos clientes
-- entran con estado 'pendiente' hasta que comercial los cura y aprueba.
-- ══════════════════════════════════════════════════════════════════════════════

-- Reemplazar el CHECK de empresas_cliente.estado
alter table empresas_cliente
  drop constraint if exists empresas_cliente_estado_check;

alter table empresas_cliente
  add constraint empresas_cliente_estado_check
  check (estado in ('activo','inactivo','suspendido','prospecto','bloqueado','pendiente'));

-- Reemplazar el CHECK de clientes_relaciones_comerciales.estado_comercial
alter table clientes_relaciones_comerciales
  drop constraint if exists clientes_relaciones_comerciales_estado_comercial_check;

alter table clientes_relaciones_comerciales
  add constraint clientes_relaciones_comerciales_estado_comercial_check
  check (estado_comercial in ('activo','inactivo','suspendido','prospecto','bloqueado','pendiente'));
