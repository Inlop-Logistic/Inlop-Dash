/**
 * ModalConfirmarPermisoGestionar — confirmación reforzada antes de agregar o
 * quitar `rbac:gestionar` de un rol (Sprint 3D-7.5). Ese permiso es el que
 * habilita administrar RBAC (usuarios, roles, permisos) — el backend ya
 * exige esMaster real para tocarlo (PUT /api/roles/:id/permisos, Sprint
 * 3D-7.3); esta capa es solo UX, un freno adicional antes de confirmar una
 * acción de alto impacto.
 *
 * Mismo patrón visual/estructural que ModalConfirmarCambioMaster.tsx
 * (Sprint 3D-7.4), que a su vez sigue a ModalEliminarReporte.tsx — overlay +
 * diálogo, estados confirmar → guardando → error, sin componente ni
 * librería nueva. El request en sí lo dispara el hook
 * (useRolesPermisos#ejecutarGuardadoPermisos) — este componente solo
 * confirma y refleja `guardando`/`error` recibidos por props.
 */
import { ShieldAlert, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  rolNombre: string;
  /** true = la selección agrega rbac:gestionar; false = lo quita. */
  agregando: boolean;
  guardando: boolean;
  error: string | null;
  onConfirmar: () => void;
  onCancelar:  () => void;
}

export function ModalConfirmarPermisoGestionar({
  rolNombre, agregando, guardando, error, onConfirmar, onCancelar,
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
        aria-label="Confirmar cambio de rbac:gestionar"
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
              {agregando ? "Agregar rbac:gestionar" : "Quitar rbac:gestionar"}
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
                  <code>rbac:gestionar</code> es un permiso administrativo crítico: permite
                  administrar usuarios, roles y permisos de todo el ERP.{" "}
                  {agregando ? (
                    <>Cualquier usuario con el rol <strong>{rolNombre}</strong> podrá gestionar RBAC.</>
                  ) : (
                    <>Los usuarios con el rol <strong>{rolNombre}</strong> perderán esa capacidad.</>
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
