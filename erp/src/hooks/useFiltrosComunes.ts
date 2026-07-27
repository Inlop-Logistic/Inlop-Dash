import { useState } from "react";

interface Opts {
  defaultDesde?: string;
  defaultHasta?: string;
}

/**
 * Estado compartido para los filtros comunes de todos los módulos del ERP.
 * Gestiona búsqueda y rango de fechas. Cada módulo hook extiende este estado
 * con sus propios filtros específicos (estado, cliente, línea de negocio, etc.).
 */
export function useFiltrosComunes(opts?: Opts) {
  const defaultDesde = opts?.defaultDesde ?? "";
  const defaultHasta = opts?.defaultHasta ?? "";

  const [busqueda,   setBusqueda]   = useState("");
  const [fechaDesde, setFechaDesde] = useState(defaultDesde);
  const [fechaHasta, setFechaHasta] = useState(defaultHasta);

  function setFechaRango(desde: string, hasta: string) {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }

  // Restablece únicamente el estado gestionado por este hook.
  // El módulo hook llama a limpiarBase() dentro de su propio limpiarFiltros().
  function limpiarBase() {
    setBusqueda("");
    setFechaDesde(defaultDesde);
    setFechaHasta(defaultHasta);
  }

  return { busqueda, setBusqueda, fechaDesde, fechaHasta, setFechaRango, limpiarBase };
}
