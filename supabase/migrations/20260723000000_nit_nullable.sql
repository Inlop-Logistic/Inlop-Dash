-- ══════════════════════════════════════════════════════════════════════════════
-- MAESTRO DE CLIENTES — nit nullable para creación automática desde TMS
-- Contexto: los clientes auto-creados por el flujo TMS → Programación no
-- traen NIT. La columna ya es `string | null` en los tipos TypeScript del ERP
-- y todos los endpoints la tratan como opcional. El NOT NULL original asumía
-- creación siempre manual (vía Comercial); al habilitar la creación automática
-- el constraint ya no es válido.
-- El equipo de Comercial completa el NIT al curar los registros pendientes.
-- ══════════════════════════════════════════════════════════════════════════════

alter table empresas_cliente
  alter column nit drop not null;
