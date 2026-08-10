import { useState, useEffect, useMemo, useCallback } from "react";
import type { ReporteAutomatico, ReporteBase } from "../types";
import {
  listarReportesAutomaticos,
  toggleReporteActivo,
  actualizarReporteAutomatico,
  crearReporteAutomatico,
} from "../services/api";

export function useReportesAutomaticos() {
  const [data,      setData]      = useState<ReporteAutomatico[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [busqueda,  setBusqueda]  = useState("");
  const [panelId,   setPanelId]   = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // ── Carga ──────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listarReportesAutomaticos());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar reportes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Filtrado en memoria ───────────────────────────────────────────────────

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return data;
    return data.filter(r => r.nombre.toLowerCase().includes(term));
  }, [data, busqueda]);

  // ── Panel de edición ──────────────────────────────────────────────────────

  const panelReporte = panelId ? (data.find(r => r.id === panelId) ?? null) : null;

  // ── Mutaciones ────────────────────────────────────────────────────────────

  /** Activa o desactiva un reporte y actualiza el estado local de forma optimista. */
  const toggleActivo = useCallback(async (id: string, activo: boolean) => {
    // Actualización optimista
    setData(prev => prev.map(r => r.id === id ? { ...r, activo } : r));
    try {
      await toggleReporteActivo(id, activo);
    } catch (e) {
      // Revertir si falla
      setData(prev => prev.map(r => r.id === id ? { ...r, activo: !activo } : r));
      throw e;
    }
  }, []);

  /** Guarda cambios de un reporte existente. Cierra el panel al completar. */
  const guardarEdicion = useCallback(async (id: string, datos: Partial<ReporteBase>) => {
    setGuardando(true);
    try {
      const actualizado = await actualizarReporteAutomatico(id, datos);
      setData(prev => prev.map(r => r.id === id ? actualizado : r));
      setPanelId(null);
    } finally {
      setGuardando(false);
    }
  }, []);

  /** Crea un reporte nuevo y lo agrega al inicio de la lista. */
  const crear = useCallback(async (datos: ReporteBase): Promise<ReporteAutomatico> => {
    setGuardando(true);
    try {
      const nuevo = await crearReporteAutomatico(datos);
      setData(prev => [nuevo, ...prev]);
      return nuevo;
    } finally {
      setGuardando(false);
    }
  }, []);

  return {
    data,
    filtrados,
    loading,
    error,
    busqueda,
    setBusqueda,
    panelId,
    setPanelId,
    panelReporte,
    guardando,
    toggleActivo,
    guardarEdicion,
    crear,
    cargar,
  };
}
