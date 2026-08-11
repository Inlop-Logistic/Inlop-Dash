/**
 * ModalEnviarReporte — Confirmación y ejecución de "Enviar ahora" (Fase 9E).
 *
 * Flujo: confirmar → enviando → enviado | error. No modifica la
 * configuración del reporte ni bloquea el resto de la app (overlay propio,
 * cerrable salvo mientras está enviando).
 *
 * Antes de enviar muestra: nombre del reporte, formato, cantidad de
 * destinatarios INLOP y cantidad de destinatarios externos — tal como están
 * configurados hoy en el reporte, sin deduplicar (mismo criterio que el
 * backend: el conteo mostrado nunca oculta personas).
 */
import { useState } from "react";
import { Send, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button, InfoRow } from "@/components/ui";
import { enviarReporteManual } from "../services/api";
import { labelFormato, type ReporteAutomatico, type ResultadoEnvioManual } from "../types";

type Estado = "confirmar" | "enviando" | "enviado" | "error";

interface Props {
  reporte: ReporteAutomatico;
  onClose: () => void;
}

export function ModalEnviarReporte({ reporte, onClose }: Props) {
  const [estado, setEstado]       = useState<Estado>("confirmar");
  const [resultado, setResultado] = useState<ResultadoEnvioManual | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);

  const nInlop    = reporte.destinatarios.personal_ids.length;
  const nExternos = reporte.destinatarios.correos_externos.length;

  async function handleEnviar() {
    setEstado("enviando");
    setErrorMsg(null);
    try {
      const res = await enviarReporteManual(reporte.id);
      setResultado(res);
      setEstado("enviado");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al enviar el reporte");
      setEstado("error");
    }
  }

  // No se cierra mientras está en curso — evita perder el resultado de un
  // envío que ya se disparó (el envío en sí no se puede cancelar).
  function handleClose() {
    if (estado === "enviando") return;
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
        aria-label="Enviar reporte ahora"
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
            <Send className="w-4 h-4" style={{ color: "var(--navy)" }} />
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>
              Enviar reporte ahora
            </span>
          </div>
          {estado !== "enviando" && (
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

          {estado === "confirmar" && (
            <div className="flex flex-col gap-4">
              <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>
                Se generará el archivo con la configuración actual del reporte y se
                enviará por correo de inmediato.
              </p>
              <div
                className="flex flex-col gap-1.5 rounded-xl p-3.5"
                style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
              >
                <InfoRow label="Reporte"              value={reporte.nombre} />
                <InfoRow label="Formato"               value={labelFormato(reporte.formato)} />
                <InfoRow label="Destinatarios INLOP"    value={String(nInlop)} />
                <InfoRow label="Destinatarios externos" value={String(nExternos)} />
              </div>
            </div>
          )}

          {estado === "enviando" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
              <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>
                Generando y enviando el reporte…
              </p>
            </div>
          )}

          {estado === "enviado" && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="w-8 h-8" style={{ color: "var(--success)" }} />
              <p className="font-semibold text-[14px]" style={{ color: "var(--gray-800)" }}>
                Reporte enviado correctamente
              </p>
              {resultado && (
                <p className="text-[12.5px]" style={{ color: "var(--gray-500)" }}>
                  {resultado.destinatarios.totalEnviados} destinatario
                  {resultado.destinatarios.totalEnviados !== 1 ? "s" : ""} · {resultado.filename}
                </p>
              )}
            </div>
          )}

          {estado === "error" && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <AlertCircle className="w-8 h-8" style={{ color: "var(--inlop-red)" }} />
              <p className="font-semibold text-[14px]" style={{ color: "var(--gray-800)" }}>
                No se pudo enviar el reporte
              </p>
              {errorMsg && (
                <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>
                  {errorMsg}
                </p>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--gray-100)" }}
        >
          {estado === "confirmar" && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancelar
              </Button>
              <Button size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={handleEnviar}>
                Enviar ahora
              </Button>
            </>
          )}
          {estado === "enviando" && (
            <Button size="sm" loading disabled>
              Enviando…
            </Button>
          )}
          {estado === "enviado" && (
            <Button size="sm" onClick={handleClose}>
              Cerrar
            </Button>
          )}
          {estado === "error" && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cerrar
              </Button>
              <Button size="sm" onClick={handleEnviar}>
                Reintentar
              </Button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
