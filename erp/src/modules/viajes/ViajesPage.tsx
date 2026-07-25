import { useEffect, useRef } from "react";
import { RefreshCw, Truck, Activity, Package, Navigation, PackageCheck, AlertTriangle, AlertCircle } from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button, FilterBar } from "@/components/ui";
import type { SelectFilter } from "@/components/ui";
import { useNavigationContext } from "@/core/navigation";
import { useViajes } from "./hooks/useViajes";
import { DetalleViaje } from "./components/DetalleViaje";
import { COLUMNS } from "./components/ViajesTableColumns";
import { TABS, ESTADO_CFG } from "./constants";
import type { EstadoViaje } from "./types";

export function ViajesPage() {
  const { navPayload } = useNavigationContext();

  const {
    loading, error,
    busqueda, setBusqueda,
    tabActivo, setTabActivo,
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    fechaDesde, fechaHasta, setFechaRango,
    hayFiltros, limpiarFiltros,
    filtradas, kpis, clientes,
    setPanelId, panelViaje,
    cargar, getTabCount,
  } = useViajes();

  // Auto-abrir panel cuando se navega con contexto (ej. desde Programación)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpenedRef.current && navPayload?.tripNumber && filtradas.length > 0) {
      autoOpenedRef.current = true;
      setPanelId(navPayload.tripNumber);
    }
  }, [navPayload?.tripNumber, filtradas.length, setPanelId]);

  useEffect(() => { autoOpenedRef.current = false; }, [navPayload?.tripNumber]);

  const tabLabels: Record<string, string> = {
    todos:        "Todos",
    activos:      "Activos",
    enRuta:       "En Ruta",
    finalizados:  "Finalizados",
    conNovedad:   "Con Novedad",
  };

  const selects: SelectFilter[] = [
    {
      value:       estadoFiltro,
      onChange:    setEstadoFiltro,
      placeholder: "Todos los estados",
      ariaLabel:   "Filtrar por estado",
      minWidth:    160,
      options:     (Object.entries(ESTADO_CFG) as [EstadoViaje, typeof ESTADO_CFG[string]][]).map(
        ([key, cfg]) => ({ value: key, label: cfg.label }),
      ),
    },
    {
      value:       clienteFiltro,
      onChange:    setClienteFiltro,
      placeholder: "Todos los clientes",
      ariaLabel:   "Filtrar por cliente",
      minWidth:    190,
      show:        clientes.length > 0,
      options:     clientes.map((c) => ({ value: c.id, label: c.label })),
    },
  ];

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* Header */}
      <PageHeader
        title="Viajes"
        subtitle="Centro de monitoreo operativo en tiempo real"
        icon={<Truck className="w-5 h-5" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
            loading={loading}
            onClick={cargar}
          >
            Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Activos"      value={kpis.activos}     icon={<Activity      className="w-4.5 h-4.5" />} color="#1D4ED8" bg="#DBEAFE" onClick={() => setTabActivo("activos")}     />
        <KpiCard label="En Cargue"    value={kpis.enCargue}    icon={<Package       className="w-4.5 h-4.5" />} color="#D97706" bg="#FEF3C7" onClick={() => setTabActivo("activos")}     />
        <KpiCard label="En Ruta"      value={kpis.enRuta}      icon={<Navigation    className="w-4.5 h-4.5" />} color="#2563EB" bg="#DBEAFE" onClick={() => setTabActivo("enRuta")}      />
        <KpiCard label="En Descargue" value={kpis.enDescargue} icon={<PackageCheck  className="w-4.5 h-4.5" />} color="#7C3AED" bg="#EDE9FE" onClick={() => setTabActivo("activos")}     />
        <KpiCard label="Finalizados"  value={kpis.finalizados} icon={<PackageCheck  className="w-4.5 h-4.5" />} color="#059669" bg="#D1FAE5" onClick={() => setTabActivo("finalizados")} />
        <KpiCard label="Con Novedad"  value={kpis.conNovedad}  icon={<AlertTriangle className="w-4.5 h-4.5" />} color="#DC2626" bg="#FEE2E2" onClick={() => setTabActivo("conNovedad")}  />
      </div>

      {/* Filtros */}
      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        searchPlaceholder="Viaje, remisión, placa, conductor, cliente, ciudad…"
        selects={selects}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        onFechaRango={setFechaRango}
        hayFiltros={hayFiltros}
        onLimpiar={limpiarFiltros}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap" role="tablist">
        {TABS.map((t) => {
          const active = tabActivo === t.id;
          const count  = getTabCount(t.id);
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTabActivo(t.id)}
              className="flex items-center gap-1.5 font-semibold text-[12px] px-3.5 py-1.5 rounded-lg transition-all"
              style={{
                background: active ? "var(--navy)" : "#fff",
                color:      active ? "#fff" : "var(--gray-600)",
                border:     `1.5px solid ${active ? "var(--navy)" : "var(--gray-200)"}`,
              }}
            >
              {tabLabels[t.id] ?? t.id}
              {count > 0 && (
                <span
                  className="text-[10px] font-bold min-w-[16px] text-center px-1 rounded-full"
                  style={{
                    background: active ? "rgba(255,255,255,0.2)" : "var(--gray-100)",
                    color:      active ? "#fff" : "var(--gray-500)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {(busqueda || clienteFiltro || estadoFiltro) && (
          <span className="text-[12px]" style={{ color: "var(--gray-400)" }}>
            · {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tabla */}
      <Card>
        {error ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--inlop-red)", opacity: 0.5 }} />
            <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
            <button type="button" onClick={cargar} className="mt-3 text-[12px] underline" style={{ color: "var(--navy)" }}>
              Reintentar
            </button>
          </div>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={filtradas}
            rowKey={(v) => v.trip_number}
            onRowClick={(v) => setPanelId(v.trip_number)}
            loading={loading}
            emptyMessage="No hay viajes para los filtros seleccionados."
          />
        )}
      </Card>

      {/* Panel de detalle */}
      {panelViaje && (
        <DetalleViaje
          viaje={panelViaje}
          onClose={() => setPanelId(null)}
        />
      )}
    </div>
  );
}
