import { useState, useEffect, type CSSProperties } from "react";
import { RefreshCw, ChevronUp } from "lucide-react";
import { Encabezado } from "./Encabezado";
import { Mapa } from "./Mapa";
import { ListaVehiculos } from "./ListaVehiculos";
import { DetalleVehiculo } from "./DetalleVehiculo";
import { BannerSinConexion } from "./BannerSinConexion";
import { useHojaInferior } from "../hooks/useHojaInferior";
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
  const hoja = useHojaInferior("medio");

  // Si el vehículo seleccionado deja de estar en la lista (placa ya no
  // autorizada tras una recarga del enlace, caso extremo), limpiar selección.
  useEffect(() => {
    if (placaSeleccionada && !vehiculos.some(v => v.placa === placaSeleccionada)) {
      setPlacaSeleccionada(null);
    }
  }, [vehiculos, placaSeleccionada]);

  const seleccionado = vehiculos.find(v => v.placa === placaSeleccionada) ?? null;

  function seleccionarVehiculo(placa: string) {
    setPlacaSeleccionada(placa);
    // Si el usuario elige un vehículo desde "peek" (mapa casi completo), la
    // hoja sube al menos a "medio" para que el detalle sea legible sin
    // taparle el mapa por completo — nunca la baja si ya estaba en "lleno".
    hoja.expandirAlMenosA("medio");
  }

  function alternarHoja() {
    const siguiente: Record<typeof hoja.altura, typeof hoja.altura> = {
      peek: "medio", medio: "lleno", lleno: "peek",
    };
    hoja.setAltura(siguiente[hoja.altura]);
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">

      {/* Mapa — protagonista en todos los tamaños. En columna (móvil) queda
          arriba; en fila (desktop) queda a la izquierda — orden natural del
          DOM, sin necesidad de "order" explícito.
          `flex flex-col` aquí (no solo `relative`) es la causa raíz del mapa
          en blanco (Fase 10F): Mapa.tsx dimensiona su contenedor Leaflet con
          `flex-1` en vez de `h-full` — un `height:100%` sobre un hijo de un
          bloque no-flex dimensionado únicamente por flex-grow del padre
          (`.flex-1` sin `display:flex` propio) no siempre resuelve a un
          valor definido en Chromium (bug de layout conocido de Leaflet en
          contenedores flex anidados) — el propio contenedor quedaba con
          height:0px pese a que ESTE div sí medía su alto real. flex-grow
          entre un flex-container y su flex-item hijo directo sí se resuelve
          siempre en una sola pasada, sin la ambigüedad de porcentaje. */}
      <div className="flex-1 relative min-h-0 flex flex-col">
        <Mapa vehiculos={vehiculos} placaSeleccionada={placaSeleccionada} onSeleccionar={seleccionarVehiculo} />

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

      {/* Panel — hoja inferior real en móvil (3 estados: peek/medio/lleno,
          manejados por useHojaInferior — ver ese archivo), costado fijo
          (derecha) en desktop/tablet. La altura móvil viaja por la variable
          CSS --sheet-max-h, que .panel-vehiculos consume solo bajo el
          breakpoint móvil (globals.css) — el media query de escritorio
          (height:100%) sigue ganando sin tocarlo. Ancho con clamp() (no un
          w-[400px] fijo): en tablet retrato (~768-900px) un panel de 400px
          se come casi la mitad de la pantalla — el mapa debe ser el
          protagonista en TODOS los tamaños, no solo en desktop amplio. */}
      <div
        className="panel-vehiculos hoja-inferior shrink-0 flex flex-col bg-white overflow-hidden safe-bottom md:w-[clamp(280px,32vw,400px)] md:h-full"
        style={{ "--sheet-max-h": hoja.alturaCss, transition: hoja.arrastrando ? "none" : undefined } as CSSProperties}
      >
        {/* Handle — arrastrable (sigue el dedo en vivo) y tocable (cicla
            peek → medio → lleno). Accesible por teclado: Enter/Espacio
            cicla igual que el tap; flechas arriba/abajo mueven un paso. */}
        <div
          className="md:hidden flex flex-col items-center justify-center pt-2 pb-1.5 shrink-0 touch-none select-none cursor-grab active:cursor-grabbing"
          style={{ minHeight: "28px" }}
          role="button"
          tabIndex={0}
          aria-label="Ajustar altura del panel de vehículos"
          aria-expanded={hoja.altura !== "peek"}
          onPointerDown={hoja.handlers.onPointerDown}
          onPointerMove={hoja.handlers.onPointerMove}
          onPointerUp={hoja.handlers.onPointerUp}
          onPointerCancel={hoja.handlers.onPointerCancel}
          // Sin onClick: onPointerUp YA cicla en el tap (distingue tap de
          // arrastre internamente) — un onClick adicional aquí duplicaba el
          // avance de estado (un solo tap saltaba 2 pasos en el ciclo, ver
          // Fase 10F). El teclado no pasa por pointerup, así que sigue
          // necesitando su propio manejo explícito abajo.
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternarHoja(); }
            if (e.key === "ArrowUp")   { e.preventDefault(); hoja.setAltura(hoja.altura === "peek" ? "medio" : "lleno"); }
            if (e.key === "ArrowDown") { e.preventDefault(); hoja.setAltura(hoja.altura === "lleno" ? "medio" : "peek"); }
          }}
        >
          <div className="w-9 h-1 rounded-full" style={{ background: "var(--gray-300)" }} />
          <ChevronUp
            className="w-3 h-3 mt-0.5 transition-transform"
            style={{ color: "var(--gray-300)", transform: hoja.altura === "lleno" ? "rotate(180deg)" : "none" }}
          />
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
            <ListaVehiculos vehiculos={vehiculos} placaSeleccionada={placaSeleccionada} onSeleccionar={seleccionarVehiculo} />
          )}
        </div>
      </div>
    </div>
  );
}

function formatoHora(d: Date): string {
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}
