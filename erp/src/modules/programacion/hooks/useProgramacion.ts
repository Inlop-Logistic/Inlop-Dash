import { useState, useEffect, useMemo } from "react";
import { hoy } from "@/utils/date";
import type { ViajeResumen, EstadoProgramacion } from "../types";
import { listarProgramacion, cambiarEstadoProgramacion } from "../services/api";

export function useProgramacion() {
  const [data, setData]           = useState<ViajeResumen[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [desde, setDesde]         = useState(hoy());
  const [hasta, setHasta]         = useState(hoy());
  const [busqueda, setBusqueda]   = useState("");
  const [tabEstado, setTabEstado] = useState<"todos" | EstadoProgramacion>("todos");
  const [panelId, setPanelId]     = useState<string | null>(null);
  const [accionLoading, setAccionLoading] = useState(false);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listarProgramacion(desde, hasta));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar programación");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return data.filter((v) => {
      if (tabEstado !== "todos" && v.estado_programacion !== tabEstado) return false;
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
    total:      data.length,
    programado: data.filter((v) => v.estado_programacion === "programado").length,
    asignado:   data.filter((v) => v.estado_programacion === "asignado").length,
    no_show:    data.filter((v) => v.estado_programacion === "no_show").length,
  }), [data]);

  const panelViaje = panelId ? data.find((v) => v.trip_number === panelId) ?? null : null;

  return {
    data, loading, error,
    desde, setDesde,
    hasta, setHasta,
    busqueda, setBusqueda,
    tabEstado, setTabEstado,
    panelId, setPanelId, panelViaje,
    accionLoading,
    filtradas, kpis,
    cargar, handleEstado,
  };
}
