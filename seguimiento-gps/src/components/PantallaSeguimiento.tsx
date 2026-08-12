import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Encabezado } from "./Encabezado";
import { Mapa } from "./Mapa";
import { ListaVehiculos } from "./ListaVehiculos";
import { DetalleVehiculo } from "./DetalleVehiculo";
import { BannerSinConexion } from "./BannerSinConexion";
import type { VehiculoPublico } from "../types";

interface Props {
  vehiculos: VehiculoPublico[];
  cargando: boolean;
  redOk: boolean;
  ultimaActualizacionLocal: Date | null;
}

/**
 * Layout responsive real (no solo CSS oculto/visible): en móvil el mapa
 * ocupa toda la pantalla y una hoja inferior fija (búsqueda + lista o
 * detalle) queda siempre alcanzable con el pulgar; en desktop/tablet ancho
 * el mismo panel se convierte en un costado fijo junto a un mapa amplio —
 * mismo componente de contenido (Lista/Detalle), distinto contenedor.
 */
export function PantallaSeguimiento({ vehiculos, cargando, redOk, ultimaActualizacionLocal }: Props) {
  const [placaSeleccionada, setPlacaSeleccionada] = useState<string | null>(null);

  // Si el vehículo seleccionado deja de estar en la lista (placa ya no
  // autorizada tras una recarga del enlace, caso extremo), limpiar selección.
  useEffect(() => {
    if (placaSeleccionada && !vehiculos.some(v => v.placa === placaSeleccionada)) {
      setPlacaSeleccionada(null);
    }
  }, [vehiculos, placaSeleccionada]);

  const seleccionado = vehiculos.find(v => v.placa === placaSeleccionada) ?? null;

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">

      {/* Mapa — protagonista en todos los tamaños. En columna (móvil) queda
          arriba; en fila (desktop) queda a la izquierda — orden natural del
          DOM, sin necesidad de "order" explícito. */}
      <div className="flex-1 relative min-h-0">
        <Mapa vehiculos={vehiculos} placaSeleccionada={placaSeleccionada} onSeleccionar={setPlacaSeleccionada} />

        {/* Encabezado flotante — no le quita espacio vertical al mapa en móvil */}
        <div className="absolute top-0 inset-x-0 z-[1000]">
          <Encabezado>
            <div className="flex items-center gap-2 shrink-0">
              {cargando && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "rgba(255,255,255,0.8)" }} />}
              <span className="text-[11.5px] font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
                {vehiculos.length} vehículo{vehiculos.length !== 1 ? "s" : ""}
              </span>
            </div>
          </Encabezado>
        </div>
        {!redOk && (
          <div className="absolute top-[52px] inset-x-0 z-[1000]">
            <BannerSinConexion />
          </div>
        )}
      </div>

      {/* Panel — hoja inferior en móvil, costado fijo (derecha) en desktop */}
      <div className="panel-vehiculos hoja-inferior shrink-0 flex flex-col bg-white overflow-hidden safe-bottom md:w-[400px] md:h-full">
        <div className="md:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: "var(--gray-200)" }} />
        </div>

        {ultimaActualizacionLocal && (
          <div className="hidden md:block px-4 pt-3 text-[11px]" style={{ color: "var(--gray-400)" }}>
            Actualizado {formatoHora(ultimaActualizacionLocal)}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {seleccionado ? (
            <div className="h-full overflow-y-auto p-4">
              <DetalleVehiculo vehiculo={seleccionado} onCerrar={() => setPlacaSeleccionada(null)} />
            </div>
          ) : (
            <ListaVehiculos vehiculos={vehiculos} placaSeleccionada={placaSeleccionada} onSeleccionar={setPlacaSeleccionada} />
          )}
        </div>
      </div>
    </div>
  );
}

function formatoHora(d: Date): string {
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}
