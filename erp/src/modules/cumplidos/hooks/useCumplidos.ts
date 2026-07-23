import { useState, useEffect, useCallback, useMemo } from "react";
import { parseFechaMDY } from "@/utils/parseFecha";
import { lineaNegocio } from "@/utils/lineaNegocio";
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
  const [busqueda,           setBusqueda]           = useState("");
  const [tabActivo,          setTabActivo]           = useState<TabCumplidos>("todos");
  const [lineaNegocioFiltro, setLineaNegocioFiltro] = useState("");
  const [clienteFiltro,      setClienteFiltro]      = useState("");
  const [desde,              setDesde]              = useState("");
  const [hasta,              setHasta]              = useState("");

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
      if (desde || hasta) {
        const iso = activatedOnISO(c);
        if (!iso) return false;
        if (desde && iso < desde) return false;
        if (hasta && iso > hasta) return false;
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
  }, [data, tabActivo, busqueda, lineaNegocioFiltro, clienteFiltro, desde, hasta]);

  // Resetear página cuando cambian los filtros
  useEffect(() => { setPagina(1); }, [filtradas]);

  // ── Paginación ────────────────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamPagina));
  const paginadas    = useMemo(
    () => filtradas.slice((pagina - 1) * tamPagina, pagina * tamPagina),
    [filtradas, pagina, tamPagina],
  );

  // ── KPIs — calculados sobre el conjunto filtrado activo ───────────────────
  // KPIs de estado viaje (derivado de fecha_cumplido):
  //   Pendientes  → viaje aún activo en Viajes (fecha_cumplido null)
  //   Finalizados → viaje con fecha de finalización confirmada
  // KPIs de estado documental:
  //   Cumplidos  → estado_documental === "aprobado"  (expediente aprobado)
  //   Liquidados → estado_documental === "listo_facturacion"
  //   Facturados → no existe campo en el modelo actual (siempre 0 — ver informe técnico)
  const kpis = useMemo<KpisCumplidos>(() => ({
    total:       filtradas.length,
    pendientes:  filtradas.filter(c => !c.fecha_cumplido).length,
    finalizados: filtradas.filter(c => !!c.fecha_cumplido).length,
    cumplidos:   filtradas.filter(c => c.estado_documental === "aprobado").length,
    liquidados:  filtradas.filter(c => c.estado_documental === "listo_facturacion").length,
    facturados:  0, // Sin campo en tabla cumplidos — pendiente Evolución 02
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
    busqueda !== "" || desde !== "" || hasta !== "" ||
    lineaNegocioFiltro !== "" || clienteFiltro !== "" || tabActivo !== "todos";

  const limpiarFiltros = useCallback(() => {
    setBusqueda("");
    setDesde("");
    setHasta("");
    setLineaNegocioFiltro("");
    setClienteFiltro("");
    setTabActivo("todos");
    setPagina(1);
  }, []);

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
    desde, setDesde,
    hasta, setHasta,
    pagina, setPagina,
    tamPagina, setTamPagina,
    totalPaginas,
    hayFiltros, limpiarFiltros,
    panelId, setPanelId, panelCumplido,
    cargar, getTabCount,
  };
}
