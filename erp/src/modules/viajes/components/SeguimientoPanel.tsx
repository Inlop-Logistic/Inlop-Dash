import { MapPin, Wifi, Clock, Navigation } from "lucide-react";
import { PanelSection, InfoRow } from "@/components/ui";
import { fmtTms, gpsRelativo } from "@/utils/parseFecha";
import type { TmsViaje } from "../types";
import { GpsStatus } from "./GpsStatus";

function tiempoSinReporte(str: string | null | undefined): string {
  const { label } = gpsRelativo(str);
  return label;
}

export function SeguimientoPanel({ viaje }: { viaje: TmsViaje }) {
  const tienePos = viaje.latitude && viaje.longitude;

  return (
    <PanelSection title="Seguimiento" icon={<Navigation className="w-3.5 h-3.5" />}>
      {/* Estado GPS */}
      <div className="mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--gray-400)" }}>
          Estado GPS
        </div>
        <GpsStatus report={viaje.latest_gps_report} />
      </div>

      <InfoRow label="Última comunicación" value={fmtTms(viaje.latest_gps_report, "MDY", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      })} />
      <InfoRow
        label="Tiempo sin reporte"
        value={
          <span className="font-mono text-[12px]" style={{ color: gpsRelativo(viaje.latest_gps_report).color }}>
            {tiempoSinReporte(viaje.latest_gps_report)}
          </span>
        }
      />

      {/* Última posición */}
      {viaje.current_address_location && (
        <div
          className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--gray-400)" }} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--gray-400)" }}>
              Última posición conocida
            </div>
            <p className="text-[12px] leading-snug" style={{ color: "var(--gray-700)" }}>
              {viaje.current_address_location}
            </p>
          </div>
        </div>
      )}

      {/* Coordenadas */}
      {tienePos && (
        <div
          className="mt-2 flex items-center gap-3 px-3 py-2 rounded-xl"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
        >
          <Wifi className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-300)" }} />
          <code className="text-[11px] font-mono" style={{ color: "var(--gray-500)" }}>
            {Number(viaje.latitude).toFixed(5)}, {Number(viaje.longitude).toFixed(5)}
          </code>
        </div>
      )}

      {!tienePos && !viaje.current_address_location && (
        <div
          className="mt-3 flex items-center gap-2 text-[12px] px-3 py-2.5 rounded-xl"
          style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Sin posición registrada actualmente
        </div>
      )}

      {/* Velocidad — placeholder hasta que la API lo entregue */}
      <div
        className="mt-3 text-[11px] px-3 py-2 rounded-xl"
        style={{ background: "var(--gray-50)", color: "var(--gray-400)", border: "1px solid var(--gray-100)" }}
      >
        Velocidad y telemetría extendida disponibles próximamente
      </div>
    </PanelSection>
  );
}
