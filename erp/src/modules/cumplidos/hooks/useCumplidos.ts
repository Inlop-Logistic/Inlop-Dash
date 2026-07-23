import { useState, useEffect, useCallback, useMemo } from "react";
import { parseFechaMDY } from "@/utils/parseFecha";
import type { CumplidoRecord, KpisCumplidos } from "../types";
import type { TabCumplidos } from "../constants";
import { REFRESH_INTERVAL_MS, tabCount } from "../constants";
import { listarCumplidos } from "../services/api";

/** Convierte activated_on (MM/DD/YYYY HH:MM:SS) a YYYY-MM-DD para comparar contra date inputs. */
function activatedOnISO(c: CumplidoRecord): string | null {
  const d = parseFechaMDY(c.activated_on);
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useCumplidos() {
  const [data,    setData]    = useState<CumplidoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filtros
  const [busqueda,      setBusqueda]      = useState("");
  const [tabActivo,     setTabActivo]     = useState<TabCumplidos>("todos");
  const [estadoFiltro,  setEstadoFiltro]  = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [desde,         setDesde]         = useState("");
  const [hasta,         setHasta]         = useState("");

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
      if (tabActivo === "pendientes")        { if (doc(c) !== "pendiente")          return false; }
      if (tabActivo === "enRevision")        { if (doc(c) !== "en_revision")        return false; }
      if (tabActivo === "conObservaciones")  { if (doc(c) !== "con_observaciones")  return false; }
      if (tabActivo === "validados")         { if (doc(c) !== "aprobado")           return false; }
      if (tabActivo === "listosFacturacion") { if (doc(c) !== "listo_facturacion")  return false; }
      if (tabActivo === "rechazados")        { if (doc(c) !== "rechazado")          return false; }

      if (estadoFiltro && doc(c) !== estadoFiltro) return false;

      if (clienteFiltro) {
        const cli = (c.company_customer_name ?? "").toLowerCase();
        if (!cli.includes(clienteFiltro.toLowerCase())) return false;
      }

      if (desde || hasta) {
        const iso = activatedOnISO(c);
        if (!iso) return false;
        if (desde && iso < desde) return false;
        if (hasta && iso > hasta) return false;
      }

      if (term) {
        const hay = [
          c.trip_number, c.number_order, c.license_plate,
          c.driver_name, c.company_customer_name,
          c.origin_city_name, c.destiny_city_name,
        ].join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }

      return true;
    });
  }, [data, tabActivo, busqueda, estadoFiltro, clienteFiltro, desde, hasta]);

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
    total:              data.length,
    pendientes:         data.filter(c => c.estado_documental === "pendiente").length,
    enRevision:         data.filter(c => c.estado_documental === "en_revision").length,
    conObservaciones:   data.filter(c => c.estado_documental === "con_observaciones").length,
    validados:          data.filter(c => c.estado_documental === "aprobado").length,
    listosFacturacion:  data.filter(c => c.estado_documental === "listo_facturacion").length,
    rechazados:         data.filter(c => c.estado_documental === "rechazado").length,
  }), [data]);

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
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    desde, setDesde,
    hasta, setHasta,
    pagina, setPagina,
    tamPagina, setTamPagina,
    totalPaginas,
    panelId, setPanelId, panelCumplido,
    cargar, getTabCount,
  };
}
