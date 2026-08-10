/**
 * Pantalla de marcador de posición para las etapas del configurador
 * que aún no han sido implementadas (02-06).
 *
 * Al desarrollar una etapa, reemplazar este componente por el definitivo
 * sin modificar el enrutamiento del ConfiguradorReporte.
 */
import { Hourglass } from "lucide-react";

interface Props {
  numero:      number;
  titulo:      string;
  descripcion: string;
}

export function EtapaPlaceholder({ numero, titulo, descripcion }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4 py-16"
      style={{ color: "var(--gray-400)" }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "var(--gray-100)" }}
      >
        <Hourglass className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
      </div>

      <div className="flex flex-col items-center gap-1 text-center" style={{ maxWidth: "320px" }}>
        <p className="font-semibold text-[14px]" style={{ color: "var(--navy)" }}>
          Etapa {String(numero).padStart(2, "0")} — {titulo}
        </p>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--gray-500)" }}>
          {descripcion}
        </p>
        <p
          className="text-[11px] mt-3 px-2.5 py-1 rounded-full font-semibold"
          style={{ background: "var(--gray-100)", color: "var(--gray-400)", letterSpacing: "0.03em" }}
        >
          Próximamente
        </p>
      </div>
    </div>
  );
}
