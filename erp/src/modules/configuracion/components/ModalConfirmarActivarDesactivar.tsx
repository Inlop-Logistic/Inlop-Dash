/**
 * ModalConfirmarActivarDesactivar — confirma activar/desactivar un usuario
 * ERP (Sprint 3D-7.8D). El backend aplica profiles.activo (mecanismo
 * principal de bloqueo, 3D-7.7C) y, de forma complementaria, ban/unban en
 * Supabase Auth. Si el usuario objetivo tiene el rol master, el backend
 * exige esMaster real del actor — este modal solo advierte de eso, la
 * autoridad real es el backend (403 si no aplica).
 *
 * Mismo patrón visual/estructural que los demás modales de confirmación de
 * este módulo.
 */
import { UserCheck, UserX, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  usuarioNombre: string;
  /** true = la acción activa al usuario; false = lo desactiva. */
  activando: boolean;
  esMaster:  boolean;
  guardando: boolean;
  error:     string | null;
  onConfirmar: () => void;
  onCancelar:  () => void;
}

export function ModalConfirmarActivarDesactivar({
  usuarioNombre, activando, esMaster, guardando, error, onConfirmar, onCancelar,
}: Props) {
  function handleClose() {
    if (guardando) return;
    onCancelar();
  }

  const Icono = activando ? UserCheck : UserX;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(1,42,107,0.25)", backdropFilter: "blur(2px)" }}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activando ? "Activar usuario" : "Desactivar usuario"}
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
            <Icono className="w-4 h-4" style={{ color: activando ? "var(--navy)" : "var(--inlop-red)" }} />
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>
              {activando ? "Activar usuario" : "Desactivar usuario"}
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
              <p className="text-[12.5px]" style={{ color: "var(--gray-500)" }}>
                {activando ? (
                  <>Esto restaura el acceso de <strong>{usuarioNombre}</strong> al ERP.</>
                ) : (
                  <>Esto bloquea el acceso de <strong>{usuarioNombre}</strong> al ERP. Sus roles y
                    excepciones se conservan — puede reactivarse en cualquier momento.</>
                )}
              </p>

              {esMaster && (
                <div
                  className="flex items-start gap-2 rounded-xl p-3"
                  style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-light)" }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
                  <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>
                    <strong>{usuarioNombre}</strong> tiene el rol <strong>master</strong> — solo otro
                    master puede confirmar esta acción.
                  </p>
                </div>
              )}

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
                variant={activando ? "primary" : "danger"}
                size="sm"
                icon={<Icono className="w-3.5 h-3.5" />}
                onClick={onConfirmar}
              >
                {error ? "Reintentar" : activando ? "Sí, activar" : "Sí, desactivar"}
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
