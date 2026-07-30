import { useState, useEffect, useRef, useMemo } from "react";
import {
  RefreshCw, CalendarClock, Clock, Activity, XCircle, AlertCircle,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
} from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button, FilterBar, ClienteFilter } from "@/components/ui";
import type { SelectFilter } from "@/components/ui";
import { useNavigationContext } from "@/core/navigation";
import { fechaHoyColombia, sumarDias } from "@/utils/date";
import { useProgramacion } from "./hooks/useProgramacion";
import { CentroOperativo } from "./components/CentroOperativo";
import { COLUMNS } from "./components/ProgramacionTableColumns";
import { TABS, tabCount, ESTADO_CFG } from "./constants";

const TAM_PAGINA = 25;

// Nombres de empresa que son placeholders internos y no deben aparecer en el filtro
const CLIENTES_INTERNOS = new Set([
  "integral logistic operations",
  "integral logistics operations sas",
  "inlop",
]);

function esClienteInterno(nombre: string | null | undefined): boolean {
  if (!nombre?.trim()) return true;
  return CLIENTES_INTERNOS.has(nombre.trim().toLowerCase());
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

/** Botón de acceso rápido de fecha (Hoy / Mañana) */
function AccesoRapido({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-medium px-3 py-2 rounded-xl transition-colors"
      style={{
        border:     `1.5px solid ${active ? "var(--navy)" : "var(--gray-200)"}`,
        color:      active ? "var(--navy)" : "var(--gray-600)",
        background: active ? "#EEF2FF" : "#fff",
        fontWeight: active ? 600 : 400,
        cursor:     "pointer",
      }}
    >
      {label}
    </button>
  );
}

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
    filtradas_base, filtradas, kpis,
    pagina, setPagina, totalPaginas, paginadas,
    hayFiltros, limpiarFiltros,
    cargar, handleEstado, handleSync,
  } = useProgramacion();

  // Estado visual del DatePicker — vacío al inicio: el rango operativo no es un filtro de usuario.
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

  // Fechas de acceso rápido (calculadas en hora Colombia)
  const hoy    = fechaHoyColombia();
  const manana = sumarDias(hoy, 1);

  const activoHoy    = visualDesde === hoy    && visualHasta === hoy;
  const activoManana = visualDesde === manana && visualHasta === manana;

  // Clientes únicos — excluye placeholders internos, derivados del dataset raw
  const opcionesCliente = useMemo(() => {
    const seen   = new Set<string>();
    const result: string[] = [];
    for (const v of data) {
      const n = v.nombre_cliente || v.company_customer_name;
      if (n && !esClienteInterno(n) && !seen.has(n)) {
        seen.add(n);
        result.push(n);
      }
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

  const start = filtradas.length === 0 ? 0 : (pagina - 1) * TAM_PAGINA + 1;
  const end   = Math.min(pagina * TAM_PAGINA, filtradas.length);

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

      {/* KPIs — calculados sobre filtradas_base (todos los filtros excepto tab) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Viajes programados"   value={kpis.total}    icon={<CalendarClock className="w-4.5 h-4.5" />} color="var(--navy)"    bg="#DBEAFE"          onClick={() => setTabEstado("todos")}      />
        <KpiCard label="Pendientes por iniciar" value={kpis.pendiente} icon={<Clock       className="w-4.5 h-4.5" />} color="#374151"        bg="var(--gray-100)"  onClick={() => setTabEstado("todos")}      />
        <KpiCard label="Viajes activos"        value={kpis.activo}   icon={<Activity      className="w-4.5 h-4.5" />} color="#1D4ED8"        bg="#DBEAFE"          onClick={() => setTabEstado("asignado")}   />
        <KpiCard label="Cancelados"            value={kpis.cancelado} icon={<XCircle      className="w-4.5 h-4.5" />} color="var(--gray-600)" bg="var(--gray-100)" onClick={() => setTabEstado("cancelado")}  />
      </div>

      {/* Filtros */}
      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        searchPlaceholder="Trip, conductor, placa, cliente, ciudad…"
        selects={selects}
        extraFilters={
          <>
            <ClienteFilter
              value={clienteFiltro}
              onChange={setClienteFiltro}
              opciones={opcionesCliente}
              minWidth={200}
            />
            {/* Accesos rápidos — se ubican junto al DatePicker */}
            <AccesoRapido label="Hoy"    active={activoHoy}    onClick={() => handleFechaRango(hoy, hoy)}       />
            <AccesoRapido label="Mañana" active={activoManana} onClick={() => handleFechaRango(manana, manana)} />
          </>
        }
        fechaDesde={visualDesde}
        fechaHasta={visualHasta}
        onFechaRango={handleFechaRango}
        hayFiltros={hayFiltros}
        onLimpiar={handleLimpiarFiltros}
      />

      {/* Chips de estado — conteos sobre filtradas_base */}
      <div className="flex items-center gap-1.5 flex-wrap" role="tablist">
        {TABS.map((t) => {
          const active = tabEstado === t.id;
          const count  = tabCount(filtradas_base, t.id);
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
              <span
                className="text-[10px] font-bold min-w-[16px] text-center px-1 rounded-full"
                style={{
                  background: active ? "rgba(255,255,255,0.2)" : "var(--gray-100)",
                  color:      active ? "#fff" : "var(--gray-500)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
        {hayFiltros && (
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
          <>
            <DataTable
              columns={COLUMNS}
              rows={paginadas}
              rowKey={(v) => v.trip_number}
              onRowClick={(v) => setPanelId(v.trip_number)}
              loading={loading}
              emptyMessage="No hay viajes en la bandeja operativa."
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
                  <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
                    Página {pagina} de {totalPaginas}
                  </span>
                  <div className="flex items-center gap-1">
                    <PaginaBtn icon={<ChevronFirst className="w-3.5 h-3.5" />} onClick={() => setPagina(1)}             disabled={pagina === 1}           label="Primera página"   />
                    <PaginaBtn icon={<ChevronLeft  className="w-3.5 h-3.5" />} onClick={() => setPagina(p => p - 1)}   disabled={pagina === 1}           label="Página anterior"  />
                    <PaginaBtn icon={<ChevronRight className="w-3.5 h-3.5" />} onClick={() => setPagina(p => p + 1)}   disabled={pagina === totalPaginas} label="Página siguiente" />
                    <PaginaBtn icon={<ChevronLast  className="w-3.5 h-3.5" />} onClick={() => setPagina(totalPaginas)} disabled={pagina === totalPaginas} label="Última página"    />
                  </div>
                </div>
              </div>
            )}
          </>
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
