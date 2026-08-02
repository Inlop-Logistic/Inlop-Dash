-- Migration: extend cumplidos with new SOAP viaje-level fields
-- Phase: ControlT integration — contract parity (Fase 6, Objetivo persistence)
--
-- These columns persist the additional fields captured by tripMapper.mapToViajeRow()
-- after the Fase 6 final certification. All columns are nullable because:
--   - Existing rows never had these values (backward-compatible).
--   - ControlT may not always populate them (Tolerant Reader contract).
--
-- Parada/producto fields are NOT added here — they are serialised into the
-- existing soap_paradas JSONB column as sub-objects.
--
-- Run this manually in the Supabase SQL editor before deploying the updated
-- persistenceLayer.js. The migration is idempotent (IF NOT EXISTS).

ALTER TABLE cumplidos
  ADD COLUMN IF NOT EXISTS soap_codigo_controlt_secundario TEXT,
  ADD COLUMN IF NOT EXISTS soap_codigo_empresa             TEXT,
  ADD COLUMN IF NOT EXISTS soap_planificado_por            JSONB,
  ADD COLUMN IF NOT EXISTS soap_codigo_ruta                TEXT,
  ADD COLUMN IF NOT EXISTS soap_observaciones              TEXT,
  ADD COLUMN IF NOT EXISTS soap_referencia_doc1            TEXT,
  ADD COLUMN IF NOT EXISTS soap_referencia_doc2            TEXT,
  ADD COLUMN IF NOT EXISTS soap_campos_auxiliares          TEXT,
  ADD COLUMN IF NOT EXISTS soap_rastreo_nueva_ui           BOOLEAN;
