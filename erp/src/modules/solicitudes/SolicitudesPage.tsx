import { useState } from "react";
import {
  RefreshCw, Clock, CheckCircle, Truck, ClipboardList, AlertCircle, Download, ChevronLeft, ChevronRight,
} from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button, FilterBar } from "@/components/ui";
import type { SelectFilter } from "@/components/ui";
import { useSolicitudes } from "./hooks/useSolicitudes";
import { DetalleSolicitud } from "./components/DetalleSolicitud";
import { COLUMNS } from "./components/SolicitudesTableColumns";
import { TABS, ESTADO_CFG } from "./constants";

export function SolicitudesPage() {
  const {
    loading, error, exportando,
    busqueda, setBusqueda, setFechaRango,
    tabEstado, setTabEstado, estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro, clientes,
    setPanelId, panelSol, filtradas, kpis,
    hayFiltros, limpiarFiltros, cargar, handleEstado, exportar,
    pagination, page, setPage,
  } = useSolicitudes();

  const [visualDesde, setVisualDesde] = useState("");
  const [visualHasta, setVisualHasta] = useState("");

  function handleFechaRango(desde: string, hasta: string) {
    setFechaRango(desde, hasta);
    setVisualDesde(desde);
    setVisualHasta(hasta);
  }

  function handleLimpiarFiltros() {
    limpiarFiltros();
    setVisualDesde("");
    setVisualHasta("");
  }

  const selects: SelectFilter[] = [
    {
      value: estadoFiltro, onChange: setEstadoFiltro, placeholder: "Todos los estados",
      ariaLabel: "Filtrar por estado", minWidth: 160,
      options: Object.entries(ESTADO_CFG).map(([key, cfg]) => ({ value: key, label: cfg.label })),
    },
    {
      value: clienteFiltro, onChange: setClienteFiltro, placeholder: "Todos los clientes",
      ariaLabel: "Filtrar por cliente", minWidth: 190, show: clientes.length > 0,
      options: clientes.map((c) => ({ value: c, label: c })),
    },
  ];

  return (
    <div className="p-6 flex flex-col gap-5">
      <PageHeader
        title="Solicitudes"
        subtitle="Solicitudes entrantes del Portal Cliente"
        icon={<ClipboardList className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} loading={exportando} onClick={exportar}>
              Exportar Excel
            </Button>
            <Button variant="outline" size="sm" icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />} loading={loading} onClick={cargar}>
              Actualizar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Solicitudes" subtitle="Total en el rango" value={kpis.total} icon={<ClipboardList className="w-4.5 h-4.5" />} color="#1D4ED8" bg="#DBEAFE" onClick={() => setTabEstado("todos")} />
        <KpiCard label="Pendientes" subtitle="Pendientes por gestionar" value={kpis.pendientes} icon={<Clock className="w-4.5 h-4.5" />} color="#B45309" bg="#FEF3C7" onClick={() => setTabEstado("pendiente")} />
        <KpiCard label="En Ruta" subtitle="Viajes activos" value={kpis.enRuta} icon={<Truck className="w-4.5 h-4.5" />} color="var(--navy)" bg="#DBEAFE" onClick={() => setTabEstado("en_ruta")} />
        <KpiCard label="Finalizadas" subtitle="Servicios completados" value={kpis.finalizadas} icon={<CheckCircle className="w-4.5 h-4.5" />} color="#065F46" bg="#D1FAE5" onClick={() => setTabEstado("completado")} />
      </div>

      <FilterBar
        busqueda={busqueda} onBusqueda={setBusqueda}
        searchPlaceholder="SOL, remisión, agencia o ruta…"
        selects={selects} fechaDesde={visualDesde} fechaHasta={visualHasta}
        onFechaRango={handleFechaRango} hayFiltros={hayFiltros} onLimpiar={handleLimpiarFiltros}
      />

      <div className="flex items-center gap-1.5 flex-wrap" role="tablist">
        {TABS.map((t) => {
          const active = tabEstado === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={active} onClick={() => setTabEstado(t.id)}
              className="flex items-center gap-1.5 font-semibold text-[12px] px-3.5 py-1.5 rounded-lg transition-all"
              style={{ background: active ? "var(--navy)" : "#fff", color: active ? "#fff" : "var(--gray-600)", border: `1.5px solid ${active ? "var(--navy)" : "var(--gray-200)"}` }}>
              {t.label}
            </button>
          );
        })}
        <span className="text-[12px]" style={{ color: "var(--gray-400)" }}>
          · {pagination.total} resultado{pagination.total !== 1 ? "s" : ""}
        </span>
      </div>

      <Card>
        {error ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--inlop-red)", opacity: 0.5 }} />
            <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
            <button type="button" onClick={cargar} className="mt-3 text-[12px] underline" style={{ color: "var(--navy)" }}>Reintentar</button>
          </div>
        ) : (
          <>
            <DataTable columns={COLUMNS} rows={filtradas} rowKey={(s) => s.id} onRowClick={(s) => setPanelId(s.id)} loading={loading} emptyMessage="No hay solicitudes en el rango seleccionado." />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t" style={{ borderColor: "var(--gray-100)" }}>
              <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
                {pagination.total === 0 ? "Sin registros" : `Mostrando ${(page - 1) * pagination.pageSize + 1}–${Math.min(page * pagination.pageSize, pagination.total)} de ${pagination.total}`}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--gray-700)" }}>
                  Página {pagination.totalPages === 0 ? 0 : page} de {pagination.totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}>
                  Siguiente <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {panelSol && <DetalleSolicitud solicitud={panelSol} onClose={() => setPanelId(null)} onEstado={handleEstado} />}
    </div>
  );
}
