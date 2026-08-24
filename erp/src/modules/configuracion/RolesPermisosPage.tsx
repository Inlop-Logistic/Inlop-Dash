import { ShieldCheck, KeyRound, AlertCircle } from "lucide-react";
import {
  PageHeader, DataTable, Badge, SidePanel, PanelSection, InfoRow, KpiCard, Button,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import type { RolRbac, PermisoRbac } from "./types";
import { useRolesPermisos, type PestanaRolesPermisos } from "./hooks/useRolesPermisos";

interface Props {
  onBack: () => void;
}

// ── Bloque de error — mismo patrón real que CumplidosPage ────────────────────

function BloqueError({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="py-16 text-center">
      <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--inlop-red)", opacity: 0.5 }} />
      <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>{mensaje}</p>
      <button type="button" onClick={onReintentar} className="mt-3 text-[12px] underline" style={{ color: "var(--navy)" }}>
        Reintentar
      </button>
    </div>
  );
}

// ── Segmented control Roles | Permisos — construido sobre Button existente,
// sin componente ni librería nueva (diseño 3D-4 aprobado, sección C). ───────

function SegmentedControl({
  pestana, onCambiar,
}: {
  pestana: PestanaRolesPermisos;
  onCambiar: (p: PestanaRolesPermisos) => void;
}) {
  return (
    <div className="inline-flex p-1 rounded-xl gap-1" style={{ background: "var(--gray-100)" }}>
      <Button
        type="button"
        size="sm"
        variant={pestana === "roles" ? "primary" : "ghost"}
        onClick={() => onCambiar("roles")}
      >
        Roles
      </Button>
      <Button
        type="button"
        size="sm"
        variant={pestana === "permisos" ? "primary" : "ghost"}
        onClick={() => onCambiar("permisos")}
      >
        Permisos
      </Button>
    </div>
  );
}

// ── Columnas — Roles ──────────────────────────────────────────────────────────

const COLUMNS_ROLES: Column<RolRbac>[] = [
  {
    key: "nombre", header: "Nombre", width: "160px",
    render: (r) => (
      <span className="font-medium text-[13px]" style={{ color: "var(--gray-800)" }}>{r.nombre}</span>
    ),
  },
  {
    key: "descripcion", header: "Descripción", width: "auto",
    render: (r) => <span className="text-[13px]" style={{ color: "var(--gray-600)" }}>{r.descripcion || "—"}</span>,
  },
  {
    key: "es_sistema", header: "Sistema", width: "100px", align: "center",
    render: (r) => r.es_sistema ? <Badge variant="purple">Sistema</Badge> : <span style={{ color: "var(--gray-300)" }}>—</span>,
  },
  {
    key: "activo", header: "Estado", width: "100px",
    render: (r) => <Badge variant={r.activo ? "success" : "default"}>{r.activo ? "Activo" : "Inactivo"}</Badge>,
  },
  {
    key: "usuarios_asignados", header: "Usuarios", width: "100px", align: "right",
    render: (r) => (
      <span className="text-[13px] font-semibold" style={{ color: "var(--gray-700)" }}>{r.usuarios_asignados}</span>
    ),
  },
];

// ── Columnas — Permisos ────────────────────────────────────────────────────────

const MAX_BADGES_ROLES_VISIBLES = 3;

function CeldaRoles({ roles }: { roles: PermisoRbac["roles"] }) {
  if (roles.length === 0) {
    return <span className="text-[12px]" style={{ color: "var(--gray-300)" }}>Ningún rol</span>;
  }
  const visibles = roles.slice(0, MAX_BADGES_ROLES_VISIBLES);
  const restantes = roles.length - visibles.length;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visibles.map(r => (
        <Badge key={r.id} variant={r.nombre === "master" ? "purple" : "info"}>{r.nombre}</Badge>
      ))}
      {restantes > 0 && (
        <span className="text-[11px]" style={{ color: "var(--gray-400)" }}>+{restantes}</span>
      )}
    </div>
  );
}

const COLUMNS_PERMISOS: Column<PermisoRbac>[] = [
  {
    key: "nombre", header: "Permiso", width: "220px",
    render: (p) => (
      <span className="font-mono text-[12.5px] font-medium" style={{ color: "var(--gray-800)" }}>{p.nombre}</span>
    ),
  },
  {
    key: "modulo", header: "Módulo", width: "130px",
    render: (p) => <Badge variant="default">{p.modulo || "—"}</Badge>,
  },
  {
    key: "descripcion", header: "Descripción", width: "auto",
    render: (p) => <span className="text-[13px]" style={{ color: "var(--gray-600)" }}>{p.descripcion || "—"}</span>,
  },
  {
    key: "roles", header: "Roles", width: "220px",
    render: (p) => <CeldaRoles roles={p.roles} />,
  },
];

// ── Página principal ──────────────────────────────────────────────────────────

export function RolesPermisosPage({ onBack }: Props) {
  const {
    roles, permisos, loading, error, cargar,
    pestana, setPestana,
    rolPanelId, setRolPanelId, rolPanel, permisosDelRolPorModulo,
    permisoPanelId, setPermisoPanelId, permisoPanel,
  } = useRolesPermisos();

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
        <span style={{ color: "var(--gray-700)", fontWeight: 600 }}>Roles y Permisos</span>
      </nav>

      <PageHeader
        title="Roles y Permisos"
        subtitle="Catálogo RBAC del ERP — solo lectura."
        icon={<ShieldCheck className="w-5 h-5" />}
      />

      {error ? (
        <BloqueError mensaje={error} onReintentar={cargar} />
      ) : (
        <>
          {/* KPIs — solo 8 roles / 44 permisos (Sprint 3D-4, corrección D1):
              se retiró "usuarios con al menos un rol" porque sumar
              usuarios_asignados por rol puede contar dos veces al mismo
              usuario si tiene más de un rol activo; sin /api/usuarios en
              esta pantalla no hay forma de deduplicar por usuario. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KpiCard
              label="Roles"
              value={loading ? "—" : roles.length}
              icon={<ShieldCheck className="w-4 h-4" />}
              color="var(--navy)"
              bg="var(--gray-100)"
            />
            <KpiCard
              label="Permisos"
              value={loading ? "—" : permisos.length}
              icon={<KeyRound className="w-4 h-4" />}
              color="var(--navy)"
              bg="var(--gray-100)"
            />
          </div>

          <SegmentedControl pestana={pestana} onCambiar={setPestana} />

          {pestana === "roles" ? (
            <DataTable<RolRbac>
              columns={COLUMNS_ROLES}
              rows={roles}
              rowKey={(r) => r.id}
              onRowClick={(r) => setRolPanelId(r.id)}
              loading={loading}
              emptyMessage="Sin roles"
            />
          ) : (
            <DataTable<PermisoRbac>
              columns={COLUMNS_PERMISOS}
              rows={permisos}
              rowKey={(p) => p.id}
              onRowClick={(p) => setPermisoPanelId(p.id)}
              loading={loading}
              emptyMessage="Sin permisos"
            />
          )}
        </>
      )}

      {/* Panel — detalle de rol: sus permisos agrupados por módulo */}
      <SidePanel
        open={rolPanelId !== null}
        onClose={() => setRolPanelId(null)}
        title="Detalle de rol"
        subtitle={rolPanel?.nombre}
        width="440px"
      >
        {rolPanel && (
          <div>
            <PanelSection first>
              <InfoRow label="Descripción" value={rolPanel.descripcion || "—"} />
              <InfoRow label="Sistema" value={rolPanel.es_sistema ? "Sí" : "No"} />
              <InfoRow label="Estado" value={
                <Badge variant={rolPanel.activo ? "success" : "default"}>
                  {rolPanel.activo ? "Activo" : "Inactivo"}
                </Badge>
              } />
              <InfoRow label="Usuarios asignados" value={rolPanel.usuarios_asignados} />
            </PanelSection>

            <PanelSection title={`Permisos (${permisosDelRolPorModulo.size ? [...permisosDelRolPorModulo.values()].reduce((n, arr) => n + arr.length, 0) : 0})`}>
              {permisosDelRolPorModulo.size === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>
                  Este rol no tiene permisos asignados
                  {rolPanel.nombre === "master" ? " en rol_permisos — accede por regla especial (master)." : "."}
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {[...permisosDelRolPorModulo.entries()].map(([modulo, lista]) => (
                    <div key={modulo}>
                      <div className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--gray-400)" }}>
                        {modulo}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {lista.map(p => (
                          <Badge key={p.id} variant="info">{p.nombre}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PanelSection>
          </div>
        )}
      </SidePanel>

      {/* Panel — detalle de permiso: roles que lo poseen / no lo poseen */}
      <SidePanel
        open={permisoPanelId !== null}
        onClose={() => setPermisoPanelId(null)}
        title="Detalle de permiso"
        subtitle={permisoPanel?.nombre}
        width="440px"
      >
        {permisoPanel && (
          <div>
            <PanelSection first>
              <InfoRow label="Módulo" value={<Badge variant="default">{permisoPanel.modulo || "—"}</Badge>} />
              <InfoRow label="Descripción" value={permisoPanel.descripcion || "—"} />
            </PanelSection>

            <PanelSection title={`Roles que lo poseen (${permisoPanel.roles.length})`}>
              {permisoPanel.roles.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>
                  Ningún rol lo posee — accesible solo por master (regla especial).
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {permisoPanel.roles.map(r => (
                    <Badge key={r.id} variant={r.nombre === "master" ? "purple" : "info"}>{r.nombre}</Badge>
                  ))}
                </div>
              )}
            </PanelSection>

            <PanelSection title="Roles que NO lo poseen">
              {(() => {
                const idsConPermiso = new Set(permisoPanel.roles.map(r => r.id));
                const sinPermiso = roles.filter(r => !idsConPermiso.has(r.id));
                return sinPermiso.length === 0 ? (
                  <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>Todos los roles lo poseen.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sinPermiso.map(r => (
                      <Badge key={r.id} variant="default">{r.nombre}</Badge>
                    ))}
                  </div>
                );
              })()}
            </PanelSection>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
