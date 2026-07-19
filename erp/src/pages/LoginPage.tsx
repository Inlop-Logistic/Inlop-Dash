import { useState } from "react";
import { useAuth } from "@/state/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// ── Red logística decorativa ───────────────────────────────────────────────
// SVG sutil que representa nodos y rutas logísticas.
// Posicionado absolutamente detrás del contenido del panel de branding.
function LogisticsNetwork() {
  return (
    <svg
      viewBox="0 0 400 700"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity: 0.09 }}
      aria-hidden="true"
    >
      {/* Rutas / conexiones */}
      <line x1="40"  y1="100" x2="190" y2="65"  stroke="white" strokeWidth="1.2" />
      <line x1="190" y1="65"  x2="330" y2="125" stroke="white" strokeWidth="1.2" />
      <line x1="40"  y1="100" x2="105" y2="230" stroke="white" strokeWidth="1.2" />
      <line x1="190" y1="65"  x2="260" y2="215" stroke="white" strokeWidth="1.2" />
      <line x1="330" y1="125" x2="370" y2="245" stroke="white" strokeWidth="1.2" />
      <line x1="105" y1="230" x2="260" y2="215" stroke="white" strokeWidth="1.2" />
      <line x1="260" y1="215" x2="370" y2="245" stroke="white" strokeWidth="1.2" />
      <line x1="105" y1="230" x2="55"  y2="370" stroke="white" strokeWidth="1.2" />
      <line x1="260" y1="215" x2="200" y2="360" stroke="white" strokeWidth="1.2" />
      <line x1="370" y1="245" x2="345" y2="375" stroke="white" strokeWidth="1.2" />
      <line x1="55"  y1="370" x2="200" y2="360" stroke="white" strokeWidth="1.2" />
      <line x1="200" y1="360" x2="345" y2="375" stroke="white" strokeWidth="1.2" />
      <line x1="55"  y1="370" x2="115" y2="490" stroke="white" strokeWidth="1.2" />
      <line x1="200" y1="360" x2="195" y2="492" stroke="white" strokeWidth="1.2" />
      <line x1="345" y1="375" x2="295" y2="488" stroke="white" strokeWidth="1.2" />
      <line x1="115" y1="490" x2="195" y2="492" stroke="white" strokeWidth="1.2" />
      <line x1="195" y1="492" x2="295" y2="488" stroke="white" strokeWidth="1.2" />
      <line x1="115" y1="490" x2="65"  y2="610" stroke="white" strokeWidth="1.2" />
      <line x1="195" y1="492" x2="195" y2="618" stroke="white" strokeWidth="1.2" />
      <line x1="295" y1="488" x2="355" y2="602" stroke="white" strokeWidth="1.2" />
      <line x1="65"  y1="610" x2="195" y2="618" stroke="white" strokeWidth="1.2" />
      <line x1="195" y1="618" x2="355" y2="602" stroke="white" strokeWidth="1.2" />

      {/* Nodos secundarios */}
      <circle cx="40"  cy="100" r="3.5" fill="white" />
      <circle cx="190" cy="65"  r="3.5" fill="white" />
      <circle cx="330" cy="125" r="3.5" fill="white" />
      <circle cx="105" cy="230" r="3.5" fill="white" />
      <circle cx="370" cy="245" r="3.5" fill="white" />
      <circle cx="55"  cy="370" r="3.5" fill="white" />
      <circle cx="345" cy="375" r="3.5" fill="white" />
      <circle cx="115" cy="490" r="3.5" fill="white" />
      <circle cx="295" cy="488" r="3.5" fill="white" />
      <circle cx="65"  cy="610" r="3.5" fill="white" />
      <circle cx="355" cy="602" r="3.5" fill="white" />
      <circle cx="195" cy="618" r="3.5" fill="white" />

      {/* Nodos hub — mayor peso visual */}
      <circle cx="260" cy="215" r="4.5" fill="white" />
      <circle cx="260" cy="215" r="9"   fill="none" stroke="white" strokeWidth="1" />

      <circle cx="200" cy="360" r="5"   fill="white" />
      <circle cx="200" cy="360" r="11"  fill="none" stroke="white" strokeWidth="1" />

      <circle cx="195" cy="492" r="4"   fill="white" />
      <circle cx="195" cy="492" r="8.5" fill="none" stroke="white" strokeWidth="0.8" />
    </svg>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export function LoginPage() {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const clearError = () => { if (error) setError(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch {
      setError("credentials");
    } finally {
      setLoading(false);
    }
  };

  // Estilos compartidos de input
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
    e.currentTarget.style.background   = "#fff";
    e.currentTarget.style.borderColor  = "var(--navy)";
    e.currentTarget.style.boxShadow    = "0 0 0 3px rgba(1,42,107,0.08)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.background   = "var(--gray-50)";
    e.currentTarget.style.borderColor  = "var(--gray-200)";
    e.currentTarget.style.boxShadow    = "none";
  };

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ════════════════════════════════════════════════════════
          PANEL IZQUIERDO — Branding  (solo desktop ≥ 1024px)
          ════════════════════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex flex-col shrink-0 relative overflow-hidden"
        style={{ width: "40%", background: "var(--navy)" }}
      >
        {/* Recurso gráfico: red logística decorativa */}
        <LogisticsNetwork />

        <div className="relative z-10 flex flex-col h-full px-10 py-10">

          {/* ── Logo ────────────────────────────────────────────
              Estructura preparada para isotipo SVG oficial.
              Reemplazar el bloque interior por:
                <img src="/isotipo.svg" alt="INLOP" className="w-10 h-10" />
              cuando el asset esté disponible.
          ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 shrink-0 flex items-center justify-center"
              style={{ borderRadius: "var(--radius-xl)" }}
              aria-label="INLOP"
            >
              {/* Isotipo temporal — reemplazar por SVG oficial */}
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: "var(--inlop-red)", borderRadius: "var(--radius-xl)" }}
              >
                <span className="text-white font-bold text-[13px] tracking-tight select-none">IN</span>
              </div>
            </div>
            <div>
              <p className="font-bold text-white leading-tight" style={{ fontSize: "var(--text-lg)" }}>
                INLOP ERP
              </p>
              <p className="whitespace-nowrap leading-tight" style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
                Plataforma Empresarial Integrada
              </p>
            </div>
          </div>

          {/* ── Tagline central ─────────────────────────────── */}
          <div className="flex-1 flex flex-col justify-center">
            <p
              style={{
                fontFamily:  "var(--font-display)",
                fontSize:    30,
                fontWeight:  300,
                lineHeight:  1.2,
                color:       "rgba(255,255,255,0.92)",
                marginBottom: "var(--space-4)",
              }}
            >
              Plataforma<br />
              <span style={{ fontWeight: 700 }}>Empresarial Integrada</span>
            </p>

            {/* Separador de acento */}
            <div style={{ width: 32, height: 2, background: "var(--inlop-red)", marginBottom: "var(--space-5)" }} />

            <p
              style={{
                fontSize:   "var(--text-md)",
                color:      "rgba(255,255,255,0.45)",
                lineHeight: "var(--leading-relaxed)",
                maxWidth:   280,
              }}
            >
              Centraliza, integra y optimiza los procesos estratégicos de INLOP desde una única plataforma.
            </p>
          </div>

          {/* ── Footer del panel ────────────────────────────── */}
          <div>
            <p className="font-semibold" style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.4)" }}>
              INLOP ERP v1.0
            </p>
            <p className="mt-0.5" style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.22)" }}>
              © INLOP Logística SAS
            </p>
          </div>

        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════
          PANEL DERECHO — Formulario
          ════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-white min-w-0">

        {/* ── Header compacto tablet + móvil (< 1024px) ──── */}
        <div
          className="lg:hidden flex items-center gap-3 px-8 py-5 shrink-0"
          style={{ background: "var(--navy)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Isotipo compacto */}
          <div
            className="w-9 h-9 flex items-center justify-center shrink-0"
            style={{ background: "var(--inlop-red)", borderRadius: "var(--radius-xl)" }}
            aria-label="INLOP"
          >
            <span className="text-white font-bold text-[12px] tracking-tight select-none">IN</span>
          </div>
          <div>
            <p className="font-bold text-white leading-tight" style={{ fontSize: "var(--text-lg)" }}>
              INLOP ERP
            </p>
            <p className="whitespace-nowrap leading-tight" style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
              Plataforma Empresarial Integrada
            </p>
          </div>
        </div>

        {/* ── Área del formulario ─────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full" style={{ maxWidth: 420 }}>

            {/* Heading */}
            <h1
              style={{
                fontFamily:    "var(--font-display)",
                fontSize:      "var(--text-4xl)",
                fontWeight:    700,
                color:         "var(--navy)",
                lineHeight:    "var(--leading-none)",
                letterSpacing: "-0.5px",
                marginBottom:  "var(--space-2)",
              }}
            >
              Bienvenido
            </h1>
            <p
              style={{
                fontSize:     "var(--text-lg)",
                color:        "var(--gray-400)",
                lineHeight:   "var(--leading-normal)",
                marginBottom: "var(--space-8)",
              }}
            >
              Accede a tu Plataforma Empresarial Integrada.
            </p>

            {/* Formulario */}
            <form onSubmit={submit} className="flex flex-col" style={{ gap: "var(--space-4)" }}>

              {/* Email */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block uppercase tracking-widest"
                  style={{
                    fontSize:     "var(--text-xs)",
                    fontWeight:   "var(--weight-semibold)",
                    color:        "var(--gray-500)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Correo electrónico
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  placeholder="usuario@inlop.com.co"
                  required
                  disabled={loading}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  style={{ ...inputBase, padding: "11px 16px" }}
                />
              </div>

              {/* Contraseña */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block uppercase tracking-widest"
                  style={{
                    fontSize:     "var(--text-xs)",
                    fontWeight:   "var(--weight-semibold)",
                    color:        "var(--gray-500)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    placeholder="••••••••"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded transition-colors"
                    style={{ color: "var(--gray-400)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gray-100)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {showPw
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye    className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 px-4 py-3"
                  style={{
                    background:   "var(--danger-bg)",
                    border:       "1px solid var(--danger-light)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span style={{ color: "var(--danger)", fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>⚠</span>
                  <div>
                    <p className="font-semibold" style={{ fontSize: "var(--text-base)", color: "var(--danger)" }}>
                      Correo o contraseña incorrectos.
                    </p>
                    <p style={{ fontSize: "var(--text-base)", color: "var(--danger)", opacity: 0.8 }}>
                      Verifica tus datos e intenta de nuevo.
                    </p>
                  </div>
                </div>
              )}

              {/* Botón de envío */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 font-semibold transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  fontSize:     "var(--text-lg)",
                  fontWeight:   "var(--weight-semibold)",
                  color:        "#fff",
                  background:   "var(--inlop-red)",
                  borderRadius: "var(--radius-md)",
                  padding:      "13px 24px",
                  marginTop:    "var(--space-2)",
                  boxShadow:    "0 4px 16px rgba(227,6,19,0.25)",
                }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Ingresando…" : "Ingresar"}
              </button>

            </form>
          </div>
        </div>

        {/* ── Footer del panel derecho ────────────────────── */}
        <div className="shrink-0 flex flex-col items-center pb-8" style={{ gap: "var(--space-px)" }}>
          <p className="font-semibold" style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)" }}>
            INLOP ERP v1.0
          </p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--gray-300)" }}>
            © INLOP Logística SAS
          </p>
        </div>

      </div>
    </div>
  );
}
