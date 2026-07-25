import { useState, useEffect, useMemo } from "react";
import { hoy, hace7dias } from "@/utils/date";
import type { Solicitud, ActorAccion } from "../types";
import { getSolicitudes, cambiarEstadoSolicitud } from "../services/api";
import { useFiltrosComunes } from "@/hooks/useFiltrosComunes";

export function useSolicitudes() {
  const [data, setData]       = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tabEstado, setTabEstado] = useState("todos");
  const [panelId, setPanelId]     = useState<string | null>(null);

  // Filtros comunes — fechas inicializadas al rango últimos 7 días
  const { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase } =
    useFiltrosComunes({ defaultDesde: hace7dias(), defaultHasta: hoy() });

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      // Si el usuario limpia las fechas del picker, se mantiene un fallback seguro hacia la API.
      setData(await getSolicitudes(fechaDesde || hace7dias(), fechaHasta || hoy()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  // Las fechas disparan una nueva carga al servidor (filtro server-side).
  useEffect(() => { cargar(); }, [fechaDesde, fechaHasta]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEstado = async (id: string, estado: string) => {
    const actor: ActorAccion | null = null;
    await cambiarEstadoSolicitud(id, estado, actor ? { actor } : {});
    setData((prev) =>
      prev.map((s) => s.id === id ? { ...s, estado: estado as Solicitud["estado"] } : s)
    );
  };

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return data.filter((s) => {
      if (tabEstado !== "todos" && s.estado !== tabEstado) return false;
      if (!term) return true;
      return (
        s.codigo_solicitud.toLowerCase().includes(term) ||
        s.cliente.toLowerCase().includes(term) ||
        s.agencia.toLowerCase().includes(term) ||
        (s.external_ref ?? "").toLowerCase().includes(term) ||
        s.origen.toLowerCase().includes(term) ||
        s.destino.toLowerCase().includes(term)
      );
    });
  }, [data, tabEstado, busqueda]);

  const kpis = useMemo(() => ({
    recibidas:   data.length,
    pendientes:  data.filter((s) => s.estado === "pendiente").length,
    enGestion:   data.filter((s) => s.estado === "aprobado" || s.estado === "en_ruta").length,
    completadas: data.filter((s) => s.estado === "completado").length,
    canceladas:  data.filter((s) => s.estado === "cancelado").length,
  }), [data]);

  const panelSol = panelId ? data.find((s) => s.id === panelId) ?? null : null;

  const hayFiltros = busqueda !== "" || tabEstado !== "todos" ||
    fechaDesde !== hace7dias() || fechaHasta !== hoy();

  function limpiarFiltros() {
    limpiarBase(); // busqueda + fechas → defaults
    setTabEstado("todos");
  }

  return {
    data, loading, error,
    busqueda, setBusqueda,
    fechaDesde, fechaHasta, setFechaRango,
    tabEstado, setTabEstado,
    panelId, setPanelId, panelSol,
    filtradas, kpis,
    hayFiltros, limpiarFiltros,
    cargar, handleEstado,
  };
}
