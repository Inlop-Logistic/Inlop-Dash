import {
  RefreshCw, Search,
  Clock, CheckCircle, Truck, XCircle, ClipboardList, AlertCircle,
} from "lucide-react";
import { KpiCard, PageHeader, Card, DataTable, Button } from "@/components/ui";
import { useSolicitudes } from "./hooks/useSolicitudes";
import { DetalleSolicitud } from "./components/DetalleSolicitud";
import { COLUMNS } from "./components/SolicitudesTableColumns";
import { TABS } from "./constants";

export function SolicitudesPage() {
  const {
    data, loading, error,
    desde, setDesde,
    hasta, setHasta,
    busqueda, setBusqueda,
    tabEstado, setTabEstado,
    setPanelId, panelSol,
    filtradas, kpis,
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
        <KpiCard label="Recibidas"   value={kpis.recibidas}   icon={<ClipboardList className="w-4.5 h-4.5" />} color="#1D4ED8"      bg="#DBEAFE"  onClick={() => setTabEstado("todos")}      />
        <KpiCard label="Pendientes"  value={kpis.pendientes}  icon={<Clock         className="w-4.5 h-4.5" />} color="#B45309"      bg="#FEF3C7"  onClick={() => setTabEstado("pendiente")}  />
        <KpiCard label="En gestión"  value={kpis.enGestion}   icon={<Truck         className="w-4.5 h-4.5" />} color="var(--navy)"  bg="#DBEAFE"  onClick={() => setTabEstado("aprobado")}   />
        <KpiCard label="Completadas" value={kpis.completadas} icon={<CheckCircle   className="w-4.5 h-4.5" />} color="#065F46"      bg="#D1FAE5"  onClick={() => setTabEstado("completado")} />
        <KpiCard label="Canceladas"  value={kpis.canceladas}  icon={<XCircle       className="w-4.5 h-4.5" />} color="#9F1239"      bg="#FFE4E6"  onClick={() => setTabEstado("cancelado")}  />
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
