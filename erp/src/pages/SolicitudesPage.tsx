import { useEffect, useState, useMemo } from "react";
import { getSolicitudes, cambiarEstadoSolicitud } from "@/lib/api";
import type { Solicitud } from "@/lib/api";
import {
  RefreshCw, Search, X, ChevronRight,
  Clock, CheckCircle, Truck, XCircle, ClipboardList,
} from "lucide-react";

// ─── Utilidades ──────────────────────────────────────────────────────────────

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function hace7dias() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Badge de estado ─────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "var(--amber)",   bg: "var(--amber-bg)"  },
  aprobado:   { label: "Aprobado",   color: "var(--info)",    bg: "var(--info-bg)"   },
  en_ruta:    { label: "En ruta",    color: "#7C3AED",        bg: "#F5F3FF"          },
  completado: { label: "Completado", color: "var(--success)", bg: "var(--success-bg)"},
  cancelado:  { label: "Cancelado",  color: "var(--inlop-red)", bg: "#FFF1F2"        },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, color: "var(--gray-500)", bg: "var(--gray-100)" };
  return (
    <span
      className="inline-flex items-center font-semibold text-[11px] px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function CanalBadge({ canal }: { canal: string }) {
  const isApp = canal === "APP";
  return (
    <span
      className="inline-flex items-center font-semibold text-[10px] px-2 py-0.5 rounded-full"
      style={{
        background: isApp ? "var(--navy)" : "var(--gray-100)",
        color:      isApp ? "#fff"        : "var(--gray-500)",
      }}
    >
      {canal}
    </span>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, bg, icon }: {
  label: string; value: number; color: string; bg: string; icon: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{ border: "1px solid var(--gray-100)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color }}>
        {icon}
      </div>
      <div>
        <div className="font-bold text-[22px] leading-none" style={{ color: "var(--gray-800)" }}>{value}</div>
        <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-500)" }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Panel detalle ───────────────────────────────────────────────────────────

function PanelDetalle({
  sol, onClose, onEstado,
}: {
  sol: Solicitud;
  onClose: () => void;
  onEstado: (id: string, estado: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const accion = async (estado: string) => {
    setLoading(true);
    await onEstado(sol.id, estado);
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-[420px] bg-white flex flex-col overflow-y-auto"
        style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--gray-100)" }}>
          <div>
            <div className="font-bold text-[16px]" style={{ color: "var(--navy)" }}>
              {sol.codigo_solicitud}
            </div>
            {sol.external_ref && (
              <div className="text-[12px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                Ref: {sol.external_ref}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <EstadoBadge estado={sol.estado} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" style={{ color: "var(--gray-500)" }} />
            </button>
          </div>
        </div>

        {/* Campos */}
        <div className="flex-1 px-6 py-5 flex flex-col gap-4">
          <Row label="Cliente"         value={sol.cliente} />
          <Row label="Agencia"         value={sol.agencia} />
          <Row label="Canal"           value={<CanalBadge canal={sol.canal} />} />
          <Row label="Solicitante"     value={sol.solicitante ?? "—"} />
          <Row label="Vehículo"        value={sol.tipo_vehiculo} />
          <Row label="Operación"       value={sol.tipo_operacion === "urbana" ? "Urbana" : "Nacional"} />
          <Row label="Ruta"            value={`${sol.origen} → ${sol.destino}`} />
          <Row label="Fecha requerida" value={fmtFecha(sol.fecha_requerida)} />
          <Row label="Fecha solicitud" value={fmtFecha(sol.creado_en)} />
        </div>

        {/* Acciones */}
        {(sol.estado === "pendiente" || sol.estado === "aprobado") && (
          <div className="px-6 py-5 flex flex-col gap-2.5" style={{ borderTop: "1px solid var(--gray-100)" }}>
            {sol.estado === "pendiente" && (
              <button
                disabled={loading}
                onClick={() => accion("aprobado")}
                className="w-full font-semibold text-[13px] py-3 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--navy)" }}
              >
                ✓ Aprobar solicitud
              </button>
            )}
            <button
              disabled={loading}
              onClick={() => accion("cancelado")}
              className="w-full font-semibold text-[13px] py-3 rounded-xl transition-all hover:bg-red-50 disabled:opacity-50"
              style={{ border: "1.5px solid #FECDD3", color: "var(--inlop-red)" }}
            >
              ✕ Cancelar solicitud
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[12px] shrink-0" style={{ color: "var(--gray-400)" }}>{label}</span>
      <span className="text-[13px] font-semibold text-right" style={{ color: "var(--gray-700)" }}>{value}</span>
    </div>
  );
}

// ─── Tabs de estado ───────────────────────────────────────────────────────────

const TABS = [
  { id: "todos",      label: "Todos"      },
  { id: "pendiente",  label: "Pendientes" },
  { id: "aprobado",   label: "Aprobados"  },
  { id: "en_ruta",    label: "En ruta"    },
  { id: "completado", label: "Finalizados"},
  { id: "cancelado",  label: "Cancelados" },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export function SolicitudesPage() {
  const [data, setData]       = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [desde, setDesde]     = useState(hace7dias());
  const [hasta, setHasta]     = useState(hoy());
  const [busqueda, setBusqueda] = useState("");
  const [tabEstado, setTabEstado] = useState("todos");
  const [panelId, setPanelId] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSolicitudes(desde, hasta);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [desde, hasta]);

  const handleEstado = async (id: string, estado: string) => {
    try {
      await cambiarEstadoSolicitud(id, estado);
      setData((prev) => prev.map((s) => s.id === id ? { ...s, estado: estado as Solicitud["estado"] } : s));
      if (estado === "cancelado" || estado === "aprobado") setPanelId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
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
    aprobadas:  data.filter((s) => s.estado === "aprobado" || s.estado === "en_ruta").length,
    completadas:data.filter((s) => s.estado === "completado").length,
    canceladas: data.filter((s) => s.estado === "cancelado").length,
  }), [data]);

  const panelSol = panelId ? data.find((s) => s.id === panelId) ?? null : null;

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* Header */}
      <div>
        <h1 className="font-bold text-[22px]" style={{ color: "var(--navy)" }}>Solicitudes</h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--gray-400)" }}>
          Solicitudes entrantes del Portal Cliente
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Recibidas"   value={kpis.recibidas}   color="var(--info)"       bg="var(--info-bg)"    icon={<ClipboardList className="w-4 h-4" />} />
        <KpiCard label="Pendientes"  value={kpis.pendientes}  color="var(--amber)"      bg="var(--amber-bg)"   icon={<Clock         className="w-4 h-4" />} />
        <KpiCard label="En gestión"  value={kpis.aprobadas}   color="var(--navy)"       bg="var(--info-bg)"    icon={<Truck         className="w-4 h-4" />} />
        <KpiCard label="Completadas" value={kpis.completadas} color="var(--success)"    bg="var(--success-bg)" icon={<CheckCircle   className="w-4 h-4" />} />
        <KpiCard label="Canceladas"  value={kpis.canceladas}  color="var(--inlop-red)"  bg="#FFF1F2"           icon={<XCircle       className="w-4 h-4" />} />
      </div>

      {/* Filtros fecha + búsqueda */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-medium" style={{ color: "var(--gray-500)" }}>Desde</label>
          <input
            type="date" value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "8px 12px", color: "var(--gray-700)", background: "#fff" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-medium" style={{ color: "var(--gray-500)" }}>Hasta</label>
          <input
            type="date" value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="text-[13px] outline-none"
            style={{ border: "1.5px solid var(--gray-200)", borderRadius: 10, padding: "8px 12px", color: "var(--gray-700)", background: "#fff" }}
          />
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--navy)" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>

        {/* Búsqueda */}
        <div className="flex-1 min-w-[200px] relative">
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

      {/* Tabs estado */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => {
          const active = tabEstado === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTabEstado(t.id)}
              className="font-semibold text-[12px] px-3.5 py-1.5 rounded-lg transition-all"
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
        {filtradas.length !== data.length && (
          <span className="text-[12px]" style={{ color: "var(--gray-400)" }}>· {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Tabla */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        {error ? (
          <div className="py-16 text-center">
            <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
            <button onClick={cargar} className="mt-3 text-[12px] underline" style={{ color: "var(--navy)" }}>Reintentar</button>
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: "var(--gray-400)" }}>
            Cargando solicitudes…
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-16 text-center text-[13px]" style={{ color: "var(--gray-400)" }}>
            No hay solicitudes en el rango seleccionado.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--gray-100)" }}>
                {["SOL", "Remisión", "Canal", "Cliente", "Agencia", "Vehículo", "Ruta", "Fecha requerida", "Estado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => (
                <tr
                  key={s.id}
                  className="transition-colors hover:bg-gray-50 cursor-pointer"
                  style={{ borderBottom: "1px solid var(--gray-100)" }}
                  onClick={() => setPanelId(s.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-[13px]" style={{ color: "var(--navy)" }}>{s.codigo_solicitud}</div>
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "var(--gray-500)" }}>
                    {s.external_ref ?? "—"}
                  </td>
                  <td className="px-4 py-3"><CanalBadge canal={s.canal} /></td>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "var(--gray-700)" }}>
                    {s.cliente}
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "var(--gray-500)" }}>{s.agencia}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "var(--gray-600)" }}>{s.tipo_vehiculo}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "var(--gray-600)" }}>
                    {s.origen} → {s.destino}
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "var(--gray-500)" }}>
                    {fmtFecha(s.fecha_requerida)}
                  </td>
                  <td className="px-4 py-3"><EstadoBadge estado={s.estado} /></td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Panel detalle */}
      {panelSol && (
        <PanelDetalle
          sol={panelSol}
          onClose={() => setPanelId(null)}
          onEstado={handleEstado}
        />
      )}
    </div>
  );
}
