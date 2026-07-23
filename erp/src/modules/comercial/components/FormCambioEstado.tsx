import { useState } from "react";
import { SidePanel } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import type { EstadoCliente, CambioEstadoPayload } from "../types";
import { ESTADO_CLIENTE_CFG, TRANSICIONES_ESTADO, MOTIVOS_CAMBIO_ESTADO } from "../constants";

interface FormCambioEstadoProps {
  open: boolean;
  estadoActual: EstadoCliente;
  onClose: () => void;
  onGuardar: (payload: CambioEstadoPayload) => Promise<boolean>;
  saving?: boolean;
}

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  fontSize: "var(--text-sm)",
  color: "var(--gray-700)",
  border: "1px solid var(--gray-200)",
  borderRadius: 8,
  padding: "8px 12px",
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};

export function FormCambioEstado({
  open, estadoActual, onClose, onGuardar, saving = false,
}: FormCambioEstadoProps) {
  const [nuevoEstado, setNuevoEstado] = useState<EstadoCliente | "">("");
  const [motivo, setMotivo]           = useState("");
  const [motivoCustom, setMotivoCustom] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError]             = useState<string | null>(null);

  const transiciones = TRANSICIONES_ESTADO[estadoActual] ?? [];
  const motivos = nuevoEstado ? MOTIVOS_CAMBIO_ESTADO[nuevoEstado] : [];
  const motivoFinal = motivo === "Otro" ? motivoCustom.trim() : motivo;

  const handleClose = () => {
    setNuevoEstado(""); setMotivo(""); setMotivoCustom(""); setObservacion(""); setError(null);
    onClose();
  };

  const handleGuardar = async () => {
    if (!nuevoEstado) { setError("Selecciona el nuevo estado"); return; }
    if (!motivoFinal) { setError("El motivo es obligatorio"); return; }
    setError(null);
    const ok = await onGuardar({ estado: nuevoEstado, motivo: motivoFinal, observacion: observacion.trim() || undefined });
    if (ok) handleClose();
  };

  const cfgActual = ESTADO_CLIENTE_CFG[estadoActual];

  return (
    <SidePanel
      open={open}
      onClose={handleClose}
      title="Cambiar Estado"
      subtitle="El cambio quedará registrado en el historial del cliente"
      width="420px"
      footer={
        <div className="px-6 py-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleGuardar}>
            Confirmar cambio
          </Button>
        </div>
      }
    >
      <div className="px-6 py-5 flex flex-col gap-5">

        {/* Estado actual */}
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", marginBottom: 6, fontWeight: 600 }}>
            ESTADO ACTUAL
          </div>
          <Badge variant={cfgActual.variant}>{cfgActual.label}</Badge>
        </div>

        {/* Nuevo estado */}
        <div>
          <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--gray-700)", display: "block", marginBottom: 6 }}>
            Nuevo estado <span style={{ color: "var(--inlop-red)" }}>*</span>
          </label>
          {transiciones.length === 0 ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--gray-400)" }}>
              No hay transiciones disponibles desde este estado.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transiciones.map(est => {
                const cfg = ESTADO_CLIENTE_CFG[est];
                const selected = nuevoEstado === est;
                return (
                  <button
                    key={est}
                    onClick={() => { setNuevoEstado(est); setMotivo(""); }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      fontSize: "var(--text-sm)",
                      fontWeight: selected ? 700 : 500,
                      border: selected ? `2px solid var(--navy)` : "1.5px solid var(--gray-200)",
                      background: selected ? "var(--navy)" : "#fff",
                      color: selected ? "#fff" : "var(--gray-700)",
                      cursor: "pointer",
                      transition: "all 0.1s",
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Motivo */}
        {nuevoEstado && (
          <div>
            <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--gray-700)", display: "block", marginBottom: 6 }}>
              Motivo <span style={{ color: "var(--inlop-red)" }}>*</span>
            </label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)} style={FIELD_STYLE}>
              <option value="">Selecciona un motivo…</option>
              {motivos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {motivo === "Otro" && (
              <input
                type="text"
                value={motivoCustom}
                onChange={e => setMotivoCustom(e.target.value)}
                placeholder="Describe el motivo…"
                style={{ ...FIELD_STYLE, marginTop: 8 }}
              />
            )}
          </div>
        )}

        {/* Observación */}
        {nuevoEstado && (
          <div>
            <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--gray-700)", display: "block", marginBottom: 6 }}>
              Observación <span style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", fontWeight: 400 }}>(opcional)</span>
            </label>
            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Información adicional sobre el cambio de estado…"
              rows={3}
              style={{ ...FIELD_STYLE, resize: "vertical" }}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--inlop-red)",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </SidePanel>
  );
}
