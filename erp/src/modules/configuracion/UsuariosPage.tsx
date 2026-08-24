import { Users, AlertCircle } from "lucide-react";
import { PageHeader, FilterBar, DataTable, Badge, SidePanel, PanelSection, InfoRow } from "@/components/ui";
import type { Column } from "@/components/ui";
import { formatFechaCorta } from "./types";
import type { UsuarioRbac } from "./types";
import { useUsuarios } from "./hooks/useUsuarios";

interface Props {
  onBack: () => void;
}

// ── Empty state — mismo patrón visual que ReportesAutomaticosPage ───────────

function EmptyState({ conFiltro }: { conFiltro: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-[var(--radius-2xl)] gap-3"
      style={{ border: "1.5px dashed var(--gray-200)", background: "var(--gray-50)" }}
    >
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center"
        style={{ background: "var(--gray-100)" }}
      >
        <Users className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
      </div>
      {conFiltro ? (
        <>
          <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>Sin resultados</p>
          <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>
            Ningún usuario coincide con la búsqueda o el filtro.
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>No hay usuarios</p>
          <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>
            Todavía no hay usuarios registrados en el ERP.
          </p>
        </>
      )}
    </div>
  );
}

// ── Columnas de la tabla ──────────────────────────────────────────────────────

function buildColumns(): Column<UsuarioRbac>[] {
  return [
    {
      key:    "nombre",
      header: "Nombre",
      width:  "220px",
      render: (u) => (
        <span className="font-medium text-[13px]" style={{ color: "var(--gray-800)" }}>
          {u.nombre || "—"}
        </span>
      ),
    },
    {
      key:    "email",
      header: "Email",
      width:  "240px",
      render: (u) => (
        <span className="text-[13px]" style={{ color: "var(--gray-600)" }}>{u.email || "—"}</span>
      ),
    },
    {
      key:    "roles_rbac",
      header: "Rol RBAC",
      width:  "220px",
      render: (u) => (
        u.roles_rbac.length === 0 ? (
          <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>Sin roles asignados</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {u.roles_rbac.map(r => (
              <Badge key={r.id} variant={r.nombre === "master" ? "purple" : "info"}>{r.nombre}</Badge>
            ))}
          </div>
        )
      ),
    },
    {
      key:    "activo",
      header: "Estado",
      width:  "100px",
      render: (u) => (
        <Badge variant={u.activo ? "success" : "default"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
      ),
    },
    {
      key:    "created_at",
      header: "Creado",
      width:  "110px",
      render: (u) => (
        <span className="text-[13px]" style={{ color: "var(--gray-400)" }}>{formatFechaCorta(u.created_at)}</span>
      ),
    },
  ];
}

// ── Página principal ──────────────────────────────────────────────────────────

export function UsuariosPage({ onBack }: Props) {
  const {
    filtrados, loading, error, cargar,
    busqueda, setBusqueda,
    filtroEstado, setFiltroEstado,
    panelId, setPanelId, panelUsuario,
  } = useUsuarios();

  const columns = buildColumns();
  const hayBusqueda = busqueda.trim().length > 0;
  const hayFiltros  = hayBusqueda || filtroEstado !== "";

  return (
    <div className="p-6 flex flex-col gap-6">

      {/* Migas de pan interna */}
      <nav aria-label="Ruta interna" className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--gray-400)" }}>
        <button
          type="button"
          onClick={onBack}
          className="hover:underline focus-visible:outline-none"
          style={{ color: "var(--gray-500)" }}
        >
          Parámetros
        </button>
        <span aria-hidden="true">›</span>
        <span style={{ color: "var(--gray-700)", fontWeight: 600 }}>Usuarios</span>
      </nav>

      <PageHeader
        title="Usuarios"
        subtitle="Usuarios del ERP y sus roles RBAC actuales."
        icon={<Users className="w-5 h-5" />}
      />

      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        searchPlaceholder="Buscar por nombre o email..."
        selects={[
          {
            value:       filtroEstado,
            onChange:    (v) => setFiltroEstado(v as "" | "activo" | "inactivo"),
            placeholder: "Todos los estados",
            options: [
              { value: "activo",   label: "Activo" },
              { value: "inactivo", label: "Inactivo" },
            ],
            ariaLabel: "Filtrar por estado",
          },
        ]}
        hayFiltros={hayFiltros}
        onLimpiar={hayFiltros ? () => { setBusqueda(""); setFiltroEstado(""); } : undefined}
      />

      {error ? (
        <div className="py-16 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--inlop-red)", opacity: 0.5 }} />
          <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
          <button type="button" onClick={cargar} className="mt-3 text-[12px] underline" style={{ color: "var(--navy)" }}>
            Reintentar
          </button>
        </div>
      ) : !loading && filtrados.length === 0 ? (
        <EmptyState conFiltro={hayFiltros} />
      ) : (
        <DataTable<UsuarioRbac>
          columns={columns}
          rows={filtrados}
          rowKey={(u) => u.id}
          onRowClick={(u) => setPanelId(u.id)}
          loading={loading}
          emptyMessage="Sin usuarios"
        />
      )}

      {/* Panel de solo lectura — sin edición en este sprint */}
      <SidePanel
        open={panelId !== null}
        onClose={() => setPanelId(null)}
        title="Detalle de usuario"
        subtitle={panelUsuario?.nombre}
        width="420px"
      >
        {panelUsuario && (
          <div>
            <PanelSection first>
              <InfoRow label="Nombre" value={panelUsuario.nombre || "—"} />
              <InfoRow label="Email" value={panelUsuario.email || "—"} />
              <InfoRow label="Estado" value={
                <Badge variant={panelUsuario.activo ? "success" : "default"}>
                  {panelUsuario.activo ? "Activo" : "Inactivo"}
                </Badge>
              } />
              <InfoRow label="Creado" value={formatFechaCorta(panelUsuario.created_at)} />
            </PanelSection>

            <PanelSection title="Roles RBAC">
              {panelUsuario.roles_rbac.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>Sin roles asignados.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {panelUsuario.roles_rbac.map(r => (
                    <Badge key={r.id} variant={r.nombre === "master" ? "purple" : "info"}>{r.nombre}</Badge>
                  ))}
                </div>
              )}
            </PanelSection>

            {/* Rol legacy — solo contexto de migración, NUNCA fuente de
                permisos (ver types.ts, UsuarioRbac.rol). */}
            <PanelSection title="Rol legacy (pre-migración)">
              <p className="text-[12px]" style={{ color: "var(--gray-400)" }}>
                {panelUsuario.rol || "—"} — campo histórico de <code>profiles.rol</code>,
                mostrado solo como referencia. No determina permisos.
              </p>
            </PanelSection>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
