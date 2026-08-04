import { useState, useEffect, useCallback } from "react";
import type { DocumentoArchivo } from "../types";
import {
  listarDocumentosCumplido,
  subirDocumentoCumplido,
  eliminarDocumentoCumplido,
  urlFirmadaDocumento,
  actualizarEstadoCumplido,
} from "../services/api";

export function useDocumentosCumplido(trip: string) {
  const [archivos,  setArchivos]  = useState<DocumentoArchivo[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!trip) return;
    setCargando(true);
    setError(null);
    try {
      const r = await listarDocumentosCumplido(trip);
      setArchivos(r.archivos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar documentos");
    } finally {
      setCargando(false);
    }
  }, [trip]);

  useEffect(() => { cargar(); }, [cargar]);

  const subir = useCallback(
    async (tipo: string, placa: string, file: File) => {
      setUploading(tipo);
      try {
        await subirDocumentoCumplido(trip, tipo, placa, file);
        await cargar();
      } finally {
        setUploading(null);
      }
    },
    [trip, cargar],
  );

  const eliminar = useCallback(
    async (filename: string) => {
      setError(null);
      try {
        await eliminarDocumentoCumplido(trip, filename);
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar");
      }
    },
    [trip, cargar],
  );

  const abrirUrl = useCallback(
    async (filename: string, descargar = false) => {
      try {
        const { url } = await urlFirmadaDocumento(trip, filename);
        const dest = descargar
          ? url + (url.includes("?") ? "&" : "?") + "download=true"
          : url;
        window.open(dest, "_blank", "noopener,noreferrer");
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
    archivos, cargando, error, uploading,
    cargar, subir, eliminar, abrirUrl, solicitarWhatsApp,
  };
}
