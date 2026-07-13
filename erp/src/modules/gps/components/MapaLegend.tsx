import { ESTADO_GPS_CFG } from "../constants";
import type { EstadoGps } from "../types";

const LEGEND_ENTRIES: { estado: EstadoGps }[] = [
  { estado: "activo"       },
  { estado: "detenido"     },
  { estado: "con_alarma"   },
  { estado: "panico"       },
  { estado: "desconectado" },
];

export function MapaLegend() {
  return (
    <div
      className="flex flex-col gap-1.5 p-2.5 rounded-xl text-[11px]"
      style={{
        background: "rgba(255,255,255,0.95)",
        border: "1px solid var(--gray-200)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div className="font-semibold text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--gray-400)" }}>
        Estado
      </div>
      {LEGEND_ENTRIES.map(({ estado }) => {
        const cfg = ESTADO_GPS_CFG[estado];
        return (
          <div key={estado} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: cfg.mapColor }}
            />
            <span style={{ color: "var(--gray-700)" }}>{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}
