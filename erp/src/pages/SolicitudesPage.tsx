import { useEffect, useState, useMemo } from "react";
import {
  getSolicitudes, getSolicitudDetalle, cambiarEstadoSolicitud,
} from "@/lib/api";
import type { Solicitud, SolicitudDetalle, HistorialEstado } from "@/lib/api";
import {
  RefreshCw, Search, ChevronRight,
  Clock, CheckCircle, Truck, XCircle, ClipboardList,
  User, Car, MapPin, Calendar, FileText, AlertCircle,
} from "lucide-react";
import {
  EstadoBadge, CanalBadge, ESTADO_CFG,
  KpiCard, PageHeader, Card,
  SidePanel, PanelSection, InfoRow,
  Button,
} from "@/components/ui";
import { DataTable } from "@/components/ui";
import type { Column } from "@/components/ui";

// ── Utilidades ─────────────────────────────────────────────────────────────────

function hoy() { return new Date().toISOString().slice(0, 10); }

function hace7dias() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtFechaCort(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Timeline de estados ────────────────────────────────────────────────────────

const ESTADO_FLOW = ["pendiente", "aprobado", "en_ruta", "completado"] as const;

function Timeline({ historial, estadoActual }: {
  historial: HistorialEstado[];
  estadoActual: string;
}) {
  const isCancelado = estadoActual === "cancelado";

  if (isCancelado) {
    const entrada = historial.find((h) => h.estado === "cancelado");
    return (
      <div className="flex items-start gap-3">
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "#FFE4E6" }}
        >
          <XCircle className="w-3.5 h-3.5" style={{ color: "#E30613" }} />
        </div>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "#9F1239" }}>Cancelado</div>
          {entrada && (
            <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-400)" }}>
              {fmtFecha(entrada.cambiado_en)}
              {entrada.cambiado_por ? ` · ${entrada.cambiado_por}` : ""}
            </div>
          )}
          {entrada?.notas && (
            <div className="text-[12px] mt-1 px-2.5 py-1.5 rounded-lg" style={{ background: "#FFF1F2", color: "#9F1239" }}>
              {entrada.notas}
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentIdx = ESTADO_FLOW.indexOf(estadoActual as typeof ESTADO_FLOW[number]);

  return (
    <div className="flex flex-col gap-0">
      {ESTADO_FLOW.map((estado, idx) => {
        const done    = idx <= currentIdx;
        const active  = idx === currentIdx;
        const isLast  = idx === ESTADO_FLOW.length - 1;
        const entrada = historial.find((h) => h.estado === estado);
        const cfg     = ESTADO_CFG[estado];

        return (
          <div key={estado} className="flex items-start gap-3">
            {/* Línea + dot */}
            <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center z-10"
                style={{
                  background: done ? (active ? cfg.bg : "#D1FAE5") : "var(--gray-100)",
                  border: active ? `2px solid ${cfg.dot}` : "2px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                {done && !active && (
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "#059669" }} />
                )}
                {active && (
                  <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                )}
                {!done && (
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--gray-300)" }} />
                )}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 flex-1 min-h-[20px]"
                  style={{ background: done && !active ? "#D1FAE5" : "var(--gray-100)", marginTop: 2 }}
                />
              )}
            </div>

            {/* Texto */}
            <div className="pb-4 min-w-0 flex-1">
              <div
                className="text-[13px] font-semibold"
                style={{ color: active ? cfg.color : done ? "var(--gray-700)" : "var(--gray-300)" }}
              >
                {cfg?.label ?? estado}
              </div>
              {entrada ? (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                  {fmtFecha(entrada.cambiado_en)}
                  {entrada.cambiado_por ? ` · ${entrada.cambiado_por}` : ""}
                </div>
              ) : (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-300)" }}>
                  {done ? "Completado" : "Pendiente"}
                </div>
              )}
              {entrada?.notas && (
                <div className="text-[11px] mt-1 italic" style={{ color: "var(--gray-400)" }}>
                  {entrada.notas}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Panel de detalle completo ──────────────────────────────────────────────────

function DetalleSolicitud({
  solicitud,
  onClose,
  onEstado,
}: {
  solicitud: Solicitud;
  onClose: () => void;
  onEstado: (id: string, estado: string) => Promise<void>;
}) {
  const [detalle, setDetalle] = useState<SolicitudDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(true);
  const [accionLoading, setAccionLoading] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  useEffect(() => {
    setLoadingDetalle(true);
    setErrorDetalle(null);
    getSolicitudDetalle(solicitud.id)
      .then(setDetalle)
      .catch((e) => {
        setErrorDetalle(e instanceof Error ? e.message : "Error al cargar detalle");
        setDetalle(null);
      })
      .finally(() => setLoadingDetalle(false));
  }, [solicitud.id]);

  const accion = async (estado: string) => {
    setAccionLoading(true);
    try {
      await onEstado(solicitud.id, estado);
    } finally {
      setAccionLoading(false);
    }
  };

  const d = detalle;
  const tieneCondutor = d?.conductor_nombre;
  const tieneVehiculo = d?.vehiculo_placa;
  const historial     = d?.historial ?? [];

  const footer = (solicitud.estado === "pendiente" || solicitud.estado === "aprobado") ? (
    <div className="px-6 py-4 flex flex-col gap-2.5">
      {solicitud.estado === "pendiente" && (
        <Button
          variant="primary"
          size="lg"
          className="w-full justify-center"
          loading={accionLoading}
          onClick={() => accion("aprobado")}
        >
          ✓ Aprobar solicitud
        </Button>
      )}
      <Button
        variant="danger"
        size="lg"
        className="w-full justify-center"
        loading={accionLoading}
        onClick={() => accion("cancelado")}
      >
        ✕ Cancelar solicitud
      </Button>
    </div>
  ) : null;

  return (
    <SidePanel
      open
      onClose={onClose}
      title={solicitud.codigo_solicitud}
      subtitle={solicitud.external_ref ? `Ref. ${solicitud.external_ref}` : undefined}
      headerRight={<EstadoBadge estado={solicitud.estado} />}
      footer={footer}
      width="480px"
    >
      {/* Info del cliente */}
      <PanelSection title="Cliente y solicitud" icon={<FileText className="w-3.5 h-3.5" />} first>
        <InfoRow label="Cliente"     value={solicitud.cliente} />
        <InfoRow label="Agencia"     value={solicitud.agencia} />
        <InfoRow label="Canal"       value={<CanalBadge canal={solicitud.canal} />} />
        <InfoRow label="Solicitante" value={solicitud.solicitante} />
        <InfoRow label="Operación"   value={solicitud.tipo_operacion === "urbana" ? "Urbana" : "Nacional"} />
        {d?.notas && (
          <div
            className="mt-3 text-[12px] px-3 py-2.5 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-600)", border: "1px solid var(--gray-100)" }}
          >
            {d.notas}
          </div>
        )}
      </PanelSection>

      {/* Ruta y fechas */}
      <PanelSection title="Ruta y fechas" icon={<MapPin className="w-3.5 h-3.5" />}>
        {/* Visual origen → destino */}
        <div
          className="flex items-center gap-2 mb-4 px-3 py-3 rounded-xl"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
        >
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--navy)" }} />
            <div className="w-0.5 h-5" style={{ background: "var(--gray-200)" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--inlop-red)" }} />
          </div>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Origen</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{solicitud.origen}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{solicitud.destino}</div>
            </div>
          </div>
          {d?.distancia_km && (
            <div className="shrink-0 text-right">
              <div className="text-[18px] font-bold" style={{ color: "var(--navy)" }}>{d.distancia_km}</div>
              <div className="text-[10px]" style={{ color: "var(--gray-400)" }}>km</div>
            </div>
          )}
        </div>

        <InfoRow label="Tipo vehículo"  value={solicitud.tipo_vehiculo} />
        <InfoRow label="Fecha requerida" value={fmtFecha(solicitud.fecha_requerida)} />
        {d?.fecha_inicio_ruta && <InfoRow label="Inicio ruta"    value={fmtFecha(d.fecha_inicio_ruta)} />}
        {d?.fecha_fin_ruta    && <InfoRow label="Fin de ruta"    value={fmtFecha(d.fecha_fin_ruta)}    />}
        <InfoRow label="Creada"          value={fmtFecha(solicitud.creado_en)} />
        {d?.actualizado_en    && <InfoRow label="Actualizada"    value={fmtFecha(d.actualizado_en)}    />}
      </PanelSection>

      {/* Conductor */}
      <PanelSection title="Conductor asignado" icon={<User className="w-3.5 h-3.5" />}>
        {loadingDetalle ? (
          <div className="text-[12px] py-2" style={{ color: "var(--gray-300)" }}>Cargando…</div>
        ) : errorDetalle ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--gray-400)" }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            No se pudo obtener información adicional
          </div>
        ) : tieneCondutor ? (
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {d!.conductor_nombre!.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold" style={{ color: "var(--gray-800)" }}>{d!.conductor_nombre}</div>
              {d?.conductor_cedula   && <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>CC {d.conductor_cedula}</div>}
              {d?.conductor_telefono && <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>📞 {d.conductor_telefono}</div>}
              {d?.conductor_licencia && <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>Lic. {d.conductor_licencia}</div>}
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            Sin conductor asignado aún
          </div>
        )}
      </PanelSection>

      {/* Vehículo */}
      <PanelSection title="Vehículo asignado" icon={<Car className="w-3.5 h-3.5" />}>
        {loadingDetalle ? (
          <div className="text-[12px] py-2" style={{ color: "var(--gray-300)" }}>Cargando…</div>
        ) : tieneVehiculo ? (
          <div
            className="p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="text-[18px] font-bold tracking-widest"
                  style={{ color: "var(--navy)", fontFamily: "monospace" }}
                >
                  {d!.vehiculo_placa}
                </div>
                {d?.vehiculo_tipo && (
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--gray-500)" }}>{d.vehiculo_tipo}</div>
                )}
              </div>
              {d?.vehiculo_capacidad && (
                <div className="text-right">
                  <div className="text-[16px] font-bold" style={{ color: "var(--gray-700)" }}>{d.vehiculo_capacidad}</div>
                  <div className="text-[10px]" style={{ color: "var(--gray-400)" }}>capacidad</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
          >
            <Car className="w-3.5 h-3.5 shrink-0" />
            Sin vehículo asignado aún
          </div>
        )}
      </PanelSection>

      {/* Timeline */}
      <PanelSection title="Historial de estados" icon={<Calendar className="w-3.5 h-3.5" />}>
        {loadingDetalle ? (
          <div className="text-[12px] py-2" style={{ color: "var(--gray-300)" }}>Cargando historial…</div>
        ) : (
          <Timeline historial={historial} estadoActual={solicitud.estado} />
        )}
      </PanelSection>
    </SidePanel>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "todos",      label: "Todos"      },
  { id: "pendiente",  label: "Pendientes" },
  { id: "aprobado",   label: "Aprobados"  },
  { id: "en_ruta",    label: "En ruta"    },
  { id: "completado", label: "Finalizados"},
  { id: "cancelado",  label: "Cancelados" },
];

// ── Columnas de tabla ──────────────────────────────────────────────────────────

const COLUMNS: Column<Solicitud>[] = [
  {
    key: "codigo",
    header: "SOL",
    width: "110px",
    render: (s) => (
      <div className="font-bold text-[13px]" style={{ color: "var(--navy)" }}>
        {s.codigo_solicitud}
      </div>
    ),
  },
  {
    key: "remision",
    header: "Remisión",
    width: "100px",
    render: (s) => (
      <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
        {s.external_ref ?? "—"}
      </span>
    ),
  },
  {
    key: "canal",
    header: "Canal",
    width: "70px",
    render: (s) => <CanalBadge canal={s.canal} />,
  },
  {
    key: "cliente",
    header: "Cliente",
    render: (s) => (
      <div>
        <div className="text-[13px] font-medium" style={{ color: "var(--gray-700)" }}>{s.cliente}</div>
        <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>{s.agencia}</div>
      </div>
    ),
  },
  {
    key: "vehiculo",
    header: "Vehículo",
    width: "110px",
    render: (s) => (
      <span className="text-[12px]" style={{ color: "var(--gray-600)" }}>{s.tipo_vehiculo}</span>
    ),
  },
  {
    key: "ruta",
    header: "Ruta",
    render: (s) => (
      <div className="text-[12px]" style={{ color: "var(--gray-600)" }}>
        <div className="font-medium">{s.origen}</div>
        <div style={{ color: "var(--gray-400)" }}>→ {s.destino}</div>
      </div>
    ),
  },
  {
    key: "fecha",
    header: "F. requerida",
    width: "120px",
    render: (s) => (
      <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
        {fmtFechaCort(s.fecha_requerida)}
      </span>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    width: "120px",
    render: (s) => <EstadoBadge estado={s.estado} />,
  },
  {
    key: "arrow",
    header: "",
    width: "32px",
    render: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
  },
];

// ── Página principal ───────────────────────────────────────────────────────────

export function SolicitudesPage() {
  const [data, setData]           = useState<Solicitud[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [desde, setDesde]         = useState(hace7dias());
  const [hasta, setHasta]         = useState(hoy());
  const [busqueda, setBusqueda]   = useState("");
  const [tabEstado, setTabEstado] = useState("todos");
  const [panelId, setPanelId]     = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getSolicitudes(desde, hasta));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [desde, hasta]);

  const handleEstado = async (id: string, estado: string) => {
    await cambiarEstadoSolicitud(id, estado);
    setData((prev) =>
      prev.map((s) => s.id === id ? { ...s, estado: estado as Solicitud["estado"] } : s)
    );
    setPanelId(null);
  };

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return data.filter((s) => {
      if (tabEstado !== "todos" && s.estado !== tabEstado) return false;
      if (!term) return true;
      return (
        s.codigo_solicitud.toLowerCase().includes(term) ||
        s.cliente.toLowerCase().includes(term) ||
        s.agencia.toLowerCase().includes(term) ||
        (s.external_ref ?? "").toLowerCase().includes(term) ||
        s.origen.toLowerCase().includes(term) ||
        s.destino.toLowerCase().includes(term)
      );
    });
  }, [data, tabEstado, busqueda]);

  const kpis = useMemo(() => ({
    recibidas:  data.length,
    pendientes: data.filter((s) => s.estado === "pendiente").length,
    enGestion:  data.filter((s) => s.estado === "aprobado" || s.estado === "en_ruta").length,
    completadas: data.filter((s) => s.estado === "completado").length,
    canceladas: data.filter((s) => s.estado === "cancelado").length,
  }), [data]);

  const panelSol = panelId ? data.find((s) => s.id === panelId) ?? null : null;

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* Header */}
      <PageHeader
        title="Solicitudes"
        subtitle="Solicitudes entrantes del Portal Cliente"
        icon={<ClipboardList className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
              loading={loading}
              onClick={cargar}
            >
              Actualizar
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Recibidas"
          value={kpis.recibidas}
          icon={<ClipboardList className="w-4.5 h-4.5" />}
          color="#1D4ED8" bg="#DBEAFE"
          onClick={() => setTabEstado("todos")}
        />
        <KpiCard
          label="Pendientes"
          value={kpis.pendientes}
          icon={<Clock className="w-4.5 h-4.5" />}
          color="#B45309" bg="#FEF3C7"
          onClick={() => setTabEstado("pendiente")}
        />
        <KpiCard
          label="En gestión"
          value={kpis.enGestion}
          icon={<Truck className="w-4.5 h-4.5" />}
          color="var(--navy)" bg="#DBEAFE"
          onClick={() => setTabEstado("aprobado")}
        />
        <KpiCard
          label="Completadas"
          value={kpis.completadas}
          icon={<CheckCircle className="w-4.5 h-4.5" />}
          color="#065F46" bg="#D1FAE5"
          onClick={() => setTabEstado("completado")}
        />
        <KpiCard
          label="Canceladas"
          value={kpis.canceladas}
          icon={<XCircle className="w-4.5 h-4.5" />}
          color="#9F1239" bg="#FFE4E6"
          onClick={() => setTabEstado("cancelado")}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-medium whitespace-nowrap" style={{ color: "var(--gray-500)" }}>Desde</label>
          <input
            type="date" value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "7px 12px", color: "var(--gray-700)", background: "#fff" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-medium whitespace-nowrap" style={{ color: "var(--gray-500)" }}>Hasta</label>
          <input
            type="date" value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "7px 12px", color: "var(--gray-700)", background: "#fff" }}
          />
        </div>

        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-400)" }} />
          <input
            type="text" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="SOL, cliente, agencia, ruta…"
            className="w-full text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "8px 12px 8px 36px", color: "var(--gray-700)", background: "#fff" }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => {
          const active = tabEstado === t.id;
          const count  = t.id === "todos"
            ? data.length
            : data.filter((s) => s.estado === t.id).length;
          return (
            <button
              key={t.id}
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
            <button onClick={cargar} className="mt-3 text-[12px] underline" style={{ color: "var(--navy)" }}>
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
