import { useState } from "react";
import { useAuth } from "@/state/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex-1 flex"
      style={{ background: "var(--navy-dark)" }}
    >
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 w-[420px] shrink-0"
        style={{ background: "var(--navy)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--inlop-red)" }}
          >
            <span className="text-white font-bold text-sm tracking-tight">IN</span>
          </div>
          <span className="text-white font-bold text-[15px] tracking-wide">INLOP ERP</span>
        </div>

        <div>
          <p className="text-[28px] font-light leading-snug" style={{ color: "rgba(255,255,255,0.9)" }}>
            Plataforma<br />
            <span className="font-bold">Empresarial Integrada</span>
          </p>
          <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Centraliza, integra y optimiza los procesos estratégicos de INLOP desde una única plataforma.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>INLOP ERP</p>
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Plataforma Empresarial Integrada</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--inlop-red)" }}
            >
              <span className="text-white font-bold text-sm">IN</span>
            </div>
            <span className="text-white font-bold text-[15px]">INLOP ERP</span>
          </div>

          <h2 className="font-bold text-[22px] mb-1" style={{ color: "#fff" }}>
            Iniciar sesión
          </h2>
          <p className="text-[13px] mb-7" style={{ color: "rgba(255,255,255,0.45)" }}>
            Accede con tu cuenta institucional
          </p>

          <form onSubmit={submit} className="flex flex-col gap-4">

            {/* Email */}
            <div>
              <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@inlop.com.co"
                required
                className="w-full text-[14px] outline-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "#fff",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full text-[14px] outline-none transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "11px 42px 11px 14px",
                    color: "#fff",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)")}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: "rgba(227,6,19,0.15)", color: "#FF6B75", border: "1px solid rgba(227,6,19,0.3)" }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold text-[14px] py-3 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              style={{ background: "var(--inlop-red)", boxShadow: "0 4px 16px rgba(227,6,19,0.3)" }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Ingresando…" : "Ingresar"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
