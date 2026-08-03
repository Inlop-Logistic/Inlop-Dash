-- Migration: add planificado_por_nombre to planeados
-- Phase: Architecture A — Planeados owns the planificado_por datum during the planning stage.
--
-- planificado_por_nombre is populated by syncPlaneados once per trip via a
-- single SOAP call (getTripDetail). It is never overwritten by the batch
-- upsert — only a targeted PATCH sets it after SOAP enrichment.
--
-- Nullable: existing rows are unaffected; new rows start NULL and are enriched
-- asynchronously within the same sync cycle.
-- Idempotent: IF NOT EXISTS guarantees safe re-runs.

ALTER TABLE planeados
  ADD COLUMN IF NOT EXISTS planificado_por_nombre TEXT;
