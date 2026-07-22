import { useState, useEffect, useCallback, useMemo } from "react";
import type { GpsRecord, KpisGps } from "../types";
import type { TabGps } from "../constants";
import { REFRESH_INTERVAL_MS } from "../constants";
import { listarVehiculosGps } from "../services/api";

export function useGps() {
  const [data,    setData]    = useState<GpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filtros
  const [busqueda,     setBusqueda]     = useState("");
  const [tabActivo,    setTabActivo]    = useState<TabGps>("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  // Selección
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listarVehiculosGps());
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos GPS");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cargar]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtrados = useMemo<GpsRecord[]>(() => {
    const term = busqueda.trim().toLowerCase();
    return data.filter((v) => {
      // Tab
      if (tabActivo === "activos")   { if (v.estadoGps !== "activo")                    return false; }
      if (tabActivo === "detenidos") { if (v.estadoGps !== "detenido")                  return false; }
      if (tabActivo === "alarmas")   { if (v.estadoGps !== "con_alarma" && v.estadoGps !== "panico") return false; }
      if (tabActivo === "sin_senial"){ if (v.estadoGps !== "desconectado")              return false; }

      // Estado dropdown
      if (estadoFiltro && v.estadoGps !== estadoFiltro) return false;

      // Texto libre
      if (term) {
        const hay = [
          v.license_plate, v.driver_name, v.company_customer_name,
          v.trip_number, v.origin_city_name, v.destiny_city_name,
        ].join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }

      return true;
    });
  }, [data, tabActivo, busqueda, estadoFiltro]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo<KpisGps>(() => ({
    total:         data.length,
    activos:       data.filter((v) => v.estadoGps === "activo").length,
    detenidos:     data.filter((v) => v.estadoGps === "detenido").length,
    sinReporte:    data.filter((v) => !v.latest_gps_report).length,
    conAlarmas:    data.filter((v) => v.estadoGps === "con_alarma").length,
    panico:        data.filter((v) => v.estadoGps === "panico").length,
    desconectados: data.filter((v) => v.estadoGps === "desconectado").length,
  }), [data]);

  // ── Selección ──────────────────────────────────────────────────────────────
  const selectedVehiculo = useMemo(
    () => (selectedId ? (data.find((v) => v.id === selectedId) ?? null) : null),
    [selectedId, data],
  );

  /** Selecciona un vehículo por placa — usado desde navPayload. */
  const selectByPlate = useCallback((plate: string) => {
    const found = data.find((v) => (v.license_plate ?? "").toLowerCase() === plate.toLowerCase());
    if (found) setSelectedId(found.id);
  }, [data]);

  return {
    data, loading, error,
    busqueda, setBusqueda,
    tabActivo, setTabActivo,
    estadoFiltro, setEstadoFiltro,
    filtrados, kpis,
    selectedId, setSelectedId, selectedVehiculo,
    selectByPlate, cargar,
    lastRefresh,
  };
}
