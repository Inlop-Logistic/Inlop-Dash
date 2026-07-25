import {
  RefreshCw,
  Clock, CheckCircle, Truck, XCircle, ClipboardList, AlertCircle,
} from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button, FilterBar } from "@/components/ui";
import { useSolicitudes } from "./hooks/useSolicitudes";
import { DetalleSolicitud } from "./components/DetalleSolicitud";
import { COLUMNS } from "./components/SolicitudesTableColumns";
import { TABS } from "./constants";

export function SolicitudesPage() {
  const {
    data, loading, error,
    busqueda, setBusqueda,
    fechaDesde, fechaHasta, setFechaRango,
    tabEstado, setTabEstado,
    setPanelId, panelSol,
    filtradas, kpis,
    hayFiltros, limpiarFiltros,
    cargar, handleEstado,
  } = useSolicitudes();

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* Header */}
      <PageHeader
        title="Solicitudes"
        subtitle="Solicitudes entrantes del Portal Cliente"
        icon={<ClipboardList className="w-5 h-5" />}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Recibidas"   value={kpis.recibidas}   icon={<ClipboardList className="w-4.5 h-4.5" />} color="#1D4ED8"      bg="#DBEAFE"  onClick={() => setTabEstado("todos")}      />
        <KpiCard label="Pendientes"  value={kpis.pendientes}  icon={<Clock         className="w-4.5 h-4.5" />} color="#B45309"      bg="#FEF3C7"  onClick={() => setTabEstado("pendiente")}  />
        <KpiCard label="En gestión"  value={kpis.enGestion}   icon={<Truck         className="w-4.5 h-4.5" />} color="var(--navy)"  bg="#DBEAFE"  onClick={() => setTabEstado("aprobado")}   />
        <KpiCard label="Completadas" value={kpis.completadas} icon={<CheckCircle   className="w-4.5 h-4.5" />} color="#065F46"      bg="#D1FAE5"  onClick={() => setTabEstado("completado")} />
        <KpiCard label="Canceladas"  value={kpis.canceladas}  icon={<XCircle       className="w-4.5 h-4.5" />} color="#9F1239"      bg="#FFE4E6"  onClick={() => setTabEstado("cancelado")}  />
      </div>

      {/* Filtros */}
      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        searchPlaceholder="SOL, cliente, agencia, ruta…"
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        onFechaRango={setFechaRango}
        hayFiltros={hayFiltros}
        onLimpiar={limpiarFiltros}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap" role="tablist">
        {TABS.map((t) => {
          const active = tabEstado === t.id;
          const count  = t.id === "todos"
            ? data.length
            : data.filter((s) => s.estado === t.id).length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTabEstado(t.id)}
              className="flex items-center gap-1.5 font-semibold text-[12px] px-3.5 py-1.5 rounded-lg transition-all"
              style={{
                background: active ? "var(--navy)" : "#fff",
                color:      active ? "#fff" : "var(--gray-600)",
                border:     `1.5px solid ${active ? "var(--navy)" : "var(--gray-200)"}`,
              }}
            >
              {t.label}
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
            rowKey={(s) => s.id}
            onRowClick={(s) => setPanelId(s.id)}
            loading={loading}
            emptyMessage="No hay solicitudes en el rango seleccionado."
          />
        )}
      </Card>

      {/* Panel detalle */}
      {panelSol && (
        <DetalleSolicitud
          solicitud={panelSol}
          onClose={() => setPanelId(null)}
          onEstado={handleEstado}
        />
      )}
    </div>
  );
}
