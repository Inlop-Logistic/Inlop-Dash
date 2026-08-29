/**
 * ModalConfirmarResetPassword — confirma el envío del correo oficial de
 * recuperación de Supabase Auth a un usuario (Sprint 3D-7.8D). Nunca
 * genera ni muestra una contraseña — el usuario la establece él mismo
 * desde el correo. Mismo patrón visual/estructural que los demás modales
 * de confirmación de este módulo (overlay, header/body/footer, estados
 * confirmar → guardando → error/éxito).
 */
import { KeyRound, X, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  usuarioNombre: string;
  guardando: boolean;
  error:     string | null;
  exito:     boolean;
  onConfirmar: () => void;
  onCancelar:  () => void;
}

export function ModalConfirmarResetPassword({
  usuarioNombre, guardando, error, exito, onConfirmar, onCancelar,
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
        aria-label="Restablecer contraseña"
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
            <KeyRound className="w-4 h-4" style={{ color: "var(--navy)" }} />
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>
              Restablecer contraseña
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
          {!guardando && !exito && (
            <div className="flex flex-col gap-4">
              <p className="text-[12.5px]" style={{ color: "var(--gray-500)" }}>
                Se enviará un correo a <strong>{usuarioNombre}</strong> con un enlace para
                establecer una nueva contraseña. Ninguna contraseña se genera ni se muestra aquí.
              </p>

              {error && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
                  <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
                </div>
              )}
            </div>
          )}

          {!guardando && exito && (
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" style={{ color: "#065F46" }} />
              <p className="text-[12.5px]" style={{ color: "#065F46" }}>
                Correo enviado a <strong>{usuarioNombre}</strong>.
              </p>
            </div>
          )}

          {guardando && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
              <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>Enviando…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--gray-100)" }}
        >
          {!guardando && exito && (
            <Button size="sm" onClick={handleClose}>
              Cerrar
            </Button>
          )}
          {!guardando && !exito && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancelar
              </Button>
              <Button size="sm" icon={<KeyRound className="w-3.5 h-3.5" />} onClick={onConfirmar}>
                {error ? "Reintentar" : "Enviar correo"}
              </Button>
            </>
          )}
          {guardando && (
            <Button size="sm" loading disabled>
              Enviando…
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
