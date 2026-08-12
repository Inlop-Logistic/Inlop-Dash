/**
 * ModalEliminarReporte — Confirmación explícita antes de eliminar (Fase 9I).
 *
 * Flujo: confirmar → eliminando → error (si falla). Al confirmar con éxito
 * se cierra de inmediato — el llamador ya quitó la fila del listado en
 * memoria (useReportesAutomaticos#eliminar), sin recargar la aplicación.
 */
import { useState } from "react";
import { Trash2, X, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import type { ReporteAutomatico } from "../types";

type Estado = "confirmar" | "eliminando" | "error";

interface Props {
  reporte:    ReporteAutomatico;
  onEliminar: (id: string) => Promise<void>;
  onClose:    () => void;
}

export function ModalEliminarReporte({ reporte, onEliminar, onClose }: Props) {
  const [estado,   setEstado]   = useState<Estado>("confirmar");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleEliminar() {
    setEstado("eliminando");
    setErrorMsg(null);
    try {
      await onEliminar(reporte.id);
      // Éxito: el listado ya se actualizó — no hay nada más que mostrar.
      onClose();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al eliminar el reporte");
      setEstado("error");
    }
  }

  function handleClose() {
    if (estado === "eliminando") return;
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(1,42,107,0.25)", backdropFilter: "blur(2px)" }}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Eliminar reporte"
        className="w-full flex flex-col bg-white"
        style={{
          maxWidth:     "420px",
          borderRadius: "var(--radius-2xl)",
          boxShadow:    "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--gray-100)" }}
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" style={{ color: "var(--inlop-red)" }} />
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>
              Eliminar reporte
            </span>
          </div>
          {estado !== "eliminando" && (
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" style={{ color: "var(--gray-500)" }} />
            </button>
          )}
        </div>

        {/* Cuerpo */}
        <div className="p-5">

          {estado !== "eliminando" && (
            <div className="flex flex-col gap-4">
              <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>
                Esta acción elimina el reporte de forma definitiva y no se puede deshacer.
              </p>

              <div
                className="rounded-xl p-3.5"
                style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
              >
                <p className="text-[12px]" style={{ color: "var(--gray-400)" }}>Reporte</p>
                <p className="font-semibold text-[14px]" style={{ color: "var(--gray-800)" }}>
                  {reporte.nombre}
                </p>
              </div>

              {reporte.activo && (
                <div
                  className="flex items-start gap-2 rounded-xl p-3"
                  style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-light)" }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
                  <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>
                    Este reporte está <strong>activo</strong>: al eliminarlo dejará de ejecutarse
                    y no se enviará ninguna próxima vez.
                  </p>
                </div>
              )}

              {estado === "error" && errorMsg && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
                  <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>{errorMsg}</p>
                </div>
              )}
            </div>
          )}

          {estado === "eliminando" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
              <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>
                Eliminando reporte…
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--gray-100)" }}
        >
          {estado !== "eliminando" && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={handleEliminar}
              >
                {estado === "error" ? "Reintentar" : "Eliminar definitivamente"}
              </Button>
            </>
          )}
          {estado === "eliminando" && (
            <Button size="sm" loading disabled>
              Eliminando…
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
