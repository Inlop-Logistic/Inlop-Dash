/**
 * ModalCrearUsuario — crea un usuario ERP (Sprint 3D-7.8D).
 *
 * El backend invita al usuario por correo (Supabase Auth /invite) — este
 * modal NUNCA pide ni envía una contraseña; el usuario establece la suya
 * propia desde el enlace de invitación. Mismo patrón visual/estructural que
 * ModalEliminarReporte.tsx (overlay, header/body/footer, estados
 * confirmar → guardando → error), sin componente ni librería nueva.
 */
import { UserPlus, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  nombre: string;
  email:  string;
  onNombreChange: (v: string) => void;
  onEmailChange:  (v: string) => void;
  creando: boolean;
  error:   string | null;
  onCrear:   () => void;
  onCancelar: () => void;
}

const INPUT_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: 10,
  padding:      "8px 12px",
  color:        "var(--gray-700)",
  background:   "#fff",
  width:        "100%",
};

export function ModalCrearUsuario({
  nombre, email, onNombreChange, onEmailChange, creando, error, onCrear, onCancelar,
}: Props) {
  function handleClose() {
    if (creando) return;
    onCancelar();
  }

  const puedeCrear = nombre.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(1,42,107,0.25)", backdropFilter: "blur(2px)" }}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo usuario"
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
            <UserPlus className="w-4 h-4" style={{ color: "var(--navy)" }} />
            <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>
              Nuevo usuario
            </span>
          </div>
          {!creando && (
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
          {!creando && (
            <div className="flex flex-col gap-4">
              <p className="text-[12.5px]" style={{ color: "var(--gray-500)" }}>
                El usuario recibirá un correo de invitación para establecer su propia contraseña.
                No se le asigna ninguna aquí.
              </p>

              <div>
                <label htmlFor="crear-usuario-nombre" className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--gray-500)" }}>
                  Nombre
                </label>
                <input
                  id="crear-usuario-nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => onNombreChange(e.target.value)}
                  placeholder="Nombre completo"
                  className="text-[13px] outline-none"
                  style={INPUT_STYLE}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="crear-usuario-email" className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--gray-500)" }}>
                  Email
                </label>
                <input
                  id="crear-usuario-email"
                  type="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="usuario@inlop.com.co"
                  className="text-[13px] outline-none"
                  style={INPUT_STYLE}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
                  <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
                </div>
              )}
            </div>
          )}

          {creando && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
              <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>Creando usuario…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--gray-100)" }}
        >
          {!creando && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                size="sm"
                icon={<UserPlus className="w-3.5 h-3.5" />}
                disabled={!puedeCrear}
                onClick={onCrear}
              >
                {error ? "Reintentar" : "Crear usuario"}
              </Button>
            </>
          )}
          {creando && (
            <Button size="sm" loading disabled>
              Creando…
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
