import type { ReactNode } from "react";

interface Props {
  icono: ReactNode;
  titulo: string;
  cuerpo: string;
  acento?: "navy" | "danger" | "neutral";
  accion?: { etiqueta: string; onClick: () => void; cargando?: boolean };
}

const ACENTOS = {
  navy:    { bg: "rgba(1,42,107,0.08)",  color: "var(--navy)" },
  danger:  { bg: "var(--danger-bg)",      color: "var(--inlop-red)" },
  neutral: { bg: "var(--gray-100)",       color: "var(--gray-500)" },
} as const;

/**
 * Pantalla completa de un solo mensaje — reutilizada para todos los estados
 * "no hay nada más que ver aquí todavía" del flujo: enlace no disponible/
 * expirado/revocado (nunca un 404 crudo), sin conexión al validar, y sesión
 * expirada. Mismo look & feel INLOP en los tres casos, mensaje distinto.
 */
export function PantallaMensaje({ icono, titulo, cuerpo, acento = "navy", accion }: Props) {
  const paleta = ACENTOS[acento];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center safe-top safe-bottom">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: paleta.bg, color: paleta.color }}
      >
        {icono}
      </div>
      <h1 className="font-bold text-[19px] mb-2" style={{ color: "var(--navy)", fontFamily: "var(--font-display)" }}>
        {titulo}
      </h1>
      <p className="text-[14px] leading-relaxed max-w-sm" style={{ color: "var(--gray-500)" }}>
        {cuerpo}
      </p>
      {accion && (
        <button
          type="button"
          onClick={accion.onClick}
          disabled={accion.cargando}
          className="mt-6 inline-flex items-center justify-center gap-2 font-semibold text-[14px] rounded-xl px-6 py-3 transition-opacity disabled:opacity-60"
          style={{ background: "var(--navy)", color: "#fff" }}
        >
          {accion.cargando ? "Un momento…" : accion.etiqueta}
        </button>
      )}
    </div>
  );
}
