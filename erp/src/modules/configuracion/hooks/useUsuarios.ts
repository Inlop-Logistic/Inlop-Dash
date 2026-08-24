import { useState, useEffect, useMemo, useCallback } from "react";
import type { UsuarioRbac } from "../types";
import { listarUsuarios } from "../services/api";

export type FiltroEstadoUsuario = "" | "activo" | "inactivo";

/**
 * Estado de Configuración → Parámetros → Usuarios (Sprint 3D-4).
 * Solo lectura: consume GET /api/usuarios (Sprint 3D-3) tal cual — sin
 * insertar/actualizar/eliminar, sin tocar profiles/usuario_roles.
 */
export function useUsuarios() {
  const [data,     setData]     = useState<UsuarioRbac[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoUsuario>("");
  const [panelId,  setPanelId]  = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listarUsuarios());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Filtrado en memoria ───────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let rows = data;
    if (filtroEstado === "activo")   rows = rows.filter(u => u.activo);
    if (filtroEstado === "inactivo") rows = rows.filter(u => !u.activo);

    const term = busqueda.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(u =>
      u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }, [data, busqueda, filtroEstado]);

  const panelUsuario = useMemo(
    () => (panelId ? data.find(u => u.id === panelId) ?? null : null),
    [panelId, data]
  );

  return {
    filtrados, loading, error, cargar,
    busqueda, setBusqueda,
    filtroEstado, setFiltroEstado,
    panelId, setPanelId, panelUsuario,
  };
}
