import { useState, useEffect, useMemo } from "react";
import { Search, AlertTriangle, GitMerge, CheckCircle2, X } from "lucide-react";
import { listarClientes, getMergePreview, mergeCliente } from "../services/api";
import type { ClienteListItem, MergePreview } from "../types";

interface ModalFusionarClienteProps {
  /** El cliente que se mantiene como oficial */
  clienteOficial: ClienteListItem;
  onClose:  () => void;
  onSuccess: (oficialId: string) => void;
}

type Step = "seleccion" | "preview" | "ejecutando" | "exito" | "error";

export function ModalFusionarCliente({ clienteOficial, onClose, onSuccess }: ModalFusionarClienteProps) {
  const [step, setStep]                 = useState<Step>("seleccion");
  const [clientes, setClientes]         = useState<ClienteListItem[]>([]);
  const [loadingList, setLoadingList]   = useState(true);
  const [busqueda, setBusqueda]         = useState("");
  const [seleccionado, setSeleccionado] = useState<ClienteListItem | null>(null);
  const [preview, setPreview]           = useState<MergePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [motivo, setMotivo]             = useState("");
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  useEffect(() => {
    listarClientes()
      .then(data => setClientes(data.filter(c => c.id !== clienteOficial.id && c.estado !== "fusionado")))
      .catch(() => setClientes([]))
      .finally(() => setLoadingList(false));
  }, [clienteOficial.id]);

  const candidatos = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return clientes.slice(0, 50);
    return clientes
      .filter(c =>
        c.razon_social.toLowerCase().includes(term) ||
        (c.nit ?? "").includes(term) ||
        (c.codigo_cliente ?? "").toLowerCase().includes(term)
      )
      .slice(0, 50);
  }, [clientes, busqueda]);

  async function handleSeleccionar(c: ClienteListItem) {
    setSeleccionado(c);
    setStep("preview");
    setLoadingPreview(true);
    setPreview(null);
    setErrorMsg(null);
    try {
      const p = await getMergePreview(clienteOficial.id, c.id);
      setPreview(p);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al cargar el preview");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleConfirmar() {
    if (!seleccionado) return;
    setStep("ejecutando");
    setErrorMsg(null);
    try {
      await mergeCliente(clienteOficial.id, seleccionado.id, motivo.trim() || undefined);
      setStep("exito");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al ejecutar la fusión");
      setStep("error");
    }
  }

  const total = preview
    ? preview.referencias.planeados + preview.referencias.cumplidos + preview.referencias.solicitudes
    : 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && step !== "ejecutando") onClose(); }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16,
          width: "100%", maxWidth: 520,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          maxHeight: "90vh", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GitMerge style={{ color: "var(--navy)", width: 18, height: 18, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--navy)" }}>
              Fusionar Cliente
            </span>
          </div>
          {step !== "ejecutando" && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", padding: 4, display: "flex", alignItems: "center" }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>

        {/* Cliente oficial (fijo en todos los pasos) */}
        <div style={{ padding: "12px 24px", background: "var(--gray-50)", borderBottom: "1px solid var(--gray-100)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Cliente Oficial (se conserva)
          </div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--navy)" }}>
            {clienteOficial.razon_social}
          </div>
          {clienteOficial.codigo_cliente && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", fontFamily: "monospace", marginTop: 2 }}>
              {clienteOficial.codigo_cliente}{clienteOficial.nit ? ` · NIT ${clienteOficial.nit}` : ""}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* STEP: selección */}
          {step === "seleccion" && (
            <>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--gray-600)", marginBottom: 14 }}>
                Selecciona el cliente <strong>duplicado</strong>. Sus viajes y solicitudes se reasignarán al cliente oficial y quedará marcado como <em>Fusionado</em>.
              </p>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--gray-400)" }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar por nombre, NIT o código…"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "8px 10px 8px 32px",
                    border: "1.5px solid var(--gray-200)", borderRadius: 8,
                    fontSize: "var(--text-sm)", color: "var(--gray-700)",
                    outline: "none",
                  }}
                />
              </div>

              {loadingList ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--gray-400)", fontSize: "var(--text-sm)" }}>
                  Cargando clientes…
                </div>
              ) : candidatos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--gray-400)", fontSize: "var(--text-sm)" }}>
                  {busqueda ? "Sin resultados para esta búsqueda." : "No hay otros clientes disponibles."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
                  {candidatos.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSeleccionar(c)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start",
                        padding: "10px 12px", borderRadius: 8, border: "1px solid transparent",
                        background: "none", cursor: "pointer", textAlign: "left", width: "100%",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--gray-50)"; e.currentTarget.style.borderColor = "var(--gray-200)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; }}
                    >
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--gray-800)" }}>{c.razon_social}</span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", marginTop: 1, fontFamily: "monospace" }}>
                        {[c.codigo_cliente, c.nit ? `NIT ${c.nit}` : null, c.estado].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* STEP: preview */}
          {step === "preview" && (
            <>
              {loadingPreview ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--gray-400)", fontSize: "var(--text-sm)" }}>
                  Calculando impacto…
                </div>
              ) : errorMsg ? (
                <div style={{ padding: 12, borderRadius: 8, background: "#FEE2E2", color: "#991B1B", fontSize: "var(--text-sm)" }}>
                  {errorMsg}
                </div>
              ) : preview && (
                <>
                  {/* Duplicado seleccionado */}
                  <div style={{ padding: 14, borderRadius: 10, border: "1.5px solid #FCA5A5", background: "#FFF1F2", marginBottom: 16 }}>
                    <div style={{ fontSize: "var(--text-xs)", color: "#991B1B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      Cliente Duplicado (se fusionará)
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "#7F1D1D" }}>
                      {preview.duplicado.razon_social}
                    </div>
                    {preview.duplicado.codigo_cliente && (
                      <div style={{ fontSize: "var(--text-xs)", color: "#991B1B", fontFamily: "monospace", marginTop: 2 }}>
                        {preview.duplicado.codigo_cliente}
                      </div>
                    )}
                  </div>

                  {/* Referencias a reasignar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      Referencias a reasignar
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[
                        { label: "Planeados",   val: preview.referencias.planeados   },
                        { label: "Cumplidos",   val: preview.referencias.cumplidos   },
                        { label: "Solicitudes", val: preview.referencias.solicitudes },
                      ].map(({ label, val }) => (
                        <div
                          key={label}
                          style={{
                            flex: 1, padding: "10px 12px", borderRadius: 8,
                            background: val > 0 ? "#EFF6FF" : "var(--gray-50)",
                            border: `1px solid ${val > 0 ? "#BFDBFE" : "var(--gray-100)"}`,
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: val > 0 ? "var(--navy)" : "var(--gray-300)" }}>
                            {val}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-500)", marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Identity Rules que se crearán */}
                  {preview.identity_rules.length > 0 && (
                    <div style={{ padding: 12, borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", marginBottom: 16 }}>
                      <div style={{ fontSize: "var(--text-xs)", color: "#166534", fontWeight: 600, marginBottom: 6 }}>
                        Identity Rules que se crearán automáticamente
                      </div>
                      {preview.identity_rules.map(n => (
                        <div key={n} style={{ fontSize: "var(--text-xs)", color: "#166534", fontFamily: "monospace", padding: "2px 0" }}>
                          "{n}" → {preview.oficial.razon_social}
                        </div>
                      ))}
                      <div style={{ fontSize: "var(--text-xs)", color: "#166534", marginTop: 6, opacity: 0.8 }}>
                        Las próximas sincronizaciones reconocerán automáticamente estos nombres.
                      </div>
                    </div>
                  )}

                  {/* Advertencia */}
                  <div style={{ display: "flex", gap: 8, padding: 12, borderRadius: 8, background: "#FFFBEB", border: "1px solid #FDE68A", marginBottom: 16 }}>
                    <AlertTriangle style={{ width: 14, height: 14, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: "var(--text-xs)", color: "#92400E", lineHeight: 1.5 }}>
                      Esta acción es <strong>irreversible</strong>. El cliente duplicado quedará marcado como <em>Fusionado</em> y sus registros pasarán al cliente oficial.
                    </span>
                  </div>

                  {/* Motivo opcional */}
                  <div>
                    <label style={{ fontSize: "var(--text-xs)", color: "var(--gray-500)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                      Motivo <span style={{ fontWeight: 400 }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Nombre duplicado desde ControlT, cliente ya existía en el Maestro"
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "8px 10px", fontSize: "var(--text-sm)",
                        border: "1.5px solid var(--gray-200)", borderRadius: 8,
                        color: "var(--gray-700)", outline: "none",
                      }}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* STEP: ejecutando */}
          {step === "ejecutando" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: "var(--text-md)", color: "var(--gray-600)", fontWeight: 500 }}>
                Fusionando clientes…
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--gray-400)", marginTop: 8 }}>
                Reasignando {total} referencia{total !== 1 ? "s" : ""} y creando Identity Rules.
              </div>
            </div>
          )}

          {/* STEP: éxito */}
          {step === "exito" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <CheckCircle2 style={{ width: 40, height: 40, color: "#059669", margin: "0 auto 12px" }} />
              <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--gray-800)", marginBottom: 6 }}>
                Fusión completada
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--gray-500)" }}>
                El cliente duplicado fue fusionado correctamente y las Identity Rules fueron creadas.
              </div>
            </div>
          )}

          {/* STEP: error */}
          {step === "error" && (
            <div style={{ padding: 14, borderRadius: 10, background: "#FEE2E2", color: "#991B1B", fontSize: "var(--text-sm)" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Error al fusionar</div>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--gray-100)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {step === "seleccion" && (
            <button
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--gray-200)", background: "#fff", color: "var(--gray-700)", fontSize: "var(--text-sm)", cursor: "pointer" }}
            >
              Cancelar
            </button>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => { setStep("seleccion"); setSeleccionado(null); setPreview(null); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--gray-200)", background: "#fff", color: "var(--gray-700)", fontSize: "var(--text-sm)", cursor: "pointer" }}
              >
                ← Volver
              </button>
              <button
                onClick={handleConfirmar}
                disabled={loadingPreview || !!errorMsg}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: loadingPreview || errorMsg ? "var(--gray-200)" : "#DC2626",
                  color: loadingPreview || errorMsg ? "var(--gray-400)" : "#fff",
                  fontSize: "var(--text-sm)", fontWeight: 600,
                  cursor: loadingPreview || errorMsg ? "not-allowed" : "pointer",
                }}
              >
                Confirmar fusión
              </button>
            </>
          )}

          {step === "exito" && (
            <button
              onClick={() => onSuccess(clienteOficial.id)}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--navy)", color: "#fff", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer" }}
            >
              Cerrar
            </button>
          )}

          {step === "error" && (
            <>
              <button
                onClick={() => { setStep("preview"); setErrorMsg(null); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--gray-200)", background: "#fff", color: "var(--gray-700)", fontSize: "var(--text-sm)", cursor: "pointer" }}
              >
                Reintentar
              </button>
              <button
                onClick={onClose}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--gray-200)", background: "#fff", color: "var(--gray-700)", fontSize: "var(--text-sm)", cursor: "pointer" }}
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
