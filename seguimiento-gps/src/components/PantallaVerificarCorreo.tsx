import { useState, type FormEvent } from "react";
import { Mail, ShieldCheck, AlertCircle, Truck } from "lucide-react";
import { Encabezado } from "./Encabezado";

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  totalVehiculos: number;
  enviando: boolean;
  error: string | null;
  onEnviar: (correo: string) => void;
}

export function PantallaVerificarCorreo({ totalVehiculos, enviando, error, onEnviar }: Props) {
  const [correo, setCorreo] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const limpio = correo.trim();
    if (!RE_CORREO.test(limpio)) {
      setErrorLocal("Ingresa un correo válido.");
      return;
    }
    setErrorLocal(null);
    onEnviar(limpio);
  }

  return (
    <div className="flex-1 flex flex-col">
      <Encabezado />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 safe-bottom">
        <div className="w-full max-w-sm">

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(1,42,107,0.08)" }}>
              <ShieldCheck className="w-6 h-6" style={{ color: "var(--navy)" }} />
            </div>
            <h1 className="font-bold text-[19px]" style={{ color: "var(--navy)", fontFamily: "var(--font-display)" }}>
              Verifica tu correo
            </h1>
            <p className="text-[13.5px] mt-1.5 leading-relaxed" style={{ color: "var(--gray-500)" }}>
              Ingresa el correo al que te enviaron este enlace para ver el
              seguimiento{totalVehiculos > 0 && (
                <> de {totalVehiculos === 1 ? "tu vehículo" : `tus ${totalVehiculos} vehículos`}</>
              )}. Según el correo, es posible que te pidamos un código de
              verificación adicional.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-400)" }} />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="tu@correo.com"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                disabled={enviando}
                className="w-full text-[15px] outline-none disabled:opacity-60"
                style={{
                  border: "1.5px solid var(--gray-200)", borderRadius: "var(--radius-xl)",
                  padding: "14px 16px 14px 42px", color: "var(--gray-800)", background: "#fff",
                }}
              />
            </div>

            {(errorLocal || error) && (
              <div className="flex items-start gap-2 text-[13px]" style={{ color: "var(--inlop-red)" }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorLocal ?? error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="mt-1 inline-flex items-center justify-center gap-2 font-semibold text-[15px] rounded-xl py-3.5 transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {enviando ? "Verificando…" : "Continuar"}
            </button>
          </form>

          <div
            className="flex items-center gap-2.5 mt-6 px-3.5 py-3 rounded-xl text-[12px]"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)", color: "var(--gray-500)" }}
          >
            <Truck className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
            Solo el destinatario autorizado de este envío puede ver el seguimiento.
          </div>
        </div>
      </div>
    </div>
  );
}
