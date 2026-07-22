import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { ESTADO_GPS_CFG } from "../constants";
import { MapaToolbar } from "./MapaToolbar";
import { MapaLegend } from "./MapaLegend";
import type { GpsRecord, EstadoGps } from "../types";

const TILE_OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const COLOMBIA_CENTER: [number, number] = [4.6097, -74.0817];

function makeIcon(estado: EstadoGps, selected: boolean, hasSelection: boolean): L.DivIcon {
  const color = ESTADO_GPS_CFG[estado].mapColor;

  if (selected) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="14" fill="none" stroke="${color}" stroke-width="2">
        <animate attributeName="r"       values="12;20;12" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="22" cy="22" r="10" fill="${color}" stroke="#fff" stroke-width="2.5"/>
      <circle cx="22" cy="22" r="4"  fill="#fff"/>
    </svg>`;
    return L.divIcon({ html: svg, iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -18], className: "" });
  }

  const opacity = hasSelection ? 0.3 : 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="7" fill="${color}" stroke="#fff" stroke-width="2" opacity="${opacity}"/>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -12], className: "" });
}

function makePopup(v: GpsRecord): string {
  const placa     = v.license_plate ?? "—";
  const conductor = v.driver_name ?? "Sin conductor";
  const cliente   = v.razon_social ?? v.company_customer_name?.split(",")[0].trim() ?? "—";
  return `<div style="font-family:system-ui;min-width:140px;font-size:13px;line-height:1.4">
    <div style="font-weight:700;font-size:14px;letter-spacing:0.06em;margin-bottom:2px">${placa}</div>
    <div style="color:#374151">${conductor}</div>
    <div style="color:#9CA3AF;font-size:11px;margin-top:1px">${cliente}</div>
  </div>`;
}

interface MapaPrincipalProps {
  vehiculos:  GpsRecord[];
  selectedId: string | null;
  onSelect:   (id: string) => void;
}

export function MapaPrincipal({ vehiculos, selectedId, onSelect }: MapaPrincipalProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const clusterRef      = useRef<L.MarkerClusterGroup | null>(null);
  const markerMapRef    = useRef<Map<string, L.Marker>>(new Map());
  const tileRef         = useRef<L.TileLayer | null>(null);
  const satActiveRef    = useRef(false);
  // Maps marker instance → estadoGps, used in iconCreateFunction closure
  const markerEstadoRef = useRef<Map<L.Marker, EstadoGps>>(new Map());

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: COLOMBIA_CENTER, zoom: 6, zoomControl: false });
    tileRef.current = L.tileLayer(TILE_OSM, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 60,
      showCoverageOnHover: false,
      iconCreateFunction: (cl) => {
        const children = cl.getAllChildMarkers() as L.Marker[];
        const hasPanic = children.some((m) => markerEstadoRef.current.get(m) === "panico");
        const hasAlarm = children.some((m) => {
          const e = markerEstadoRef.current.get(m);
          return e === "con_alarma" || e === "panico";
        });
        const count = cl.getChildCount();
        const bg   = hasPanic ? "#7C3AED" : hasAlarm ? "#DC2626" : "#1e3a5f";
        const sz   = count < 10 ? 34 : count < 100 ? 40 : 46;
        return L.divIcon({
          html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:system-ui;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2.5px solid rgba(255,255,255,0.85)">${count}</div>`,
          iconSize:   [sz, sz],
          iconAnchor: [sz / 2, sz / 2],
          className:  "",
        });
      },
    });

    map.addLayer(cluster);
    mapRef.current     = map;
    clusterRef.current = cluster;
    return () => { map.remove(); mapRef.current = null; clusterRef.current = null; };
  }, []);

  // ── Sync markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    const prev        = markerMapRef.current;
    const next        = new Map<string, L.Marker>();
    const hasSelection = selectedId !== null;

    vehiculos.forEach((v) => {
      if (v.lat === null || v.lon === null) return;
      const isSel = v.id === selectedId;
      const icon  = makeIcon(v.estadoGps, isSel, hasSelection);
      const existing = prev.get(v.id);
      if (existing) {
        existing.setIcon(icon);
        existing.setLatLng([v.lat, v.lon]);
        markerEstadoRef.current.set(existing, v.estadoGps);
        next.set(v.id, existing);
      } else {
        const marker = L.marker([v.lat, v.lon], { icon })
          .bindPopup(makePopup(v), { closeButton: false, offset: [0, -10] })
          .on("click", () => onSelect(v.id));
        markerEstadoRef.current.set(marker, v.estadoGps);
        cluster.addLayer(marker);
        next.set(v.id, marker);
      }
    });

    prev.forEach((m, id) => {
      if (!next.has(id)) {
        cluster.removeLayer(m);
        markerEstadoRef.current.delete(m);
      }
    });
    markerMapRef.current = next;
  }, [vehiculos, selectedId, onSelect]);

  // ── Fly to selected + auto-open popup ─────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const v = vehiculos.find((x) => x.id === selectedId);
    if (v?.lat == null || v.lon == null) return;
    const map    = mapRef.current;
    const marker = markerMapRef.current.get(selectedId);
    map.flyTo([v.lat, v.lon], Math.max(map.getZoom(), 14), { animate: true, duration: 0.8 });
    if (marker) map.once("moveend", () => marker.openPopup());
  }, [selectedId, vehiculos]);

  // ── Toolbar handlers ──────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = vehiculos.filter((v) => v.lat != null && v.lon != null);
    if (!pts.length) { map.setView(COLOMBIA_CENTER, 6); return; }
    const bounds = L.latLngBounds(pts.map((v) => [v.lat!, v.lon!] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [vehiculos]);

  const toggleSat = useCallback(() => {
    if (!tileRef.current) return;
    satActiveRef.current = !satActiveRef.current;
    tileRef.current.setUrl(satActiveRef.current ? TILE_SAT : TILE_OSM);
  }, []);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ border: "1px solid var(--gray-200)" }}>
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-3 right-3 z-[1000]">
        <MapaToolbar
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onFitAll={fitAll}
          onToggleSat={toggleSat}
          satellite={satActiveRef.current}
        />
      </div>
      <div className="absolute bottom-3 left-3 z-[1000]">
        <MapaLegend />
      </div>
    </div>
  );
}
