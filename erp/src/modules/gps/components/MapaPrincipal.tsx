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

function makeIcon(estado: EstadoGps, selected: boolean): L.DivIcon {
  const color = ESTADO_GPS_CFG[estado].mapColor;
  const ring  = selected ? `<circle cx="16" cy="16" r="14" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.4"/>` : "";
  const dot   = selected ? `<circle cx="16" cy="16" r="3" fill="#fff"/>` : "";
  const svg   = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${ring}<circle cx="16" cy="16" r="8" fill="${color}" stroke="#fff" stroke-width="2"/>${dot}</svg>`;
  return L.divIcon({ html: svg, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -14], className: "" });
}

function makePopup(v: GpsRecord): string {
  const placa    = v.license_plate ?? "—";
  const conductor = v.driver_name  ?? "Sin conductor";
  const cliente  = v.company_customer_name?.split(",")[0].trim() ?? "—";
  return `<div style="font-family:system-ui;min-width:150px;font-size:13px;line-height:1.4">
    <div style="font-weight:700;font-size:15px;letter-spacing:0.05em;margin-bottom:3px">${placa}</div>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const clusterRef   = useRef<L.MarkerClusterGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const tileRef      = useRef<L.TileLayer | null>(null);
  const satActiveRef = useRef(false);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: COLOMBIA_CENTER, zoom: 6, zoomControl: false });
    tileRef.current = L.tileLayer(TILE_OSM, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    const cluster = L.markerClusterGroup({ maxClusterRadius: 60, showCoverageOnHover: false });
    map.addLayer(cluster);
    mapRef.current   = map;
    clusterRef.current = cluster;
    return () => { map.remove(); mapRef.current = null; clusterRef.current = null; };
  }, []);

  // ── Sync markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    const prev = markerMapRef.current;
    const next = new Map<string, L.Marker>();

    vehiculos.forEach((v) => {
      if (v.lat === null || v.lon === null) return;
      const isSel = v.id === selectedId;
      const icon  = makeIcon(v.estadoGps, isSel);
      const existing = prev.get(v.id);
      if (existing) {
        existing.setIcon(icon);
        existing.setLatLng([v.lat, v.lon]);
        next.set(v.id, existing);
      } else {
        const marker = L.marker([v.lat, v.lon], { icon })
          .bindPopup(makePopup(v), { closeButton: false, offset: [0, -10] })
          .on("click", () => onSelect(v.id));
        cluster.addLayer(marker);
        next.set(v.id, marker);
      }
    });

    prev.forEach((m, id) => { if (!next.has(id)) cluster.removeLayer(m); });
    markerMapRef.current = next;
  }, [vehiculos, selectedId, onSelect]);

  // ── Center on selected ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const v = vehiculos.find((x) => x.id === selectedId);
    if (v?.lat != null && v.lon != null) {
      mapRef.current.setView([v.lat, v.lon], Math.max(mapRef.current.getZoom(), 13), { animate: true });
    }
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
