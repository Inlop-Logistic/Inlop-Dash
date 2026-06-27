import { useState, useEffect, useMemo } from "react";
import { hoy, hace7dias } from "@/utils/date";
import type { Solicitud } from "../types";
import { getSolicitudes, cambiarEstadoSolicitud } from "../services/api";

export function useSolicitudes() {
  const [data, setData]           = useState<Solicitud[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [desde, setDesde]         = useState(hace7dias());
  const [hasta, setHasta]         = useState(hoy());
  const [busqueda, setBusqueda]   = useState("");
  const [tabEstado, setTabEstado] = useState("todos");
  const [panelId, setPanelId]     = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getSolicitudes(desde, hasta));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEstado = async (id: string, estado: string) => {
    await cambiarEstadoSolicitud(id, estado);
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

  return {
    data, loading, error,
    desde, setDesde,
    hasta, setHasta,
    busqueda, setBusqueda,
    tabEstado, setTabEstado,
    panelId, setPanelId, panelSol,
    filtradas, kpis,
    cargar, handleEstado,
  };
}
