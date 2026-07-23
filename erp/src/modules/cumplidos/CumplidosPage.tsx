import { useEffect, useRef } from "react";
import {
  RefreshCw, Search, ClipboardCheck, Clock, AlertCircle,
  CheckCircle2, XCircle, FileStack, Eye,
} from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button } from "@/components/ui";
import { useNavigationContext } from "@/core/navigation";
import { useCumplidos } from "./hooks/useCumplidos";
import { DetalleCumplido } from "./components/DetalleCumplido";
import { COLUMNS } from "./components/CumplidosTableColumns";
import { TABS, ESTADO_DOC_CFG } from "./constants";

export function CumplidosPage() {
  const { navPayload } = useNavigationContext();

  const {
    loading, error,
    busqueda, setBusqueda,
    tabActivo, setTabActivo,
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    filtradas, kpis, clientes,
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
        <KpiCard
          label="Total finalizados"
          value={kpis.total}
          icon={<FileStack className="w-4.5 h-4.5" />}
          color={CUMPLIDOS_KPI_COLORS.total.color}
          bg={CUMPLIDOS_KPI_COLORS.total.bg}
          onClick={() => setTabActivo("todos")}
        />
        <KpiCard
          label="Pendientes"
          value={kpis.pendientes}
          icon={<Clock className="w-4.5 h-4.5" />}
          color={CUMPLIDOS_KPI_COLORS.pendientes.color}
          bg={CUMPLIDOS_KPI_COLORS.pendientes.bg}
          onClick={() => setTabActivo("pendientes")}
        />
        <KpiCard
          label="Con observaciones"
          value={kpis.conObservaciones}
          icon={<AlertCircle className="w-4.5 h-4.5" />}
          color={CUMPLIDOS_KPI_COLORS.conObservaciones.color}
          bg={CUMPLIDOS_KPI_COLORS.conObservaciones.bg}
          onClick={() => setTabActivo("conObservaciones")}
        />
        <KpiCard
          label="Validados"
          value={kpis.validados}
          icon={<CheckCircle2 className="w-4.5 h-4.5" />}
          color={CUMPLIDOS_KPI_COLORS.validados.color}
          bg={CUMPLIDOS_KPI_COLORS.validados.bg}
          onClick={() => setTabActivo("validados")}
        />
        <KpiCard
          label="Listos p/facturar"
          value={kpis.listosFacturacion}
          icon={<Eye className="w-4.5 h-4.5" />}
          color={CUMPLIDOS_KPI_COLORS.listosFacturacion.color}
          bg={CUMPLIDOS_KPI_COLORS.listosFacturacion.bg}
          onClick={() => setTabActivo("listosFacturacion")}
        />
        <KpiCard
          label="Rechazados"
          value={kpis.rechazados}
          icon={<XCircle className="w-4.5 h-4.5" />}
          color={CUMPLIDOS_KPI_COLORS.rechazados.color}
          bg={CUMPLIDOS_KPI_COLORS.rechazados.bg}
          onClick={() => setTabActivo("rechazados")}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-400)" }} />
          <input
            type="text"
            value={busqueda}
            aria-label="Buscar viajes finalizados"
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Viaje, remisión, conductor, cliente…"
            className="w-full text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "8px 12px 8px 36px", color: "var(--gray-700)", background: "#fff" }}
          />
        </div>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          aria-label="Filtrar por estado documental"
          className="text-[13px] outline-none"
          style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "8px 12px", color: "var(--gray-700)", background: "#fff", minWidth: 180 }}
        >
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_DOC_CFG) as Array<keyof typeof ESTADO_DOC_CFG>).map((k) => (
            <option key={k} value={k}>{ESTADO_DOC_CFG[k].label}</option>
          ))}
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
            rowKey={(c) => c.trip_number}
            onRowClick={(c) => setPanelId(c.trip_number)}
            loading={loading}
            emptyMessage="No hay viajes finalizados para los filtros seleccionados."
          />
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

const CUMPLIDOS_KPI_COLORS = {
  total:             { color: "var(--navy)",  bg: "#DBEAFE" },
  pendientes:        { color: "#92400E",      bg: "#FEF3C7" },
  conObservaciones:  { color: "#7C3AED",      bg: "#EDE9FE" },
  validados:         { color: "#065F46",      bg: "#D1FAE5" },
  listosFacturacion: { color: "#0F4C75",      bg: "#DBEAFE" },
  rechazados:        { color: "#9F1239",      bg: "#FFE4E6" },
} as const;
