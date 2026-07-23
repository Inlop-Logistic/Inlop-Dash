import { useState, useEffect, useRef } from "react";
import { RefreshCw, Search, Satellite, AlertCircle } from "lucide-react";
import { PageHeader, Button } from "@/components/ui";
import { useNavigationContext } from "@/core/navigation";
import { useGps } from "./hooks/useGps";
import { GpsKPIs } from "./components/GpsKPIs";
import { MapaPrincipal } from "./components/MapaPrincipal";
import { GpsInfoPanel } from "./components/GpsInfoPanel";
import { TABS_GPS, ESTADO_GPS_CFG } from "./constants";
import type { EstadoGps } from "./types";

function formatAge(from: Date, now: Date): string {
  const s = Math.floor((now.getTime() - from.getTime()) / 1000);
  if (s < 5)  return "ahora";
  if (s < 60) return `hace ${s}s`;
  return `hace ${Math.floor(s / 60)}m`;
}

export function GpsPage() {
  const { navPayload } = useNavigationContext();

  const {
    loading, error,
    busqueda, setBusqueda,
    tabActivo, setTabActivo,
    estadoFiltro, setEstadoFiltro,
    filtrados, kpis,
    selectedId, setSelectedId, selectedVehiculo,
    selectByPlate, cargar,
    lastRefresh,
  } = useGps();

  // Ticker for "updated X ago" display
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  // Auto-seleccionar desde navPayload (navegación contextual desde otro módulo)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || filtrados.length === 0) return;
    if (navPayload?.licensePlate) {
      autoOpenedRef.current = true;
      selectByPlate(navPayload.licensePlate);
    } else if (navPayload?.tripNumber) {
      const found = filtrados.find((v) => v.trip_number === navPayload.tripNumber);
      if (found) { autoOpenedRef.current = true; setSelectedId(found.id); }
    }
  }, [navPayload, filtrados, selectByPlate, setSelectedId]);

  useEffect(() => { autoOpenedRef.current = false; }, [navPayload?.licensePlate, navPayload?.tripNumber]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 60px)" }}>

      {/* Header + KPIs */}
      <div className="px-5 pt-4 pb-3 shrink-0 flex flex-col gap-3">
        <PageHeader
          title="Centro de Monitoreo"
          subtitle="Seguimiento GPS en tiempo real de toda la flota"
          icon={<Satellite className="w-5 h-5" />}
          actions={
            <div className="flex items-center gap-2">
              {lastRefresh && (
                <span className="text-[11px]" style={{ color: "var(--gray-400)" }}>
                  Actualizado {formatAge(lastRefresh, now)}
                </span>
              )}
              <Button
                variant="outline" size="sm"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
                loading={loading}
                onClick={cargar}
              >
                Actualizar
              </Button>
            </div>
          }
        />
        <GpsKPIs kpis={kpis} onTabClick={setTabActivo} />
      </div>

      {/* Filtros + Tabs */}
      <div className="px-5 pb-3 shrink-0 flex flex-wrap items-center gap-2.5">
        <div className="flex-1 min-w-[160px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--gray-400)" }} />
          <input
            type="text"
            value={busqueda}
            aria-label="Buscar vehículo"
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Placa, conductor, cliente, viaje…"
            className="w-full text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "6px 12px 6px 34px", color: "var(--gray-700)", background: "#fff" }}
          />
        </div>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          aria-label="Filtrar por estado"
          className="text-[13px] outline-none"
          style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "6px 12px", color: "var(--gray-700)", background: "#fff", minWidth: 140 }}
        >
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_GPS_CFG) as EstadoGps[]).map((k) => (
            <option key={k} value={k}>{ESTADO_GPS_CFG[k].label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 flex-wrap" role="tablist">
          {TABS_GPS.map((t) => {
            const active = tabActivo === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTabActivo(t.id)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: active ? "var(--navy)" : "#fff",
                  color:      active ? "#fff" : "var(--gray-600)",
                  border:     `1.5px solid ${active ? "var(--navy)" : "var(--gray-200)"}`,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main workspace — 70/30 permanent split */}
      <div className="flex flex-1 min-h-0 px-5 pb-5 gap-4">

        {/* Mapa (flex-1) */}
        <div className="flex-1 min-w-0">
          {error ? (
            <div
              className="flex flex-col items-center justify-center h-full rounded-xl"
              style={{ border: "1px solid var(--gray-200)", background: "var(--gray-50)" }}
            >
              <AlertCircle className="w-8 h-8 mb-3" style={{ color: "var(--inlop-red)", opacity: 0.5 }} />
              <p className="text-[13px] mb-3" style={{ color: "var(--inlop-red)" }}>{error}</p>
              <button type="button" onClick={cargar} className="text-[12px] underline" style={{ color: "var(--navy)" }}>
                Reintentar
              </button>
            </div>
          ) : (
            <MapaPrincipal
              vehiculos={filtrados}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {/* Panel de información (360px fijo — siempre visible) */}
        <div style={{ width: 360, flexShrink: 0 }}>
          <GpsInfoPanel
            vehiculo={selectedVehiculo}
            vehiculos={filtrados}
            loading={loading}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>

    </div>
  );
}
