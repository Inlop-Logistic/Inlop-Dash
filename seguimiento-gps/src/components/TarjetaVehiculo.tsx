import { MapPin, Clock } from "lucide-react";
import { EstadoBadge } from "./EstadoBadge";
import { tieneGpsActivo } from "../vehiculos";
import { gpsRelativo } from "../fecha";
import type { VehiculoPublico } from "../types";

interface Props {
  vehiculo: VehiculoPublico;
  seleccionado: boolean;
  onSeleccionar: () => void;
}

export function TarjetaVehiculo({ vehiculo, seleccionado, onSeleccionar }: Props) {
  const activo = tieneGpsActivo(vehiculo);
  const freshness = activo ? gpsRelativo(vehiculo.ultimaActualizacion) : null;
  const ruta = vehiculo.origen && vehiculo.destino ? `${vehiculo.origen} → ${vehiculo.destino}` : null;

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      aria-pressed={seleccionado}
      className="w-full text-left rounded-xl p-3.5 transition-colors"
      style={{
        background: seleccionado ? "rgba(1,42,107,0.06)" : "#fff",
        border: `1.5px solid ${seleccionado ? "var(--navy)" : "var(--gray-100)"}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="font-bold tracking-wider text-[15px] truncate"
            style={{ fontFamily: "var(--font-mono)", color: "var(--navy)" }}
          >
            {vehiculo.placa ?? "—"}
          </div>
          {vehiculo.conductor && (
            <div className="text-[12px] truncate mt-0.5" style={{ color: "var(--gray-500)" }}>
              {vehiculo.conductor}
            </div>
          )}
        </div>
        <EstadoBadge vehiculo={vehiculo} size="sm" />
      </div>

      {ruta && (
        <div className="flex items-center gap-1.5 mt-2.5 text-[12px]" style={{ color: "var(--gray-600)" }}>
          <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
          <span className="truncate">{ruta}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px]" style={{ color: freshness?.color ?? "var(--gray-400)" }}>
        <Clock className="w-3.5 h-3.5 shrink-0" />
        {activo ? freshness!.label : "Sin señal GPS por ahora"}
      </div>
    </button>
  );
}
