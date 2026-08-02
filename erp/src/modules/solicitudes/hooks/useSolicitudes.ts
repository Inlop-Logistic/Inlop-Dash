import { useState, useEffect, useMemo } from "react";
import { hoy, hace7dias, extraerFechaColombia } from "@/utils/date";
import type { Solicitud, ActorAccion } from "../types";
import { getSolicitudes, cambiarEstadoSolicitud } from "../services/api";
import { getViajePorTripNumber } from "@/modules/viajes/services/api";
import { useFiltrosComunes } from "@/hooks/useFiltrosComunes";

export function useSolicitudes() {
  const [data, setData]       = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tabEstado,     setTabEstado]     = useState("todos");
  const [estadoFiltro,  setEstadoFiltro]  = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [panelId, setPanelId]             = useState<string | null>(null);

  // Filtros comunes — fechas inicializadas a últimos 7 días (define la ventana de carga inicial)
  const { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase } =
    useFiltrosComunes({ defaultDesde: hace7dias(), defaultHasta: hoy() });

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getSolicitudes(fechaDesde || hace7dias(), fechaHasta || hoy());

      // Enriquecimiento paralelo: obtener planificado_por.fullname para cada trip number único.
      const tripNumbers = [...new Set(
        list.map((s) => s.controlt_trip_number).filter(Boolean) as string[]
      )];
      const planMap: Record<string, string | null> = {};
      if (tripNumbers.length > 0) {
        const results = await Promise.allSettled(
          tripNumbers.map((tn) => getViajePorTripNumber(tn))
        );
        tripNumbers.forEach((tn, i) => {
          const r = results[i];
          planMap[tn] = r.status === "fulfilled" ? (r.value.planificado_por?.fullname ?? null) : null;
        });
      }

      setData(
        list.map((s) => ({
          ...s,
          planificado_por_nombre: s.controlt_trip_number
            ? (planMap[s.controlt_trip_number] ?? null)
            : null,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  // Carga solo al montar — el selector de fechas aplica client-side (igual que Viajes).
  // "Actualizar" recarga el servidor con el rango vigente.
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEstado = async (id: string, estado: string) => {
    const actor: ActorAccion | null = null;
    await cambiarEstadoSolicitud(id, estado, actor ? { actor } : {});
    setData((prev) =>
      prev.map((s) => s.id === id ? { ...s, estado: estado as Solicitud["estado"] } : s)
    );
  };

  // ── Clientes únicos (para el select de cliente) ───────────────────────────
  const clientes = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const s of data) {
      if (s.cliente && !seen.has(s.cliente)) { seen.add(s.cliente); result.push(s.cliente); }
    }
    return result.sort((a, b) => a.localeCompare(b, "es"));
  }, [data]);

  // ── Filtrado acumulativo (client-side, igual que Viajes) ──────────────────
  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    return data.filter((s) => {
      // Tab de estado
      if (tabEstado !== "todos" && s.estado !== tabEstado) return false;

      // Select de estado (acumulativo sobre el tab)
      if (estadoFiltro && s.estado !== estadoFiltro) return false;

      // Select de cliente
      if (clienteFiltro && s.cliente !== clienteFiltro) return false;

      // Filtro de fecha (client-side; solo activo cuando el usuario aplica un rango)
      if (fechaDesde || fechaHasta) {
        const vFecha = s.creado_en ? extraerFechaColombia(new Date(s.creado_en)) : "";
        if (fechaDesde && vFecha < fechaDesde) return false;
        if (fechaHasta && vFecha > fechaHasta) return false;
      }

      // Búsqueda texto libre
      if (term) {
        return (
          s.codigo_solicitud.toLowerCase().includes(term) ||
          s.cliente.toLowerCase().includes(term) ||
          s.agencia.toLowerCase().includes(term) ||
          (s.external_ref ?? "").toLowerCase().includes(term) ||
          s.origen.toLowerCase().includes(term) ||
          s.destino.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [data, tabEstado, estadoFiltro, clienteFiltro, busqueda, fechaDesde, fechaHasta]);

  const kpis = useMemo(() => ({
    total:       data.length,
    pendientes:  data.filter((s) => s.estado === "pendiente").length,
    enRuta:      data.filter((s) => s.estado === "en_ruta").length,
    finalizadas: data.filter((s) => s.estado === "completado").length,
  }), [data]);

  const panelSol = panelId ? data.find((s) => s.id === panelId) ?? null : null;

  const hayFiltros =
    busqueda !== "" || tabEstado !== "todos" ||
    estadoFiltro !== "" || clienteFiltro !== "" ||
    fechaDesde !== hace7dias() || fechaHasta !== hoy();

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
    clientes,
    panelId, setPanelId, panelSol,
    filtradas, kpis,
    hayFiltros, limpiarFiltros,
    cargar, handleEstado,
  };
}
