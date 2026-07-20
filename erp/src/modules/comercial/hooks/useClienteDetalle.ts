import { useState, useEffect } from "react";
import type { ClienteListItem } from "../types";
import { getClienteById } from "../services/api";

export function useClienteDetalle(clienteId: string) {
  const [cliente, setCliente]   = useState<ClienteListItem | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setCliente(await getClienteById(clienteId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar cliente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getClienteById(clienteId)
      .then(data => { if (active) setCliente(data); })
      .catch(e  => { if (active) setError(e instanceof Error ? e.message : "Error al cargar cliente"); })
      .finally(()  => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clienteId]);

  return { cliente, loading, error, recargar: cargar };
}
