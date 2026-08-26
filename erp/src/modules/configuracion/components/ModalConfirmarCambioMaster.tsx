/**
 * ModalConfirmarCambioMaster — confirmación reforzada antes de agregar o
 * quitar el rol `master` a un usuario (Sprint 3D-7.4). El rol master tiene
 * "poderes reforzados" en el backend (esMaster requerido, protección de
 * último master — ver PUT /api/usuarios/:id/roles, Sprint 3D-7.2); esta
 * capa es solo UX, un freno adicional antes de confirmar una acción de alto
 * impacto — la autoridad real sigue siendo el backend.
 *
 * Mismo patrón visual que ModalEliminarReporte.tsx: overlay + diálogo,
 * estados confirmar → guardando → error, sin componente ni librería nueva.
 * A diferencia de ese modal, el request en sí lo dispara el hook
 * (useUsuarios#ejecutarGuardado) — este componente solo confirma y refleja
 * `guardando`/`error` recibidos por props, para no duplicar el estado de
 * guardado ya existente en el panel.
 */
import { ShieldAlert, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  usuarioNombre: string;
  /** true = la selección agrega master; false = lo quita. */
  agregando: boolean;
  guardando: boolean;
  error: string | null;
  onConfirmar: () => void;
  onCancelar:  () => void;
}

export function ModalConfirmarCambioMaster({
  usuarioNombre, agregando, guardando, error, onConfirmar, onCancelar,
}: Props) {
  function handleClose() {
    if (guardando) return;
    onCancelar();
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
        aria-label="Confirmar cambio de rol master"
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
            <ShieldAlert className="w-4 h-4" style={{ color: "var(--inlop-red)" }} />
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>
              {agregando ? "Agregar rol master" : "Quitar rol master"}
            </span>
          </div>
          {!guardando && (
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
          {!guardando && (
            <div className="flex flex-col gap-4">
              <div
                className="flex items-start gap-2 rounded-xl p-3"
                style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-light)" }}
              >
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
                <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>
                  {agregando ? (
                    <>Esto le da a <strong>{usuarioNombre}</strong> acceso total al ERP, sin restricción de permisos.</>
                  ) : (
                    <>Esto le quita a <strong>{usuarioNombre}</strong> el acceso total de master. Si es el único master activo, el backend rechazará el cambio.</>
                  )}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
                  <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
                </div>
              )}
            </div>
          )}

          {guardando && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
              <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>Guardando…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--gray-100)" }}
        >
          {!guardando && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<ShieldAlert className="w-3.5 h-3.5" />}
                onClick={onConfirmar}
              >
                {error ? "Reintentar" : "Sí, confirmar"}
              </Button>
            </>
          )}
          {guardando && (
            <Button size="sm" loading disabled>
              Guardando…
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
