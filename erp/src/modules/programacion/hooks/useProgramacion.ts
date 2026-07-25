import { useState, useEffect, useMemo } from "react";
import { hoy } from "@/utils/date";
import type { ViajeResumen, EstadoProgramacion } from "../types";
import { listarProgramacion, cambiarEstadoProgramacion, sincronizarViaje } from "../services/api";
import { useFiltrosComunes } from "@/hooks/useFiltrosComunes";

type TabEstado = "todos" | "programado" | "asignado" | "cancelado";

export function useProgramacion() {
  const [data, setData]           = useState<ViajeResumen[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tabEstado, setTabEstado] = useState<TabEstado>("todos");
  const [panelId, setPanelId]     = useState<string | null>(null);
  const [accionLoading, setAccionLoading] = useState(false);

  // Filtros comunes — fechas inicializadas a hoy (bandeja diaria)
  const { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase } =
    useFiltrosComunes({ defaultDesde: hoy(), defaultHasta: hoy() });

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listarProgramacion(fechaDesde || hoy(), fechaHasta || hoy()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar programación");
    } finally {
      setLoading(false);
    }
  };

  // Las fechas disparan una nueva carga al servidor (filtro server-side).
  useEffect(() => { cargar(); }, [fechaDesde, fechaHasta]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEstado = async (id: string, estado: EstadoProgramacion) => {
    setAccionLoading(true);
    try {
      await cambiarEstadoProgramacion(id, estado);
      setData((prev) =>
        prev.map((v) => v.trip_number === id ? { ...v, estado_programacion: estado } : v)
      );
      setPanelId(null);
    } finally {
      setAccionLoading(false);
    }
  };

  const handleSync = async (id: string) => {
    setAccionLoading(true);
    try {
      const result = await sincronizarViaje(id);
      setData((prev) =>
        prev.map((v) => v.trip_number === id ? { ...v, activo_en_resume: result.activo_en_resume } : v)
      );
    } finally {
      setAccionLoading(false);
    }
  };

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return data.filter((v) => {
      if (tabEstado === "programado" && (v.activo_en_resume || v.estado_programacion === "cancelado")) return false;
      if (tabEstado === "asignado"   && !v.activo_en_resume) return false;
      if (tabEstado === "cancelado"  && v.estado_programacion !== "cancelado") return false;
      if (!term) return true;
      return (
        v.trip_number.toLowerCase().includes(term) ||
        (v.license_plate ?? "").toLowerCase().includes(term) ||
        (v.driver_name ?? "").toLowerCase().includes(term) ||
        (v.company_customer_name ?? "").toLowerCase().includes(term) ||
        (v.city_origin ?? "").toLowerCase().includes(term) ||
        (v.city_destination ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, tabEstado, busqueda]);

  const kpis = useMemo(() => ({
    total:    data.length,
    pendiente: data.filter((v) => !v.activo_en_resume && v.estado_programacion !== "cancelado").length,
    activo:    data.filter((v) => v.activo_en_resume).length,
    cancelado: data.filter((v) => v.estado_programacion === "cancelado").length,
  }), [data]);

  const panelViaje = panelId ? data.find((v) => v.trip_number === panelId) ?? null : null;

  const hayFiltros = busqueda !== "" || tabEstado !== "todos" ||
    fechaDesde !== hoy() || fechaHasta !== hoy();

  function limpiarFiltros() {
    limpiarBase(); // busqueda + fechas → defaults (hoy)
    setTabEstado("todos");
  }

  return {
    data, loading, error,
    busqueda, setBusqueda,
    fechaDesde, fechaHasta, setFechaRango,
    tabEstado, setTabEstado,
    panelId, setPanelId, panelViaje,
    accionLoading,
    filtradas, kpis,
    hayFiltros, limpiarFiltros,
    cargar, handleEstado, handleSync,
  };
}
