import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ESTADO_GPS_CFG } from "../constants";
import type { EstadoGps } from "../types";

export function MapaLegend() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      style={{
        background:    "rgba(255,255,255,0.96)",
        border:        "1px solid var(--gray-200)",
        borderRadius:  12,
        boxShadow:     "0 2px 8px rgba(0,0,0,0.10)",
        backdropFilter:"blur(4px)",
        minWidth:      120,
        overflow:      "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between w-full px-2.5 py-1.5"
        style={{ cursor: "pointer" }}
        aria-expanded={expanded}
        aria-label={expanded ? "Ocultar leyenda" : "Mostrar leyenda"}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray-500)" }}>
          Leyenda
        </span>
        {expanded
          ? <ChevronDown className="w-3 h-3" style={{ color: "var(--gray-400)" }} />
          : <ChevronUp   className="w-3 h-3" style={{ color: "var(--gray-400)" }} />
        }
      </button>

      {expanded && (
        <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
          {(Object.keys(ESTADO_GPS_CFG) as EstadoGps[]).map((estado) => {
            const cfg = ESTADO_GPS_CFG[estado];
            return (
              <div key={estado} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.mapColor }} />
                <span className="text-[11px]" style={{ color: "var(--gray-700)" }}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
