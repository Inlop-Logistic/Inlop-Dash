import { RefreshCw, Search, Truck, Activity, Package, Navigation, PackageCheck, AlertTriangle, AlertCircle } from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button } from "@/components/ui";
import { useViajes } from "./hooks/useViajes";
import { DetalleViaje } from "./components/DetalleViaje";
import { COLUMNS } from "./components/ViajesTableColumns";
import { TABS } from "./constants";

export function ViajesPage() {
  const {
    loading, error,
    busqueda, setBusqueda,
    tabActivo, setTabActivo,
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    filtradas, kpis, clientes,
    setPanelId, panelViaje,
    cargar, getTabCount,
  } = useViajes();

  const tabLabels: Record<string, string> = {
    todos:        "Todos",
    activos:      "Activos",
    enRuta:       "En Ruta",
    finalizados:  "Finalizados",
    conNovedad:   "Con Novedad",
  };

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
        <KpiCard
          label="Activos"
          value={kpis.activos}
          icon={<Activity className="w-4.5 h-4.5" />}
          color="#1D4ED8" bg="#DBEAFE"
          onClick={() => setTabActivo("activos")}
        />
        <KpiCard
          label="En Cargue"
          value={kpis.enCargue}
          icon={<Package className="w-4.5 h-4.5" />}
          color="#D97706" bg="#FEF3C7"
          onClick={() => setTabActivo("activos")}
        />
        <KpiCard
          label="En Ruta"
          value={kpis.enRuta}
          icon={<Navigation className="w-4.5 h-4.5" />}
          color="#2563EB" bg="#DBEAFE"
          onClick={() => setTabActivo("enRuta")}
        />
        <KpiCard
          label="En Descargue"
          value={kpis.enDescargue}
          icon={<PackageCheck className="w-4.5 h-4.5" />}
          color="#7C3AED" bg="#EDE9FE"
          onClick={() => setTabActivo("activos")}
        />
        <KpiCard
          label="Finalizados"
          value={kpis.finalizados}
          icon={<PackageCheck className="w-4.5 h-4.5" />}
          color="#059669" bg="#D1FAE5"
          onClick={() => setTabActivo("finalizados")}
        />
        <KpiCard
          label="Con Novedad"
          value={kpis.conNovedad}
          icon={<AlertTriangle className="w-4.5 h-4.5" />}
          color="#DC2626" bg="#FEE2E2"
          onClick={() => setTabActivo("conNovedad")}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-400)" }} />
          <input
            type="text"
            value={busqueda}
            aria-label="Buscar viajes"
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Trip, conductor, placa, cliente, ciudad…"
            className="w-full text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "8px 12px 8px 36px", color: "var(--gray-700)", background: "#fff" }}
          />
        </div>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          aria-label="Filtrar por estado"
          className="text-[13px] outline-none"
          style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "8px 12px", color: "var(--gray-700)", background: "#fff", minWidth: 160 }}
        >
          <option value="">Todos los estados</option>
          <option value="en transíto">En Ruta</option>
          <option value="iniciado">Iniciado</option>
          <option value="cargando">Cargando</option>
          <option value="descargando">Descargando</option>
          <option value="pernoctando">Pernoctando</option>
          <option value="completado">Completado</option>
          <option value="finalizado">Finalizado</option>
          <option value="cancelado">Cancelado</option>
          <option value="sin activar">Sin activar</option>
          <option value="sin asignar">Sin asignar</option>
        </select>

        {clientes.length > 0 && (
          <select
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
            aria-label="Filtrar por cliente"
            className="text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "8px 12px", color: "var(--gray-700)", background: "#fff", minWidth: 180 }}
          >
            <option value="">Todos los clientes</option>
            {clientes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

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
        {busqueda && (
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
