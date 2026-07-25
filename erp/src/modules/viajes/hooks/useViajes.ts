import { useState, useEffect, useCallback, useMemo } from "react";
import type { TmsViaje, KpisViaje } from "../types";
import type { TabViajes } from "../constants";
import { ESTADOS_ACTIVOS, ESTADOS_FINALIZADOS, REFRESH_INTERVAL_MS, tabCount } from "../constants";
import { listarViajes } from "../services/api";
import { parseFechaMDY } from "@/utils/parseFecha";
import { useFiltrosComunes } from "@/hooks/useFiltrosComunes";

/** Extrae YYYY-MM-DD de un activated_on en formato MM/DD/YYYY HH:MM:SS. */
function toDateISO(activated_on: string | null): string | null {
  const d = parseFechaMDY(activated_on);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function useViajes() {
  const [data, setData]       = useState<TmsViaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Filtros comunes (búsqueda + fechas)
  const { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase } =
    useFiltrosComunes();

  // Filtros específicos de Viajes
  const [tabActivo,     setTabActivo]     = useState<TabViajes>("todos");
  const [estadoFiltro,  setEstadoFiltro]  = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");   // empresa_cliente_id

  // Drawer
  const [panelId, setPanelId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listarViajes());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar viajes");
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial + auto-refresco
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cargar]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = useMemo<TmsViaje[]>(() => {
    const term = busqueda.trim().toLowerCase();
    const st   = (v: TmsViaje) => (v.state_travel ?? "").toLowerCase();

    return data.filter((v) => {
      // Tab
      if (tabActivo === "activos"     && !ESTADOS_ACTIVOS.has(st(v)))      return false;
      if (tabActivo === "enRuta"      && st(v) !== "en transíto")           return false;
      if (tabActivo === "finalizados" && !ESTADOS_FINALIZADOS.has(st(v)))   return false;
      if (tabActivo === "conNovedad"  && !v.last_alarm_name)                return false;

      // Filtro estado select
      if (estadoFiltro && st(v) !== estadoFiltro.toLowerCase()) return false;

      // Filtro cliente (por empresa_cliente_id — Maestro de Clientes)
      if (clienteFiltro && v.empresa_cliente_id !== clienteFiltro) return false;

      // Filtro fecha — solo activo cuando el usuario ha aplicado un rango.
      if (fechaDesde && fechaHasta) {
        const vFecha = toDateISO(v.activated_on);
        if (vFecha && (vFecha < fechaDesde || vFecha > fechaHasta)) return false;
      }

      // Búsqueda texto libre
      if (term) {
        const haystack = [
          v.trip_number,
          v.number_order,
          v.license_plate,
          v.driver_name,
          v.razon_social,
          v.company_customer_name,
          v.origin_city_name,
          v.destiny_city_name,
        ].join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [data, tabActivo, busqueda, estadoFiltro, clienteFiltro, fechaDesde, fechaHasta]);

  // ── KPIs (sobre todos los datos, sin filtro de fecha/cliente/estado) ──────
  const kpis = useMemo<KpisViaje>(() => {
    const st = (v: TmsViaje) => (v.state_travel ?? "").toLowerCase();
    return {
      total:       data.length,
      activos:     data.filter((v) => ESTADOS_ACTIVOS.has(st(v))).length,
      enCargue:    data.filter((v) => st(v) === "cargando").length,
      enRuta:      data.filter((v) => st(v) === "en transíto").length,
      enDescargue: data.filter((v) => st(v) === "descargando").length,
      finalizados: data.filter((v) => ESTADOS_FINALIZADOS.has(st(v))).length,
      conNovedad:  data.filter((v) => !!v.last_alarm_name).length,
    };
  }, [data]);

  // ── Clientes únicos — Maestro de Clientes (empresa_cliente_id + razon_social) ──
  const clientes = useMemo<{ id: string; label: string }[]>(() => {
    const seen = new Map<string, string>();
    for (const v of data) {
      if (v.empresa_cliente_id && v.razon_social && !seen.has(v.empresa_cliente_id)) {
        seen.set(v.empresa_cliente_id, v.razon_social);
      }
    }
    return [...seen.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [data]);

  // ── Panel ─────────────────────────────────────────────────────────────────
  const panelViaje = useMemo(
    () => (panelId ? (data.find((v) => v.trip_number === panelId) ?? null) : null),
    [panelId, data],
  );

  // ── Conteo por tab ────────────────────────────────────────────────────────
  const getTabCount = (tabId: string) => tabCount(data, tabId);

  // ── Limpiar todos los filtros ─────────────────────────────────────────────
  const hayFiltros =
    busqueda !== "" || estadoFiltro !== "" || clienteFiltro !== "" || fechaDesde !== "";

  function limpiarFiltros() {
    limpiarBase();
    setEstadoFiltro("");
    setClienteFiltro("");
  }

  return {
    data,
    loading,
    error,
    filtradas,
    kpis,
    clientes,

    busqueda, setBusqueda,
    tabActivo, setTabActivo,
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    fechaDesde, fechaHasta, setFechaRango,
    hayFiltros, limpiarFiltros,

    panelId, setPanelId, panelViaje,

    cargar,
    getTabCount,
  };
}
