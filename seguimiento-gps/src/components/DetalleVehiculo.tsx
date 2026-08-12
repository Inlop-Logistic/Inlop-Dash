import { X, MapPin, Clock, User, Navigation } from "lucide-react";
import { EstadoBadge } from "./EstadoBadge";
import { ContactoAcciones } from "./ContactoAcciones";
import { tieneGpsActivo } from "../vehiculos";
import { gpsRelativo } from "../fecha";
import type { VehiculoPublico } from "../types";

interface Props {
  vehiculo: VehiculoPublico;
  onCerrar: () => void;
}

function Fila({ icono, etiqueta, valor }: { icono: React.ReactNode; etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5" style={{ color: "var(--gray-400)" }}>{icono}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>{etiqueta}</div>
        <div className="text-[13.5px] mt-0.5" style={{ color: "var(--gray-800)" }}>{valor}</div>
      </div>
    </div>
  );
}

export function DetalleVehiculo({ vehiculo, onCerrar }: Props) {
  const activo = tieneGpsActivo(vehiculo);
  const freshness = activo ? gpsRelativo(vehiculo.ultimaActualizacion) : null;

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="font-bold tracking-wider text-[22px]" style={{ fontFamily: "var(--font-mono)", color: "var(--navy)" }}>
            {vehiculo.placa ?? "—"}
          </div>
          <div className="mt-1.5"><EstadoBadge vehiculo={vehiculo} /></div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar detalle"
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--gray-100)", color: "var(--gray-500)" }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {vehiculo.conductor && <Fila icono={<User className="w-4 h-4" />} etiqueta="Conductor" valor={vehiculo.conductor} />}

        {(vehiculo.origen || vehiculo.destino) && (
          <Fila
            icono={<Navigation className="w-4 h-4" />}
            etiqueta="Ruta"
            valor={`${vehiculo.origen ?? "—"} → ${vehiculo.destino ?? "—"}`}
          />
        )}

        {vehiculo.ubicacion && (
          <Fila icono={<MapPin className="w-4 h-4" />} etiqueta="Ubicación" valor={vehiculo.ubicacion} />
        )}

        <Fila
          icono={<Clock className="w-4 h-4" />}
          etiqueta="Última actualización"
          valor={activo ? freshness!.label : "Sin señal GPS por ahora"}
        />
      </div>

      {vehiculo.telefono && (
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--gray-100)" }}>
          <ContactoAcciones telefono={vehiculo.telefono} nombreConductor={vehiculo.conductor} />
        </div>
      )}
    </div>
  );
}
