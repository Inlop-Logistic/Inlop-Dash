import { useState, useEffect, useMemo } from "react";
import { hoy, extraerFechaColombia } from "@/utils/date";
import { parseFechaDMY } from "@/utils/parseFecha";
import type { ViajeResumen, EstadoProgramacion } from "../types";
import { listarProgramacion, cambiarEstadoProgramacion, sincronizarViaje } from "../services/api";
import { estadoVisual } from "../constants";
import { useFiltrosComunes } from "@/hooks/useFiltrosComunes";

type TabEstado = "todos" | "programado" | "asignado" | "en_ruta" | "completado" | "cancelado" | "sin_asignar";

const TAM_PAGINA = 50;

/** Convierte schedulate_origin (DD/MM/YYYY HH:MM:SS) a YYYY-MM-DD Colombia para filtro de fecha. */
function schedulateToISO(raw: string | null | undefined): string | null {
  const d = parseFechaDMY(raw);
  if (!d) return null;
  return extraerFechaColombia(d);
}

/** Extrae la parte de hora de schedulate_origin ("DD/MM/YYYY HH:MM:SS" → "HH:MM:SS"). */
function schedulateToTime(raw: string | null | undefined): string {
  if (!raw) return "00:00:00";
  const parts = raw.trim().split(" ");
  return parts[1] ?? "00:00:00";
}

export function useProgramacion() {
  const [data, setData]           = useState<ViajeResumen[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tabEstado,      setTabEstado]      = useState<TabEstado>("todos");
  const [estadoFiltro,   setEstadoFiltro]   = useState("");
  const [clienteFiltro,  setClienteFiltro]  = useState("");
  const [panelId, setPanelId]               = useState<string | null>(null);
  const [accionLoading, setAccionLoading]   = useState(false);
  const [pagina, setPagina]                 = useState(1);

  // Filtros comunes — fechas inicializadas a hoy (bandeja diaria)
  const { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase } =
    useFiltrosComunes({ defaultDesde: hoy(), defaultHasta: hoy() });

  // desdeOpt/hastaOpt permiten pasar fechas explícitas sin depender del estado async.
  const cargar = async (desdeOpt?: string, hastaOpt?: string) => {
    const d = desdeOpt ?? fechaDesde ?? hoy();
    const h = hastaOpt ?? fechaHasta ?? hoy();
    setLoading(true);
    setError(null);
    try {
      setData(await listarProgramacion(d, h));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar programación");
    } finally {
      setLoading(false);
    }
  };

  // Carga al montar con el rango por defecto (hoy).
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Aplica un rango de fechas y recarga el backend inmediatamente.
  const buscar = (desde: string, hasta: string) => {
    setFechaRango(desde, hasta);
    cargar(desde, hasta);
  };

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

  const handleSync = async (id: string) => {
    setAccionLoading(true);
    try {
      const result = await sincronizarViaje(id);
      setData((prev) =>
        prev.map((v) =>
          v.trip_number === id
            ? { ...v, activo_en_resume: result.activo_en_resume, estado_programacion: result.estado_programacion }
            : v
        )
      );
    } finally {
      setAccionLoading(false);
    }
  };

  // ── Filtrado base — sin tab de estado ────────────────────────────────────
  // Sobre este conjunto se calculan KPIs y conteos de chips.
  const filtradas_base = useMemo<ViajeResumen[]>(() => {
    const term = busqueda.trim().toLowerCase();

    return data.filter((v) => {
      // Select de estado (dropdown)
      if (estadoFiltro && estadoVisual(v) !== estadoFiltro) return false;

      // Filtro de cliente
      if (clienteFiltro) {
        const clienteDelViaje = v.nombre_cliente || v.company_customer_name || "";
        if (clienteDelViaje !== clienteFiltro) return false;
      }

      // Filtro de fecha (client-side)
      if (fechaDesde || fechaHasta) {
        const vFecha = schedulateToISO(v.schedulate_origin) ?? v.fecha_programada_dia ?? null;
        if (!vFecha) return false;
        if (fechaDesde && vFecha < fechaDesde) return false;
        if (fechaHasta && vFecha > fechaHasta) return false;
      }

      // Búsqueda texto libre
      if (term) {
        return (
          v.trip_number.toLowerCase().includes(term) ||
          (v.license_plate ?? "").toLowerCase().includes(term) ||
          (v.driver_name ?? "").toLowerCase().includes(term) ||
          (v.company_customer_name ?? "").toLowerCase().includes(term) ||
          (v.city_origin ?? "").toLowerCase().includes(term) ||
          (v.city_destination ?? "").toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [data, estadoFiltro, clienteFiltro, busqueda, fechaDesde, fechaHasta]);

  // ── Filtrado con tab + ordenamiento ──────────────────────────────────────
  // Fecha programada DESC, hora schedulate_origin ASC dentro del mismo día.
  const filtradas = useMemo<ViajeResumen[]>(() => {
    const base = tabEstado === "todos"
      ? filtradas_base
      : filtradas_base.filter((v) => v.estado_programacion === tabEstado);

    return [...base].sort((a, b) => {
      const fa = a.fecha_programada_dia ?? "0000-00-00";
      const fb = b.fecha_programada_dia ?? "0000-00-00";
      if (fa !== fb) return fa > fb ? -1 : 1;               // fecha DESC
      const ta = schedulateToTime(a.schedulate_origin);
      const tb = schedulateToTime(b.schedulate_origin);
      return ta < tb ? -1 : ta > tb ? 1 : 0;                // hora ASC
    });
  }, [filtradas_base, tabEstado]);

  // ── KPIs calculados sobre filtradas_base (refleja filtros sin tab) ────────
  const kpis = useMemo(() => {
    const programado  = filtradas_base.filter((v) => v.estado_programacion === "programado").length;
    const sinAsignar  = filtradas_base.filter((v) => v.estado_programacion === "sin_asignar").length;
    const asignado    = filtradas_base.filter((v) => v.estado_programacion === "asignado").length;
    const enRuta      = filtradas_base.filter((v) => v.estado_programacion === "en_ruta").length;
    const completado  = filtradas_base.filter((v) => v.estado_programacion === "completado").length;
    const cancelado   = filtradas_base.filter((v) => v.estado_programacion === "cancelado").length;
    return {
      total:       filtradas_base.length,
      programado,
      sin_asignar: sinAsignar,
      asignado,
      en_ruta:     enRuta,
      completado,
      cancelado,
      pendiente:   programado + sinAsignar,
      activo:      asignado + enRuta,
    };
  }, [filtradas_base]);

  // ── Paginación ────────────────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAM_PAGINA));

  const paginadas = useMemo(
    () => filtradas.slice((pagina - 1) * TAM_PAGINA, pagina * TAM_PAGINA),
    [filtradas, pagina],
  );

  // Resetear página cuando cambia cualquier filtro o el resultado filtrado
  useEffect(() => { setPagina(1); }, [tabEstado, estadoFiltro, clienteFiltro, busqueda, fechaDesde, fechaHasta]);

  const panelViaje = panelId ? data.find((v) => v.trip_number === panelId) ?? null : null;

  const hayFiltros =
    busqueda !== "" || tabEstado !== "todos" || estadoFiltro !== "" || clienteFiltro !== "" ||
    fechaDesde !== hoy() || fechaHasta !== hoy();

  function limpiarFiltros() {
    limpiarBase();
    setTabEstado("todos");
    setEstadoFiltro("");
    setClienteFiltro("");
    setPagina(1);
    cargar(hoy(), hoy());
  }

  return {
    data, loading, error,
    busqueda, setBusqueda,
    fechaDesde, fechaHasta,
    tabEstado, setTabEstado,
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    panelId, setPanelId, panelViaje,
    accionLoading,
    filtradas_base, filtradas, kpis,
    pagina, setPagina, totalPaginas, paginadas,
    hayFiltros, limpiarFiltros,
    cargar, buscar, handleEstado, handleSync,
  };
}
