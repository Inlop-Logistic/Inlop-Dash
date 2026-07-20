import { Building2, Users, AlertTriangle, UserCheck, UserX } from "lucide-react";
import { PageHeader, KpiCard, Card, DataTable } from "@/components/ui";
import { ClienteQuickView } from "./ClienteQuickView";
import { COLUMNS } from "./ClientesTableColumns";
import { TABS_LISTADO } from "../constants";
import type { useClientes } from "../hooks/useClientes";

type ClientesState = ReturnType<typeof useClientes>;

interface ClientesListPageProps {
  state: ClientesState;
  onOpenWorkspace: (id: string) => void;
}

export function ClientesListPage({ state, onOpenWorkspace }: ClientesListPageProps) {
  const {
    loading, error, filtrados, kpis,
    busqueda, setBusqueda,
    tabEstado, setTabEstado,
    estadoFiltro, setEstadoFiltro,
    clasificacionFiltro, setClasificacion,
    panelId, setPanelId, panelCliente,
    cargar, getTabCount,
  } = state;

  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader
        title="Maestro de Clientes"
        subtitle="Gestión centralizada de empresas cliente del ERP INLOP"
        actions={
          <button
            onClick={cargar}
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--gray-500)",
              background: "none",
              border: "1px solid var(--gray-200)",
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Actualizar
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <KpiCard
          label="Total Clientes"
          value={kpis.total}
          icon={<Building2 className="w-5 h-5" />}
          color="var(--navy)"
          bg="#EFF6FF"
        />
        <KpiCard
          label="Activos"
          value={kpis.activos}
          icon={<UserCheck className="w-5 h-5" />}
          color="#16A34A"
          bg="#F0FDF4"
        />
        <KpiCard
          label="Inactivos"
          value={kpis.inactivos}
          icon={<UserX className="w-5 h-5" />}
          color="var(--gray-500)"
          bg="var(--gray-50)"
        />
        <KpiCard
          label="Suspendidos"
          value={kpis.suspendidos}
          icon={<Users className="w-5 h-5" />}
          color="#D97706"
          bg="#FFFBEB"
        />
        <KpiCard
          label="Con Alertas"
          value={kpis.con_alertas}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="#DC2626"
          bg="#FEF2F2"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por razón social, NIT, ciudad, ejecutivo…"
          style={{
            flex: "1 1 260px",
            minWidth: 200,
            maxWidth: 420,
            fontSize: "var(--text-sm)",
            color: "var(--gray-700)",
            border: "1px solid var(--gray-200)",
            borderRadius: 8,
            padding: "8px 12px",
            outline: "none",
            background: "#fff",
          }}
        />
        <select
          value={estadoFiltro}
          onChange={e => setEstadoFiltro(e.target.value)}
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--gray-700)",
            border: "1px solid var(--gray-200)",
            borderRadius: 8,
            padding: "8px 12px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="suspendido">Suspendido</option>
          <option value="prospecto">Prospecto</option>
        </select>
        <select
          value={clasificacionFiltro}
          onChange={e => setClasificacion(e.target.value)}
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--gray-700)",
            border: "1px solid var(--gray-200)",
            borderRadius: 8,
            padding: "8px 12px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">Toda clasificación ABC</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </div>

      {/* Status tabs */}
      <div
        role="tablist"
        className="flex items-end overflow-x-auto"
        style={{ scrollbarWidth: "none", borderBottom: "1px solid var(--gray-200)", gap: 0 }}
      >
        {TABS_LISTADO.map(tab => {
          const active = tabEstado === tab.id;
          const count = getTabCount(tab.id);
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTabEstado(tab.id)}
              className="shrink-0 font-medium whitespace-nowrap transition-all duration-150"
              style={{
                fontSize: "var(--text-sm)",
                padding: "10px 16px",
                borderBottom: active ? "2px solid var(--navy)" : "2px solid transparent",
                color: active ? "var(--navy)" : "var(--gray-500)",
                background: "transparent",
                fontWeight: active ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.label}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: "10px",
                  background: active ? "var(--navy)" : "var(--gray-100)",
                  color: active ? "#fff" : "var(--gray-500)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: "#FEF2F2", color: "#DC2626", fontSize: "var(--text-sm)" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <Card>
        <DataTable
          columns={COLUMNS}
          rows={filtrados}
          rowKey={r => r.id}
          loading={loading}
          emptyMessage="No se encontraron clientes con los filtros seleccionados"
          onRowClick={r => setPanelId(r.id)}
        />
      </Card>

      {/* Quick View Panel */}
      {panelCliente && (
        <ClienteQuickView
          cliente={panelCliente}
          onClose={() => setPanelId(null)}
          onOpenWorkspace={() => {
            setPanelId(null);
            onOpenWorkspace(panelCliente.id);
          }}
        />
      )}
    </div>
  );
}
