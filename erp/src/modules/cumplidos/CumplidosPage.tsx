import { useEffect, useRef } from "react";
import {
  RefreshCw, ClipboardCheck, Clock, AlertCircle,
  CheckCircle2, FileStack, Truck, Receipt, Banknote,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
} from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button, FilterBar } from "@/components/ui";
import type { SelectFilter } from "@/components/ui";
import { useNavigationContext } from "@/core/navigation";
import { useCumplidos } from "./hooks/useCumplidos";
import { DetalleCumplido } from "./components/DetalleCumplido";
import { COLUMNS } from "./components/CumplidosTableColumns";
import { TABS } from "./constants";

export function CumplidosPage() {
  const { navPayload } = useNavigationContext();

  const {
    loading, error,
    busqueda, setBusqueda,
    tabActivo, setTabActivo,
    lineaNegocioFiltro, setLineaNegocioFiltro,
    clienteFiltro, setClienteFiltro,
    fechaDesde, fechaHasta, setFechaRango,
    filtradas, paginadas, kpis, clientes,
    pagina, setPagina,
    tamPagina, setTamPagina,
    totalPaginas,
    hayFiltros, limpiarFiltros,
    setPanelId, panelCumplido,
    cargar, getTabCount,
  } = useCumplidos();

  // Auto-abrir panel cuando se navega contextualmente desde otro módulo
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpenedRef.current && navPayload?.tripNumber && filtradas.length > 0) {
      autoOpenedRef.current = true;
      setPanelId(navPayload.tripNumber);
    }
  }, [navPayload?.tripNumber, filtradas.length, setPanelId]);

  useEffect(() => {
    autoOpenedRef.current = false;
  }, [navPayload?.tripNumber]);

  const start = filtradas.length === 0 ? 0 : (pagina - 1) * tamPagina + 1;
  const end   = Math.min(pagina * tamPagina, filtradas.length);

  const selects: SelectFilter[] = [
    {
      value:       lineaNegocioFiltro,
      onChange:    setLineaNegocioFiltro,
      placeholder: "Todas las líneas",
      ariaLabel:   "Filtrar por línea de negocio",
      minWidth:    160,
      options:     [
        { value: "Carga Líquida", label: "Carga Líquida" },
        { value: "Carga Seca",    label: "Carga Seca"    },
      ],
    },
    {
      value:       clienteFiltro,
      onChange:    setClienteFiltro,
      placeholder: "Todos los clientes",
      ariaLabel:   "Filtrar por cliente",
      minWidth:    180,
      show:        clientes.length > 0,
      options:     clientes.map((c) => ({ value: c, label: c })),
    },
  ];

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* Header */}
      <PageHeader
        title="Viajes Finalizados"
        subtitle="Cierre documental de servicios finalizados"
        icon={<ClipboardCheck className="w-5 h-5" />}
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
        <KpiCard label="Total Servicios" value={kpis.total}       icon={<FileStack   className="w-4.5 h-4.5" />} color={KPI_COLORS.total.color}       bg={KPI_COLORS.total.bg}       onClick={() => setTabActivo("todos")}            />
        <KpiCard label="Pendientes"      value={kpis.pendientes}  icon={<Clock       className="w-4.5 h-4.5" />} color={KPI_COLORS.pendientes.color}  bg={KPI_COLORS.pendientes.bg}  />
        <KpiCard label="Finalizados"     value={kpis.finalizados} icon={<CheckCircle2 className="w-4.5 h-4.5" />} color={KPI_COLORS.finalizados.color} bg={KPI_COLORS.finalizados.bg} />
        <KpiCard label="Cumplidos"       value={kpis.cumplidos}   icon={<Truck       className="w-4.5 h-4.5" />} color={KPI_COLORS.cumplidos.color}   bg={KPI_COLORS.cumplidos.bg}   onClick={() => setTabActivo("validados")}        />
        <KpiCard label="Liquidados"      value={kpis.liquidados}  icon={<Receipt     className="w-4.5 h-4.5" />} color={KPI_COLORS.liquidados.color}  bg={KPI_COLORS.liquidados.bg}  onClick={() => setTabActivo("listosFacturacion")} />
        <KpiCard label="Facturados"      value={kpis.facturados}  icon={<Banknote    className="w-4.5 h-4.5" />} color={KPI_COLORS.facturados.color}  bg={KPI_COLORS.facturados.bg}  />
      </div>

      {/* Filtros */}
      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        searchPlaceholder="Viaje, conductor, cliente…"
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
          <>
            <DataTable
              columns={COLUMNS}
              rows={paginadas}
              rowKey={(c) => c.trip_number}
              onRowClick={(c) => setPanelId(c.trip_number)}
              loading={loading}
              emptyMessage="No hay viajes finalizados para los filtros seleccionados."
            />

            {/* Controles de paginación */}
            {!loading && filtradas.length > 0 && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                style={{ borderTop: "1px solid var(--gray-100)" }}
              >
                <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
                  Mostrando {start}–{end} de {filtradas.length} viaje{filtradas.length !== 1 ? "s" : ""}
                </span>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>Por página</span>
                    <select
                      value={tamPagina}
                      onChange={(e) => { setTamPagina(Number(e.target.value)); setPagina(1); }}
                      className="text-[12px] outline-none"
                      style={{ border: "1.5px solid var(--gray-200)", borderRadius: 8, padding: "4px 8px", color: "var(--gray-700)", background: "#fff" }}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
                    Página {pagina} de {totalPaginas}
                  </span>

                  <div className="flex items-center gap-1">
                    <PaginaBtn icon={<ChevronFirst className="w-3.5 h-3.5" />} onClick={() => setPagina(1)}              disabled={pagina === 1}           label="Primera página"   />
                    <PaginaBtn icon={<ChevronLeft  className="w-3.5 h-3.5" />} onClick={() => setPagina(p => p - 1)}    disabled={pagina === 1}           label="Página anterior"  />
                    <PaginaBtn icon={<ChevronRight className="w-3.5 h-3.5" />} onClick={() => setPagina(p => p + 1)}    disabled={pagina === totalPaginas} label="Página siguiente" />
                    <PaginaBtn icon={<ChevronLast  className="w-3.5 h-3.5" />} onClick={() => setPagina(totalPaginas)}  disabled={pagina === totalPaginas} label="Última página"    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Panel de detalle */}
      {panelCumplido && (
        <DetalleCumplido
          cumplido={panelCumplido}
          onClose={() => setPanelId(null)}
        />
      )}
    </div>
  );
}

function PaginaBtn({ icon, onClick, disabled, label }: {
  icon: React.ReactNode; onClick: () => void; disabled: boolean; label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
      style={{
        border:     `1.5px solid ${disabled ? "var(--gray-100)" : "var(--gray-200)"}`,
        color:      disabled ? "var(--gray-300)" : "var(--gray-600)",
        background: disabled ? "var(--gray-50)"  : "#fff",
        cursor:     disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
    </button>
  );
}

const KPI_COLORS = {
  total:       { color: "var(--navy)", bg: "#DBEAFE" },
  pendientes:  { color: "#92400E",     bg: "#FEF3C7" },
  finalizados: { color: "#065F46",     bg: "#D1FAE5" },
  cumplidos:   { color: "#1D4ED8",     bg: "#EFF6FF" },
  liquidados:  { color: "#0F4C75",     bg: "#DBEAFE" },
  facturados:  { color: "#374151",     bg: "var(--gray-100)" },
} as const;
