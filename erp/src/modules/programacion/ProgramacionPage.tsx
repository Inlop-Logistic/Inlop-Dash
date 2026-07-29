import { useState, useEffect, useRef, useMemo } from "react";
import { RefreshCw, CalendarClock, Clock, Activity, XCircle, AlertCircle } from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button, FilterBar, ClienteFilter } from "@/components/ui";
import type { SelectFilter } from "@/components/ui";
import { useNavigationContext } from "@/core/navigation";
import { useProgramacion } from "./hooks/useProgramacion";
import { CentroOperativo } from "./components/CentroOperativo";
import { COLUMNS } from "./components/ProgramacionTableColumns";
import { TABS, tabCount, ESTADO_CFG } from "./constants";

export function ProgramacionPage() {
  const { navPayload } = useNavigationContext();

  const {
    data, loading, error,
    busqueda, setBusqueda,
    buscar,
    tabEstado, setTabEstado,
    estadoFiltro, setEstadoFiltro,
    clienteFiltro, setClienteFiltro,
    setPanelId, panelViaje,
    accionLoading,
    filtradas, kpis,
    hayFiltros, limpiarFiltros,
    cargar, handleEstado, handleSync,
  } = useProgramacion();

  // Estado visual de fechas — empieza vacío; la lógica interna del hook usa sus propios defaults.
  const [visualDesde, setVisualDesde] = useState("");
  const [visualHasta, setVisualHasta] = useState("");

  function handleFechaRango(desde: string, hasta: string) {
    setVisualDesde(desde);
    setVisualHasta(hasta);
    buscar(desde, hasta);
  }

  function handleLimpiarFiltros() {
    limpiarFiltros();
    setVisualDesde("");
    setVisualHasta("");
  }

  // Clientes únicos para el combobox — derivados del dataset actual
  const opcionesCliente = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const v of data) {
      const n = v.nombre_cliente || v.company_customer_name;
      if (n && !seen.has(n)) { seen.add(n); result.push(n); }
    }
    return result.sort((a, b) => a.localeCompare(b, "es"));
  }, [data]);

  // Auto-abrir panel cuando se navega con contexto (ej. desde Viajes)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpenedRef.current && navPayload?.tripNumber && data.length > 0) {
      autoOpenedRef.current = true;
      setPanelId(navPayload.tripNumber);
    }
  }, [navPayload?.tripNumber, data.length, setPanelId]);

  useEffect(() => {
    autoOpenedRef.current = false;
  }, [navPayload?.tripNumber]);

  const selects: SelectFilter[] = [
    {
      value:       estadoFiltro,
      onChange:    setEstadoFiltro,
      placeholder: "Todos los estados",
      ariaLabel:   "Filtrar por estado",
      minWidth:    160,
      options:     Object.entries(ESTADO_CFG).map(([key, cfg]) => ({ value: key, label: cfg.label })),
    },
  ];

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* Header */}
      <PageHeader
        title="Programación"
        subtitle="Bandeja operativa de viajes planeados"
        icon={<CalendarClock className="w-5 h-5" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
            loading={loading}
            onClick={() => cargar()}
          >
            Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Programados hoy"        value={kpis.total}    icon={<CalendarClock className="w-4.5 h-4.5" />} color="var(--navy)"   bg="#DBEAFE"          onClick={() => setTabEstado("todos")}      />
        <KpiCard label="Pendientes por iniciar" value={kpis.pendiente} icon={<Clock         className="w-4.5 h-4.5" />} color="#374151"       bg="var(--gray-100)"  onClick={() => setTabEstado("programado")} />
        <KpiCard label="Activos"                value={kpis.activo}   icon={<Activity      className="w-4.5 h-4.5" />} color="#1D4ED8"       bg="#DBEAFE"          onClick={() => setTabEstado("asignado")}   />
        <KpiCard label="Cancelados"             value={kpis.cancelado} icon={<XCircle       className="w-4.5 h-4.5" />} color="var(--gray-600)" bg="var(--gray-100)" onClick={() => setTabEstado("cancelado")}  />
      </div>

      {/* Filtros */}
      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        searchPlaceholder="Trip, conductor, placa, cliente, ciudad…"
        selects={selects}
        extraFilters={
          <ClienteFilter
            value={clienteFiltro}
            onChange={setClienteFiltro}
            opciones={opcionesCliente}
            minWidth={200}
          />
        }
        fechaDesde={visualDesde}
        fechaHasta={visualHasta}
        onFechaRango={handleFechaRango}
        hayFiltros={hayFiltros}
        onLimpiar={handleLimpiarFiltros}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap" role="tablist">
        {TABS.map((t) => {
          const active = tabEstado === t.id;
          const count  = tabCount(data, t.id);
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTabEstado(t.id as typeof tabEstado)}
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
        {(busqueda || estadoFiltro || clienteFiltro) && (
          <span className="text-[12px]" style={{ color: "var(--gray-400)" }}>
            · {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Bandeja */}
      <Card>
        {error ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--inlop-red)", opacity: 0.5 }} />
            <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
            <button type="button" onClick={() => cargar()} className="mt-3 text-[12px] underline" style={{ color: "var(--navy)" }}>
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
            emptyMessage="No hay viajes programados en el rango seleccionado."
          />
        )}
      </Card>

      {/* Centro Operativo */}
      {panelViaje && (
        <CentroOperativo
          viaje={panelViaje}
          onClose={() => setPanelId(null)}
          onEstado={handleEstado}
          onSync={handleSync}
          accionLoading={accionLoading}
        />
      )}
    </div>
  );
}
