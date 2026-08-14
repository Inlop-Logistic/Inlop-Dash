import { useEffect, useRef } from "react";
import L from "leaflet";
import { ESTADO_GPS_CFG } from "../constants";
import { tieneGpsActivo } from "../vehiculos";
import type { VehiculoPublico } from "../types";

/**
 * Mismo proveedor de tiles (OpenStreetMap, gratuito, sin API key) y la
 * misma técnica de marcadores (SVG en L.divIcon, diffing por placa,
 * flyTo al seleccionar) que erp/src/modules/gps/components/MapaPrincipal.tsx
 * — no se reimplementa lógica GPS, solo el renderizado del mapa en este
 * proyecto Vite independiente (ver vite.config.ts). Sin clustering: el
 * conjunto de vehículos de un enlace es siempre pequeño (los de un solo
 * reporte), no hace falta la complejidad de leaflet.markercluster aquí.
 */
const TILE_OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const COLOMBIA_CENTER: [number, number] = [4.6097, -74.0817];

function crearIcono(v: VehiculoPublico, seleccionado: boolean): L.DivIcon {
  const color = tieneGpsActivo(v) ? ESTADO_GPS_CFG[v.estado].mapColor : "#94A3B8";

  if (seleccionado) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
      <circle cx="23" cy="23" r="15" fill="none" stroke="${color}" stroke-width="2">
        <animate attributeName="r" values="13;21;13" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="23" cy="23" r="11" fill="${color}" stroke="#fff" stroke-width="3"/>
      <circle cx="23" cy="23" r="4" fill="#fff"/>
    </svg>`;
    return L.divIcon({ html: svg, iconSize: [46, 46], iconAnchor: [23, 23], popupAnchor: [0, -20], className: "marcador-vehiculo seleccionado" });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    <circle cx="13" cy="13" r="8" fill="${color}" stroke="#fff" stroke-width="2.5"/>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12], className: "marcador-vehiculo" });
}

function crearPopup(v: VehiculoPublico): string {
  return `<div style="font-family:'DM Sans',system-ui;min-width:130px">
    <div style="font-weight:700;font-size:14px;letter-spacing:0.05em;color:#012A6B">${v.placa ?? "—"}</div>
    <div style="color:#3A4257;font-size:12.5px;margin-top:1px">${v.conductor ?? "Sin conductor"}</div>
  </div>`;
}

interface Props {
  vehiculos: VehiculoPublico[];
  placaSeleccionada: string | null;
  onSeleccionar: (placa: string) => void;
}

export function Mapa({ vehiculos, placaSeleccionada, onSeleccionar }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const marcadoresRef = useRef<Map<string, L.Marker>>(new Map());
  const primerAjusteRef = useRef(false);

  // Init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: COLOMBIA_CENTER, zoom: 6, zoomControl: false });
    L.tileLayer(TILE_OSM, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    // El contenedor cambia de tamaño sin que la ventana cambie de tamaño:
    // la hoja inferior (móvil) se redimensiona al pasar de lista a detalle,
    // el panel lateral (desktop/tablet) puede angostarse, y el teclado
    // virtual del OTP ya quedó atrás pero el primer layout puede asentarse
    // un frame después del montaje. Leaflet cachea el tamaño que midió al
    // iniciar — sin volver a decírselo, un contenedor que crece/encoge
    // después queda con tiles mal recortados o con el mapa "congelado" en
    // el tamaño viejo. ResizeObserver es la fuente de verdad — más fiable
    // que escuchar solo `resize` de window, que no dispara por cambios de
    // layout internos (ej. abrir el detalle de un vehículo).
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const prev = marcadoresRef.current;
    const next = new Map<string, L.Marker>();
    const conPosicion = vehiculos.filter(tieneGpsActivo);

    conPosicion.forEach(v => {
      const placa = v.placa!;
      const icono = crearIcono(v, placa === placaSeleccionada);
      const existente = prev.get(placa);
      if (existente) {
        existente.setIcon(icono);
        existente.setLatLng([v.lat!, v.lon!]);
        existente.setPopupContent(crearPopup(v));
        next.set(placa, existente);
      } else {
        const marker = L.marker([v.lat!, v.lon!], { icon: icono })
          .bindPopup(crearPopup(v), { closeButton: false, offset: [0, -10] })
          .on("click", () => onSeleccionar(placa));
        marker.addTo(map);
        next.set(placa, marker);
      }
    });

    prev.forEach((marker, placa) => {
      if (!next.has(placa)) marker.remove();
    });
    marcadoresRef.current = next;

    // Encuadre inicial automático una sola vez que hay datos — después el
    // usuario tiene el control (no re-encuadramos en cada refresco).
    if (!primerAjusteRef.current && conPosicion.length > 0) {
      primerAjusteRef.current = true;
      if (conPosicion.length === 1) {
        map.setView([conPosicion[0].lat!, conPosicion[0].lon!], 14);
      } else {
        const bounds = L.latLngBounds(conPosicion.map(v => [v.lat!, v.lon!] as [number, number]));
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
      }
    }
  }, [vehiculos, placaSeleccionada, onSeleccionar]);

  // Centrar al seleccionar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placaSeleccionada) return;
    const v = vehiculos.find(x => x.placa === placaSeleccionada);
    if (!v || !tieneGpsActivo(v)) return;
    map.flyTo([v.lat!, v.lon!], Math.max(map.getZoom(), 14), { animate: true, duration: 0.6 });
    const marker = marcadoresRef.current.get(placaSeleccionada);
    if (marker) map.once("moveend", () => marker.openPopup());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placaSeleccionada]);

  // flex-1 (no h-full): el padre directo (PantallaSeguimiento) es ahora un
  // `flex flex-col` — flex-grow entre contenedor y ítem flex se resuelve en
  // una sola pasada; un `height:100%` aquí podía quedar en 0px según cómo
  // el padre haya llegado a su propio alto (ver nota en PantallaSeguimiento).
  return <div ref={containerRef} className="w-full flex-1 min-h-0" role="application" aria-label="Mapa de seguimiento GPS" />;
}
