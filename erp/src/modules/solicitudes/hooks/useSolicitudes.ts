import { useState, useEffect, useCallback } from "react";
import { hoy, hace7dias } from "@/utils/date";
import type { Solicitud, ActorAccion } from "../types";
import { getSolicitudes, getClientesSolicitudes, cambiarEstadoSolicitud, exportarSolicitudes } from "../services/api";
import { useFiltrosComunes } from "@/hooks/useFiltrosComunes";

const PAGE_SIZE = 25;

export function useSolicitudes() {
  const [data, setData] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabEstado, setTabEstado] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [clientes, setClientes] = useState<string[]>([]);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [kpis, setKpis] = useState({ total: 0, pendientes: 0, enRuta: 0, finalizadas: 0 });

  const { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase } =
    useFiltrosComunes({ defaultDesde: hace7dias(), defaultHasta: hoy() });

  const estadoEfectivo = estadoFiltro || (tabEstado !== "todos" ? tabEstado : "");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSolicitudes({
        desde: fechaDesde || hace7dias(),
        hasta: fechaHasta || hoy(),
        page,
        pageSize: PAGE_SIZE,
        estado: estadoEfectivo,
        busqueda: busqueda.trim(),
        cliente: clienteFiltro,
      });
      setData(result.data);
      setPagination(result.pagination);
      setKpis(result.kpis);
      if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
        setPage(result.pagination.totalPages);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, page, estadoEfectivo, busqueda, clienteFiltro]);

  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    getClientesSolicitudes().then(setClientes).catch(() => setClientes([]));
  }, []);

  useEffect(() => { setPage(1); }, [fechaDesde, fechaHasta, estadoEfectivo, busqueda, clienteFiltro]);

  const handleEstado = async (id: string, estado: string) => {
    const actor: ActorAccion | null = null;
    await cambiarEstadoSolicitud(id, estado, actor ? { actor } : {});
    await cargar();
  };

  const filtradas = data;
  const panelSol = panelId ? data.find((s) => s.id === panelId) ?? null : null;

  const hayFiltros = Boolean(busqueda || tabEstado !== "todos" || estadoFiltro || clienteFiltro ||
    fechaDesde !== hace7dias() || fechaHasta !== hoy());

  function limpiarFiltros() {
    limpiarBase();
    setTabEstado("todos");
    setEstadoFiltro("");
    setClienteFiltro("");
    setBusqueda("");
    setPage(1);
  }

  async function exportar() {
    setExportando(true);
    try {
      await exportarSolicitudes({
        desde: fechaDesde || hace7dias(),
        hasta: fechaHasta || hoy(),
        estado: estadoEfectivo,
        busqueda: busqueda.trim(),
        cliente: clienteFiltro,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al exportar solicitudes");
    } finally {
      setExportando(false);
    }
  }

  return {
    data, loading, error, exportando,
    busqueda, setBusqueda,
    fechaDesde, fechaHasta, setFechaRango,
    tabEstado, setTabEstado,
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    clientes, panelId, setPanelId, panelSol,
    filtradas, kpis, pagination, page, setPage,
    hayFiltros, limpiarFiltros, cargar, handleEstado, exportar,
  };
}
