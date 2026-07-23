import { ESTADO_GPS_CFG } from "../constants";
import type { EstadoGps } from "../types";

interface EstadoGpsBadgeProps {
  estado: EstadoGps;
  size?: "sm" | "md";
}

export function EstadoGpsBadge({ estado, size = "md" }: EstadoGpsBadgeProps) {
  const cfg = ESTADO_GPS_CFG[estado];
  const px  = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const fs  = size === "sm" ? "text-[10px]" : "text-[var(--text-sm)]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold ${fs} ${px} rounded-full`}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}
