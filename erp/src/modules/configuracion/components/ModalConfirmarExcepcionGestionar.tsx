/**
 * ModalConfirmarExcepcionGestionar — confirmación reforzada antes de
 * agregar, modificar o quitar una excepción individual sobre
 * `rbac:gestionar` en usuario_permisos (Sprint 3D-7.6). El backend ya exige
 * esMaster real para tocar esa excepción (PUT /api/usuarios/:id/permisos);
 * esta capa es solo UX, un freno adicional antes de confirmar.
 *
 * Mismo patrón visual/estructural que ModalConfirmarPermisoGestionar.tsx
 * (Sprint 3D-7.5) y ModalConfirmarCambioMaster.tsx (Sprint 3D-7.4) — overlay
 * + diálogo, estados confirmar → guardando → error, sin componente ni
 * librería nueva. El request lo dispara el hook
 * (useUsuarios#ejecutarGuardadoExcepciones) — este componente solo confirma
 * y refleja `guardando`/`error` recibidos por props.
 */
import { ShieldAlert, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  usuarioNombre: string;
  /** Efecto deseado tras guardar — null significa "quitar la excepción". */
  efectoDeseado: "grant" | "revoke" | null;
  guardando: boolean;
  error: string | null;
  onConfirmar: () => void;
  onCancelar:  () => void;
}

export function ModalConfirmarExcepcionGestionar({
  usuarioNombre, efectoDeseado, guardando, error, onConfirmar, onCancelar,
}: Props) {
  function handleClose() {
    if (guardando) return;
    onCancelar();
  }

  const titulo =
    efectoDeseado === "grant"  ? "Conceder rbac:gestionar" :
    efectoDeseado === "revoke" ? "Negar rbac:gestionar" :
    "Quitar excepción de rbac:gestionar";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(1,42,107,0.25)", backdropFilter: "blur(2px)" }}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar excepción sobre rbac:gestionar"
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
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>{titulo}</span>
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
                  <code>rbac:gestionar</code> es un permiso administrativo crítico: permite
                  administrar usuarios, roles y permisos de todo el ERP.{" "}
                  {efectoDeseado === "grant" && (
                    <>Esto le concede esa capacidad a <strong>{usuarioNombre}</strong>, sin importar su rol.</>
                  )}
                  {efectoDeseado === "revoke" && (
                    <>Esto le niega esa capacidad a <strong>{usuarioNombre}</strong>, aunque su rol se la otorgue.</>
                  )}
                  {efectoDeseado === null && (
                    <>Esto quita la excepción actual sobre <strong>{usuarioNombre}</strong> — su acceso volverá a depender solo de sus roles.</>
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
