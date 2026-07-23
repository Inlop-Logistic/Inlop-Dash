import { gpsRelativo } from "@/utils/parseFecha";
import { Wifi, WifiOff } from "lucide-react";

interface GpsStatusProps {
  /** Formato TMS: MM/DD/YYYY HH:MM:SS. */
  report: string | null | undefined;
  /** Modo compacto: solo el punto de color (para columna de tabla). */
  compact?: boolean;
}

export function GpsStatus({ report, compact = false }: GpsStatusProps) {
  const { label, color, level } = gpsRelativo(report);

  if (compact) {
    return (
      <span
        className="text-[11px] font-mono font-semibold"
        style={{ color }}
        title={label}
      >
        {label}
      </span>
    );
  }

  const Icon = level === "stale" ? WifiOff : Wifi;
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <span className="text-[12px] font-mono" style={{ color }}>{label}</span>
    </div>
  );
}
