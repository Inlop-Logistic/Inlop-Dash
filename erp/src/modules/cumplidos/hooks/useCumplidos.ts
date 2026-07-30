import { useState, useEffect, useCallback, useMemo } from "react";
import { parseFechaMDY } from "@/utils/parseFecha";
import { extraerFechaColombia } from "@/utils/date";
import { lineaNegocio } from "@/utils/lineaNegocio";
import type { CumplidoRecord, KpisCumplidos } from "../types";
import type { TabCumplidos } from "../constants";
import { REFRESH_INTERVAL_MS, tabCount } from "../constants";
import { listarCumplidos } from "../services/api";
import { useFiltrosComunes } from "@/hooks/useFiltrosComunes";

/** Convierte activated_on (MM/DD/YYYY HH:MM:SS) a YYYY-MM-DD Colombia para comparar contra date inputs. */
function activatedOnISO(c: CumplidoRecord): string | null {
  const d = parseFechaMDY(c.activated_on);
  if (!d) return null;
  return extraerFechaColombia(d);
}

export function useCumplidos() {
  const [data,    setData]    = useState<CumplidoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filtros comunes — sin fechas por defecto (cliente elige el rango)
  const { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase } =
    useFiltrosComunes();

  // Filtros específicos de Cumplidos
  const [tabActivo,          setTabActivo]          = useState<TabCumplidos>("todos");
  const [lineaNegocioFiltro, setLineaNegocioFiltro] = useState("");
  const [clienteFiltro,      setClienteFiltro]      = useState("");

  // Paginación
  const [pagina,    setPagina]    = useState(1);
  const [tamPagina, setTamPagina] = useState(50);

  // Panel
  const [panelId, setPanelId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listarCumplidos());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar cumplidos");
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
  const filtradas = useMemo<CumplidoRecord[]>(() => {
    const term = busqueda.trim().toLowerCase();
    const doc  = (c: CumplidoRecord) => c.estado_documental;

    return data.filter((c) => {
      // Filtro por tab (estado documental)
      if (tabActivo === "pendientes")        { if (doc(c) !== "pendiente")          return false; }
      if (tabActivo === "enRevision")        { if (doc(c) !== "en_revision")        return false; }
      if (tabActivo === "conObservaciones")  { if (doc(c) !== "con_observaciones")  return false; }
      if (tabActivo === "validados")         { if (doc(c) !== "aprobado")           return false; }
      if (tabActivo === "listosFacturacion") { if (doc(c) !== "listo_facturacion")  return false; }
      if (tabActivo === "rechazados")        { if (doc(c) !== "rechazado")          return false; }

      // Filtro por línea de negocio
      if (lineaNegocioFiltro) {
        if (lineaNegocio(c.type_operation) !== lineaNegocioFiltro) return false;
      }

      // Filtro por cliente
      if (clienteFiltro) {
        const cli = (c.company_customer_name ?? "").toLowerCase();
        if (!cli.includes(clienteFiltro.toLowerCase())) return false;
      }

      // Filtro por fecha (sobre activated_on)
      if (fechaDesde || fechaHasta) {
        const iso = activatedOnISO(c);
        if (!iso) return false;
        if (fechaDesde && iso < fechaDesde) return false;
        if (fechaHasta && iso > fechaHasta) return false;
      }

      // Buscador
      if (term) {
        const hay = [
          c.trip_number, c.number_order, c.license_plate,
          c.driver_name, c.conductor_tel, c.company_customer_name,
          c.origin_city_name, c.destiny_city_name,
        ].join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }

      return true;
    });
  }, [data, tabActivo, busqueda, lineaNegocioFiltro, clienteFiltro, fechaDesde, fechaHasta]);

  // Resetear página cuando cambian los filtros
  useEffect(() => { setPagina(1); }, [filtradas]);

  // ── Paginación ────────────────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamPagina));
  const paginadas    = useMemo(
    () => filtradas.slice((pagina - 1) * tamPagina, pagina * tamPagina),
    [filtradas, pagina, tamPagina],
  );

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo<KpisCumplidos>(() => ({
    total:       filtradas.length,
    pendientes:  filtradas.filter(c => !c.fecha_cumplido).length,
    finalizados: filtradas.filter(c => !!c.fecha_cumplido).length,
    cumplidos:   filtradas.filter(c => c.estado_documental === "aprobado").length,
    liquidados:  filtradas.filter(c => c.estado_documental === "listo_facturacion").length,
    facturados:  0,
  }), [filtradas]);

  // ── Clientes únicos ───────────────────────────────────────────────────────
  const clientes = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const c of data) {
      const nombre = (c.company_customer_name ?? "").split(",")[0].trim();
      if (nombre && !seen.has(nombre)) { seen.add(nombre); result.push(nombre); }
    }
    return result.sort((a, b) => a.localeCompare(b, "es"));
  }, [data]);

  // ── Limpiar todos los filtros ─────────────────────────────────────────────
  const hayFiltros =
    busqueda !== "" || fechaDesde !== "" || fechaHasta !== "" ||
    lineaNegocioFiltro !== "" || clienteFiltro !== "" || tabActivo !== "todos";

  const limpiarFiltros = useCallback(() => {
    limpiarBase();
    setLineaNegocioFiltro("");
    setClienteFiltro("");
    setTabActivo("todos");
    setPagina(1);
  }, [limpiarBase]);

  // ── Panel ─────────────────────────────────────────────────────────────────
  const panelCumplido = useMemo(
    () => (panelId ? (data.find(c => c.trip_number === panelId) ?? null) : null),
    [panelId, data],
  );

  const getTabCount = (tabId: string) => tabCount(data, tabId);

  return {
    data, loading, error,
    filtradas, paginadas, kpis, clientes,
    busqueda, setBusqueda,
    tabActivo, setTabActivo,
    lineaNegocioFiltro, setLineaNegocioFiltro,
    clienteFiltro, setClienteFiltro,
    fechaDesde, fechaHasta, setFechaRango,
    pagina, setPagina,
    tamPagina, setTamPagina,
    totalPaginas,
    hayFiltros, limpiarFiltros,
    panelId, setPanelId, panelCumplido,
    cargar, getTabCount,
  };
}
