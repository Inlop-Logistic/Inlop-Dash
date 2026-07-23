import { Wifi, WifiOff, MapPin, AlertTriangle } from "lucide-react";
import { gpsRelativo } from "@/utils/parseFecha";
import type { GpsRecord } from "../types";

interface GpsStatusCardProps {
  vehiculo: GpsRecord;
}

export function GpsStatusCard({ vehiculo }: GpsStatusCardProps) {
  const { label: gpsLabel, color: gpsColor, level } = gpsRelativo(vehiculo.latest_gps_report);
  const WifiIcon = level === "stale" ? WifiOff : Wifi;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
    >
      {/* Señal GPS */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--gray-500)" }}>
          <WifiIcon className="w-3.5 h-3.5 shrink-0" style={{ color: gpsColor }} />
          Última señal
        </div>
        <span className="text-[12px] font-mono font-semibold" style={{ color: gpsColor }}>
          {gpsLabel}
        </span>
      </div>

      {/* Posición */}
      {vehiculo.current_address_location && (
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--gray-400)" }} />
          <span className="text-[11px] leading-snug" style={{ color: "var(--gray-600)" }}>
            {vehiculo.current_address_location}
          </span>
        </div>
      )}

      {/* Alarma activa */}
      {vehiculo.last_alarm_name && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
          style={{ background: "#FEE2E2", color: "#9F1239" }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {vehiculo.last_alarm_name}
        </div>
      )}
    </div>
  );
}
