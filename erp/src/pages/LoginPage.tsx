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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gray-50)" }}>
      <div className="w-full max-w-[400px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--navy)" }}
          >
            <span className="text-white font-bold text-xl tracking-tight">IN</span>
          </div>
          <h1 className="font-bold text-[20px]" style={{ color: "var(--navy)" }}>
            INLOP ERP
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--gray-400)" }}>
            Sistema interno de operaciones
          </p>
        </div>

        {/* Card */}
        <div
          className="bg-white rounded-2xl p-7"
          style={{ border: "1px solid var(--gray-100)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
        >
          <form onSubmit={submit} className="flex flex-col gap-4">

            {/* Email */}
            <div>
              <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--gray-700)" }}>
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
                  background: "#fff",
                  border: "1.5px solid var(--gray-200)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "var(--gray-800)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--navy)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--gray-200)")}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--gray-700)" }}>
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
                    background: "#fff",
                    border: "1.5px solid var(--gray-200)",
                    borderRadius: 10,
                    padding: "11px 42px 11px 14px",
                    color: "var(--gray-800)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--navy)")}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--gray-200)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: "var(--gray-400)" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: "#FFF1F2", color: "var(--inlop-red)" }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold text-[14px] py-3 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
              style={{ background: "var(--navy)" }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Ingresando…" : "Ingresar"}
            </button>

          </form>
        </div>

        <p className="text-center text-[11px] mt-5" style={{ color: "var(--gray-400)" }}>
          INLOP Logística SAS · Sistema interno
        </p>
      </div>
    </div>
  );
}
