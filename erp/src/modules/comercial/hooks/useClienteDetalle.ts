import { useState, useEffect, useCallback } from "react";
import type { ClienteDetalle, CambioEstadoPayload, NuevoClienteFormData } from "../types";
import { getClienteById, actualizarCliente, cambiarEstadoCliente } from "../services/api";

export function useClienteDetalle(clienteId: string) {
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [loading, setLoading] = useState(clienteId !== "nuevo");
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (clienteId === "nuevo") return;
    setLoading(true);
    setError(null);
    try {
      setCliente(await getClienteById(clienteId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar cliente");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (clienteId === "nuevo") { setCliente(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError(null);
    getClienteById(clienteId)
      .then(data  => { if (active) setCliente(data); })
      .catch(e    => { if (active) setError(e instanceof Error ? e.message : "Error al cargar cliente"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clienteId]);

  const guardar = useCallback(async (data: Partial<NuevoClienteFormData>): Promise<ClienteDetalle | null> => {
    setSaving(true);
    setErrorGuardar(null);
    try {
      const updated = await actualizarCliente(clienteId, data);
      setCliente(updated);
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      setErrorGuardar(msg);
      return null;
    } finally {
      setSaving(false);
    }
  }, [clienteId]);

  const cambiarEstado = useCallback(async (payload: CambioEstadoPayload): Promise<boolean> => {
    setSaving(true);
    setErrorGuardar(null);
    try {
      await cambiarEstadoCliente(clienteId, payload);
      await cargar();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cambiar estado";
      setErrorGuardar(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [clienteId, cargar]);

  return { cliente, loading, error, saving, errorGuardar, recargar: cargar, guardar, cambiarEstado };
}
