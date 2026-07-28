import { useState, useEffect, useMemo } from "react";
import { hoy, extraerFechaColombia } from "@/utils/date";
import { parseFechaDMY } from "@/utils/parseFecha";
import type { ViajeResumen, EstadoProgramacion } from "../types";
import { listarProgramacion, cambiarEstadoProgramacion, sincronizarViaje } from "../services/api";
import { estadoVisual } from "../constants";
import { useFiltrosComunes } from "@/hooks/useFiltrosComunes";

type TabEstado = "todos" | "programado" | "asignado" | "cancelado";

/** Convierte schedulate_origin (DD/MM/YYYY HH:MM:SS) a YYYY-MM-DD Colombia para filtro de fecha. */
function schedulateToISO(raw: string | null | undefined): string | null {
  const d = parseFechaDMY(raw);
  if (!d) return null;
  return extraerFechaColombia(d);
}

export function useProgramacion() {
  const [data, setData]           = useState<ViajeResumen[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tabEstado,      setTabEstado]      = useState<TabEstado>("todos");
  const [estadoFiltro,   setEstadoFiltro]   = useState("");
  const [clienteFiltro,  setClienteFiltro]  = useState("");
  const [panelId, setPanelId]               = useState<string | null>(null);
  const [accionLoading, setAccionLoading] = useState(false);

  // Filtros comunes — fechas inicializadas a hoy (bandeja diaria)
  const { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase } =
    useFiltrosComunes({ defaultDesde: hoy(), defaultHasta: hoy() });

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      // Usa las fechas actuales del estado para la carga.
      // "Actualizar" con rango activo recarga ese rango; al montar, carga hoy.
      setData(await listarProgramacion(fechaDesde || hoy(), fechaHasta || hoy()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar programación");
    } finally {
      setLoading(false);
    }
  };

  // Carga solo al montar — el selector de fechas aplica client-side (igual que Viajes).
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Filtrado acumulativo (client-side, igual que Viajes) ──────────────────
  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    return data.filter((v) => {
      // Tab de estado
      if (tabEstado === "programado" && (v.activo_en_resume || v.estado_programacion === "cancelado")) return false;
      if (tabEstado === "asignado"   && !v.activo_en_resume) return false;
      if (tabEstado === "cancelado"  && v.estado_programacion !== "cancelado") return false;

      // Select de estado (estado visual derivado)
      if (estadoFiltro && estadoVisual(v) !== estadoFiltro) return false;

      // Filtro de cliente
      if (clienteFiltro) {
        const clienteDelViaje = v.nombre_cliente || v.company_customer_name || "";
        if (clienteDelViaje !== clienteFiltro) return false;
      }

      // Filtro de fecha (client-side; solo activo cuando el usuario aplica un rango)
      if (fechaDesde || fechaHasta) {
        const vFecha = schedulateToISO(v.schedulate_origin) ?? v.fecha_programada_dia ?? null;
        if (!vFecha) return false;
        if (fechaDesde && vFecha < fechaDesde) return false;
        if (fechaHasta && vFecha > fechaHasta) return false;
      }

      // Búsqueda texto libre
      if (term) {
        return (
          v.trip_number.toLowerCase().includes(term) ||
          (v.license_plate ?? "").toLowerCase().includes(term) ||
          (v.driver_name ?? "").toLowerCase().includes(term) ||
          (v.company_customer_name ?? "").toLowerCase().includes(term) ||
          (v.city_origin ?? "").toLowerCase().includes(term) ||
          (v.city_destination ?? "").toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [data, tabEstado, estadoFiltro, clienteFiltro, busqueda, fechaDesde, fechaHasta]);

  const kpis = useMemo(() => ({
    total:    data.length,
    pendiente: data.filter((v) => !v.activo_en_resume && v.estado_programacion !== "cancelado").length,
    activo:    data.filter((v) => v.activo_en_resume).length,
    cancelado: data.filter((v) => v.estado_programacion === "cancelado").length,
  }), [data]);

  const panelViaje = panelId ? data.find((v) => v.trip_number === panelId) ?? null : null;

  const hayFiltros =
    busqueda !== "" || tabEstado !== "todos" || estadoFiltro !== "" || clienteFiltro !== "" ||
    fechaDesde !== hoy() || fechaHasta !== hoy();

  function limpiarFiltros() {
    limpiarBase();
    setTabEstado("todos");
    setEstadoFiltro("");
    setClienteFiltro("");
  }

  return {
    data, loading, error,
    busqueda, setBusqueda,
    fechaDesde, fechaHasta, setFechaRango,
    tabEstado, setTabEstado,
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    panelId, setPanelId, panelViaje,
    accionLoading,
    filtradas, kpis,
    hayFiltros, limpiarFiltros,
    cargar, handleEstado, handleSync,
  };
}
