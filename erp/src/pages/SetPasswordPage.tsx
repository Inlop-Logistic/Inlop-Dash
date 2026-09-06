/**
 * SetPasswordPage — formulario de nueva contraseña (Sprint 3D-7.8D).
 *
 * Se muestra cuando AuthContext detecta una sesión de recuperación
 * (evento PASSWORD_RECOVERY de Supabase, disparado al llegar desde el
 * enlace de /invite de un usuario nuevo o de /recover de un reset
 * administrado — ver POST /api/usuarios y POST /api/usuarios/:id/reset-password
 * en el backend). Llama a `supabase.auth.updateUser({ password })`
 * (mismo método que ya usa js/reset-password.js en el sistema legacy) y
 * luego cierra la sesión temporal para volver al login normal.
 *
 * Mismos tokens/estilo de input que LoginPage.tsx, en un layout más simple
 * (tarjeta centrada) — esta página es nueva, no un rediseño de una pantalla
 * existente.
 */
import { useState } from "react";
import { Eye, EyeOff, Loader2, Check, KeyRound } from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/state/AuthContext";

const REQUISITOS = "Mínimo 8 caracteres, con al menos una mayúscula y un número.";

function validarPassword(password: string, confirmar: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos una mayúscula y un número.";
  }
  if (password !== confirmar) return "Las contraseñas no coinciden.";
  return null;
}

export function SetPasswordPage() {
  const { completarRecovery } = useAuth();
  const [password,  setPassword]  = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [exito,     setExito]     = useState(false);

  const clearError = () => { if (error) setError(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mensajeValidacion = validarPassword(password, confirmar);
    if (mensajeValidacion) { setError(mensajeValidacion); return; }

    setError(null);
    setLoading(true);
    try {
      const { error: updError } = await supabase.auth.updateUser({ password });
      if (updError) throw new Error(updError.message);
      setExito(true);
      // Breve confirmación visible antes de volver al login normal.
      setTimeout(() => { void completarRecovery(); }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la contraseña.");
      setLoading(false);
    }
  }

  const inputBase: React.CSSProperties = {
    fontSize:     "var(--text-lg)",
    color:        "var(--gray-700)",
    background:   "var(--gray-50)",
    border:       "1.5px solid var(--gray-200)",
    borderRadius: "var(--radius-md)",
    width:        "100%",
    outline:      "none",
    transition:   "border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast)",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.background  = "#fff";
    e.currentTarget.style.borderColor = "var(--navy)";
    e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(1,42,107,0.08)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.background  = "var(--gray-50)";
    e.currentTarget.style.borderColor = "var(--gray-200)";
    e.currentTarget.style.boxShadow   = "none";
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-6" style={{ background: "var(--gray-50)" }}>
      <div
        className="w-full bg-white"
        style={{ maxWidth: 420, borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)", padding: "40px 36px" }}
      >
        <div
          className="w-10 h-10 flex items-center justify-center mb-5"
          style={{ background: "var(--navy)", borderRadius: "var(--radius-xl)" }}
        >
          <KeyRound className="w-5 h-5 text-white" />
        </div>

        <h1
          style={{
            fontFamily:    "var(--font-display)",
            fontSize:      "var(--text-3xl)",
            fontWeight:    700,
            color:         "var(--navy)",
            lineHeight:    "var(--leading-tight)",
            marginBottom:  "var(--space-2)",
          }}
        >
          Establece tu contraseña
        </h1>
        <p style={{ fontSize: "var(--text-md)", color: "var(--gray-400)", marginBottom: "var(--space-6)" }}>
          {exito ? "Contraseña actualizada correctamente." : REQUISITOS}
        </p>

        {!exito ? (
          <form onSubmit={submit} className="flex flex-col" style={{ gap: "var(--space-4)" }}>
            <div>
              <label
                htmlFor="set-password-pwd"
                className="block uppercase tracking-widest"
                style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--gray-500)", marginBottom: "var(--space-1)" }}
              >
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="set-password-pwd"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  required
                  disabled={loading}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  style={{ ...inputBase, padding: "11px 44px 11px 16px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded"
                  style={{ color: "var(--gray-400)" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="set-password-confirm"
                className="block uppercase tracking-widest"
                style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--gray-500)", marginBottom: "var(--space-1)" }}
              >
                Confirmar contraseña
              </label>
              <input
                id="set-password-confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirmar}
                required
                disabled={loading}
                onChange={(e) => { setConfirmar(e.target.value); clearError(); }}
                onFocus={onFocus}
                onBlur={onBlur}
                style={{ ...inputBase, padding: "11px 16px" }}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 px-4 py-3"
                style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-light)", borderRadius: "var(--radius-md)" }}
              >
                <span style={{ color: "var(--danger)", fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>⚠</span>
                <p style={{ fontSize: "var(--text-base)", color: "var(--danger)" }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 font-semibold transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                fontSize:     "var(--text-lg)",
                fontWeight:   "var(--weight-semibold)",
                color:        "#fff",
                background:   "var(--navy)",
                borderRadius: "var(--radius-md)",
                padding:      "13px 24px",
                marginTop:    "var(--space-2)",
              }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2.5" style={{ color: "#065F46" }}>
            <Check className="w-5 h-5 shrink-0" />
            <p style={{ fontSize: "var(--text-md)" }}>Redirigiendo al inicio de sesión…</p>
          </div>
        )}
      </div>
    </div>
  );
}
