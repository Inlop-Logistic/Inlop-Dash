import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/state/AuthContext";
import type { SoporteCumplido } from "../types";
import {
  listarSoportesCumplido,
  subirSoporteCumplido,
  reemplazarSoporteCumplido,
  eliminarSoporteCumplido,
  urlFirmadaSoporte,
  actualizarEstadoCumplido,
} from "../services/api";

/** Progreso de una carga múltiple en curso — null cuando no hay carga activa. */
export interface ProgresoCarga {
  completados: number;
  total:       number;
  fallidos:    string[]; // nombres de archivo que fallaron
}

export function useSoportesCumplido(trip: string, licensePlate: string | null) {
  const { profile } = useAuth();
  const usuario      = profile ? `${profile.nombre} (${profile.email})` : "";
  const placa         = licensePlate ?? "SIN";

  const [soportes,  setSoportes]  = useState<SoporteCumplido[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [progreso,  setProgreso]  = useState<ProgresoCarga | null>(null);
  const [reemplazandoId, setReemplazandoId] = useState<string | null>(null);
  const [eliminandoId,   setEliminandoId]   = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!trip) return;
    setCargando(true);
    setError(null);
    try {
      const r = await listarSoportesCumplido(trip);
      setSoportes(r.documentos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar soportes");
    } finally {
      setCargando(false);
    }
  }, [trip]);

  useEffect(() => { cargar(); }, [cargar]);

  // Sube uno o varios archivos en una sola operación de usuario. Se suben
  // secuencialmente (un POST por archivo) para poder reportar progreso real y
  // no saturar la conexión; el panel permanece abierto durante toda la carga.
  const subirVarios = useCallback(
    async (files: File[], descripcion: string) => {
      setError(null);
      setProgreso({ completados: 0, total: files.length, fallidos: [] });
      const fallidos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          await subirSoporteCumplido(trip, files[i], descripcion, usuario, placa);
        } catch (e) {
          fallidos.push(`${files[i].name}: ${e instanceof Error ? e.message : "error desconocido"}`);
        }
        setProgreso({ completados: i + 1, total: files.length, fallidos: [...fallidos] });
      }
      await cargar();
      if (fallidos.length > 0) {
        setError(`No se pudieron cargar ${fallidos.length} de ${files.length} archivo(s): ${fallidos.join(" · ")}`);
      }
      setProgreso(null);
      return fallidos.length === 0;
    },
    [trip, usuario, placa, cargar],
  );

  const reemplazar = useCallback(
    async (id: string, file: File) => {
      setReemplazandoId(id);
      setError(null);
      try {
        await reemplazarSoporteCumplido(trip, id, file, usuario, placa);
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al reemplazar el soporte");
      } finally {
        setReemplazandoId(null);
      }
    },
    [trip, usuario, placa, cargar],
  );

  const eliminar = useCallback(
    async (id: string) => {
      setEliminandoId(id);
      setError(null);
      try {
        await eliminarSoporteCumplido(trip, id);
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar el soporte");
      } finally {
        setEliminandoId(null);
      }
    },
    [trip, cargar],
  );

  const abrirUrl = useCallback(
    async (id: string, descargar = false) => {
      try {
        const { url } = await urlFirmadaSoporte(trip, id, descargar);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        console.error("Error obteniendo URL firmada:", e);
      }
    },
    [trip],
  );

  const solicitarWhatsApp = useCallback(
    async (tel: string, driverName: string) => {
      const clean = tel.replace(/\D/g, "");
      const msg   = encodeURIComponent(
        `Hola ${driverName}, le informamos que los documentos del viaje ${trip} están pendientes. Por favor envíe la documentación a la mayor brevedad. Gracias.`,
      );
      window.open(`https://wa.me/57${clean}?text=${msg}`, "_blank", "noopener,noreferrer");
      try {
        await actualizarEstadoCumplido(trip, "SOLICITADO");
      } catch (_) {
        // WhatsApp ya se abrió; no bloqueamos al usuario por este error
      }
    },
    [trip],
  );

  return {
    soportes, cargando, error, progreso,
    reemplazandoId, eliminandoId,
    cargar, subirVarios, reemplazar, eliminar, abrirUrl, solicitarWhatsApp,
  };
}
