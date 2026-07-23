import { useState, useEffect, useMemo, useCallback } from "react";
import type { ClienteListItem, KpisClientes } from "../types";
import { listarClientes } from "../services/api";
import { TABS_LISTADO } from "../constants";

export function useClientes() {
  const [data, setData]                         = useState<ClienteListItem[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [busqueda, setBusqueda]                 = useState("");
  const [tabEstado, setTabEstado]               = useState<string>("todos");
  const [estadoFiltro, setEstadoFiltro]         = useState("");
  const [clasificacionFiltro, setClasificacion] = useState("");
  const [panelId, setPanelId]                   = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listarClientes());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const tabDef = TABS_LISTADO.find(t => t.id === tabEstado);
    const tabEstadoKey = tabDef?.estadoKey ?? "";
    const term = busqueda.trim().toLowerCase();

    return data.filter((c) => {
      if (tabEstadoKey && c.estado !== tabEstadoKey)     return false;
      if (estadoFiltro && c.estado !== estadoFiltro)     return false;
      if (clasificacionFiltro && c.clasificacion_abc !== clasificacionFiltro) return false;
      if (!term) return true;
      return (
        c.razon_social.toLowerCase().includes(term)                  ||
        (c.nit ?? "").toLowerCase().includes(term)                   ||
        (c.nombre_comercial ?? "").toLowerCase().includes(term)      ||
        (c.ciudad_principal ?? "").toLowerCase().includes(term)      ||
        (c.ejecutivo_comercial ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, tabEstado, busqueda, estadoFiltro, clasificacionFiltro]);

  const kpis = useMemo((): KpisClientes => ({
    total:       data.length,
    activos:     data.filter(c => c.estado === "activo").length,
    inactivos:   data.filter(c => c.estado === "inactivo").length,
    suspendidos: data.filter(c => c.estado === "suspendido").length,
    bloqueados:  data.filter(c => c.estado === "bloqueado").length,
    pendientes:  data.filter(c => c.estado === "pendiente").length,
    con_alertas: data.filter(c => c.alertas_count > 0).length,
  }), [data]);

  const panelCliente = panelId ? (data.find(c => c.id === panelId) ?? null) : null;

  const getTabCount = (tabId: string) => {
    const tabDef = TABS_LISTADO.find(t => t.id === tabId);
    if (!tabDef || !tabDef.estadoKey) return data.length;
    return data.filter(c => c.estado === tabDef.estadoKey).length;
  };

  return {
    data, loading, error,
    busqueda, setBusqueda,
    tabEstado, setTabEstado,
    estadoFiltro, setEstadoFiltro,
    clasificacionFiltro, setClasificacion,
    panelId, setPanelId, panelCliente,
    filtrados, kpis,
    cargar, getTabCount,
  };
}
