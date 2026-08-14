import { Satellite } from "lucide-react";

/** Carga inicial (validando el enlace) — sin datos todavía, así que no hay
 *  nada real que mostrar como skeleton: un estado de marca simple y rápido
 *  es mejor que un esqueleto de contenido que no existe aún. */
export function PantallaCargando() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: "var(--navy)" }}>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse"
        style={{ background: "rgba(255,255,255,0.14)" }}
      >
        <Satellite className="w-6 h-6" style={{ color: "#fff" }} />
      </div>
      <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.75)" }}>
        Verificando tu enlace…
      </p>
    </div>
  );
}
