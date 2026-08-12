import { useMemo, useState } from "react";
import { Search, Truck, SearchX } from "lucide-react";
import { TarjetaVehiculo } from "./TarjetaVehiculo";
import { filtrarPorPlaca, ordenarVehiculos } from "../vehiculos";
import type { VehiculoPublico } from "../types";

interface Props {
  vehiculos: VehiculoPublico[];
  placaSeleccionada: string | null;
  onSeleccionar: (placa: string) => void;
}

export function ListaVehiculos({ vehiculos, placaSeleccionada, onSeleccionar }: Props) {
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(
    () => ordenarVehiculos(filtrarPorPlaca(vehiculos, busqueda)),
    [vehiculos, busqueda],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {vehiculos.length > 0 && (
        <div className="shrink-0 px-3.5 pt-3.5 pb-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-400)" }} />
            <input
              type="text"
              inputMode="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por placa…"
              aria-label="Buscar vehículo por placa"
              className="w-full text-[14px] outline-none"
              style={{
                border: "1.5px solid var(--gray-200)", borderRadius: "var(--radius-xl)",
                padding: "11px 14px 11px 38px", color: "var(--gray-800)", background: "#fff",
              }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 pb-3.5 flex flex-col gap-2">
        {vehiculos.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gray-100)" }}>
              <Truck className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
            </div>
            <div>
              <p className="font-semibold text-[13.5px]" style={{ color: "var(--gray-700)" }}>
                Sin vehículos GPS disponibles
              </p>
              <p className="text-[12.5px] mt-1 max-w-[220px]" style={{ color: "var(--gray-400)" }}>
                Ninguno de los vehículos autorizados tiene un viaje activo con GPS en este momento.
              </p>
            </div>
          </div>
        )}

        {vehiculos.length > 0 && visibles.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10">
            <SearchX className="w-8 h-8" style={{ color: "var(--gray-300)" }} />
            <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>
              Ninguna placa coincide con "{busqueda}".
            </p>
          </div>
        )}

        {visibles.map(v => (
          <TarjetaVehiculo
            key={v.placa}
            vehiculo={v}
            seleccionado={v.placa === placaSeleccionada}
            onSeleccionar={() => v.placa && onSeleccionar(v.placa)}
          />
        ))}
      </div>
    </div>
  );
}
