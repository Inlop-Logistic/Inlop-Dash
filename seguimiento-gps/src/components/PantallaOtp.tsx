import { useState, useRef, type FormEvent } from "react";
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Encabezado } from "./Encabezado";
import { LONGITUD_OTP } from "../constants";

interface Props {
  correo: string;
  validando: boolean;
  error: string | null;
  mensaje: string | null;
  onValidar: (codigo: string) => void;
  onReenviar: () => void;
  onVolver: () => void;
}

export function PantallaOtp({ correo, validando, error, mensaje, onValidar, onReenviar, onVolver }: Props) {
  const [codigo, setCodigo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(valor: string) {
    const limpio = valor.replace(/\D/g, "").slice(0, LONGITUD_OTP);
    setCodigo(limpio);
    if (limpio.length === LONGITUD_OTP && !validando) onValidar(limpio);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (codigo.length === LONGITUD_OTP && !validando) onValidar(codigo);
  }

  return (
    <div className="flex-1 flex flex-col">
      <Encabezado />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 safe-bottom">
        <div className="w-full max-w-sm">

          <button
            type="button"
            onClick={onVolver}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-5"
            style={{ color: "var(--gray-500)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Usar otro correo
          </button>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(1,42,107,0.08)" }}>
              <KeyRound className="w-6 h-6" style={{ color: "var(--navy)" }} />
            </div>
            <h1 className="font-bold text-[19px]" style={{ color: "var(--navy)", fontFamily: "var(--font-display)" }}>
              Ingresa el código
            </h1>
            <p className="text-[13.5px] mt-1.5 leading-relaxed" style={{ color: "var(--gray-500)" }}>
              Si <strong style={{ color: "var(--gray-700)" }}>{correo}</strong> está autorizado, te
              enviamos un código de {LONGITUD_OTP} dígitos. Revisa tu bandeja de entrada.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="••••••"
              value={codigo}
              onChange={e => handleChange(e.target.value)}
              disabled={validando}
              maxLength={LONGITUD_OTP}
              aria-label="Código de verificación"
              className="w-full text-center outline-none disabled:opacity-60"
              style={{
                border: "1.5px solid var(--gray-200)", borderRadius: "var(--radius-xl)",
                padding: "16px", color: "var(--navy)", background: "#fff",
                fontFamily: "var(--font-mono)", fontSize: "28px", fontWeight: 700, letterSpacing: "0.4em",
              }}
            />

            {error && (
              <div className="flex items-start gap-2 text-[13px]" style={{ color: "var(--inlop-red)" }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {!error && mensaje && (
              <div className="flex items-start gap-2 text-[13px]" style={{ color: "var(--success)" }}>
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{mensaje}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={validando || codigo.length !== LONGITUD_OTP}
              className="mt-1 inline-flex items-center justify-center gap-2 font-semibold text-[15px] rounded-xl py-3.5 transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {validando ? "Verificando…" : "Verificar código"}
            </button>
          </form>

          <button
            type="button"
            onClick={onReenviar}
            disabled={validando}
            className="w-full text-center text-[12.5px] font-medium mt-4 py-2 disabled:opacity-60"
            style={{ color: "var(--navy)" }}
          >
            ¿No llegó? Reenviar código
          </button>
        </div>
      </div>
    </div>
  );
}
