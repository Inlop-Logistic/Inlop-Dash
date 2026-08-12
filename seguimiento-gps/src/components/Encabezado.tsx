import { Satellite } from "lucide-react";
import { NOMBRE_APP } from "../constants";

interface Props {
  children?: React.ReactNode; // acciones a la derecha (ej. contador de vehículos)
}

/** Header de marca — deliberadamente distinto del PageHeader del ERP: esta
 *  app es un producto independiente de seguimiento, no una pantalla admin. */
export function Encabezado({ children }: Props) {
  return (
    <header
      className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 safe-top"
      style={{ background: "var(--navy)", color: "#fff" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.14)" }}
        >
          <Satellite className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-[14px] leading-none" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.01em" }}>
            INLOP
          </div>
          <div className="text-[11px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.72)" }}>
            {NOMBRE_APP}
          </div>
        </div>
      </div>
      {children}
    </header>
  );
}
