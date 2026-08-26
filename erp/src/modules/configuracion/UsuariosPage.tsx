import { useState } from "react";
import { Users, AlertCircle, Pencil, Check, X as XIcon, Info } from "lucide-react";
import { PageHeader, FilterBar, DataTable, Badge, Button, SidePanel, PanelSection, InfoRow } from "@/components/ui";
import type { Column } from "@/components/ui";
import { formatFechaCorta } from "./types";
import type { UsuarioRbac, RolRbac, PermisoRbac } from "./types";
import { useUsuarios } from "./hooks/useUsuarios";
import { ModalConfirmarCambioMaster } from "./components/ModalConfirmarCambioMaster";
import { ModalConfirmarExcepcionGestionar } from "./components/ModalConfirmarExcepcionGestionar";

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

// ── Checklist de roles editable — mismo patrón visual de checkbox custom que
// EtapaDestinatarios.tsx (label + span estilizado + input sr-only), sin
// componente ni librería nueva. ─────────────────────────────────────────────

function SelectorRolesRbac({
  roles, seleccion, onToggle,
}: {
  roles: RolRbac[];
  seleccion: Set<string>;
  onToggle: (rolId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {roles.map(r => {
        const activo = seleccion.has(r.id);
        return (
          <label
            key={r.id}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
            style={{ background: activo ? "var(--gray-50)" : "transparent", border: `1.5px solid ${activo ? "var(--gray-200)" : "transparent"}` }}
          >
            <span
              aria-hidden="true"
              className="shrink-0 flex items-center justify-center rounded"
              style={{
                width: "18px", height: "18px",
                border: `2px solid ${activo ? "var(--navy)" : "var(--gray-300)"}`,
                background: activo ? "var(--navy)" : "transparent",
                color: "#fff",
              }}
            >
              {activo && <Check className="w-3 h-3" strokeWidth={3} />}
            </span>
            <input
              type="checkbox"
              checked={activo}
              onChange={() => onToggle(r.id)}
              className="sr-only"
              aria-label={`Asignar rol ${r.nombre}`}
            />
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <Badge variant={r.nombre === "master" ? "purple" : "info"}>{r.nombre}</Badge>
              {r.descripcion && (
                <span className="text-[11.5px] truncate" style={{ color: "var(--gray-400)" }}>
                  {r.descripcion}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}

// ── Editor de excepciones (usuario_permisos) — a diferencia del checklist de
// roles/permisos, NO duplica el catálogo completo como filas siempre
// visibles: solo renderiza las excepciones ya elegidas + un selector para
// agregar una nueva, apoyado en el <select> nativo ya usado en FilterBar.tsx
// (mismo patrón, sin componente ni librería nueva). ─────────────────────────

const SELECT_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: 10,
  padding:      "6px 10px",
  color:        "var(--gray-700)",
  background:   "#fff",
};

function SelectorExcepciones({
  catalogo, seleccion, onSetEfecto, onQuitar,
}: {
  catalogo: PermisoRbac[];
  seleccion: Map<string, "grant" | "revoke">;
  onSetEfecto: (permisoId: string, efecto: "grant" | "revoke") => void;
  onQuitar: (permisoId: string) => void;
}) {
  const [permisoAAgregar, setPermisoAAgregar] = useState("");
  const permisoPorId = new Map(catalogo.map(p => [p.id, p]));
  const disponibles = catalogo.filter(p => !seleccion.has(p.id));

  return (
    <div className="flex flex-col gap-3">
      {seleccion.size === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>Sin excepciones.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {[...seleccion.entries()].map(([permisoId, efecto]) => {
            const permiso = permisoPorId.get(permisoId);
            return (
              <div
                key={permisoId}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg"
                style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
              >
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <Badge variant={efecto === "grant" ? "success" : "danger"}>
                    {efecto === "grant" ? "Concede" : "Niega"}
                  </Badge>
                  <span className="font-mono text-[12px] truncate" style={{ color: "var(--gray-800)" }}>
                    {permiso?.nombre ?? permisoId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onQuitar(permisoId)}
                  className="p-1 rounded hover:bg-gray-100 shrink-0"
                  aria-label={`Quitar excepción sobre ${permiso?.nombre ?? permisoId}`}
                >
                  <XIcon className="w-3.5 h-3.5" style={{ color: "var(--gray-400)" }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {disponibles.length > 0 && (
        <div className="flex items-center gap-1.5">
          <select
            value={permisoAAgregar}
            onChange={(e) => setPermisoAAgregar(e.target.value)}
            aria-label="Elegir permiso para agregar excepción"
            className="flex-1 min-w-0 text-[12.5px] outline-none"
            style={SELECT_STYLE}
          >
            <option value="">Elegir permiso…</option>
            {disponibles.map(p => (
              <option key={p.id} value={p.id}>{p.modulo ? `${p.modulo} · ` : ""}{p.nombre}</option>
            ))}
          </select>
          <Button
            size="sm" variant="outline" disabled={!permisoAAgregar}
            onClick={() => { onSetEfecto(permisoAAgregar, "grant"); setPermisoAAgregar(""); }}
          >
            Conceder
          </Button>
          <Button
            size="sm" variant="danger" disabled={!permisoAAgregar}
            onClick={() => { onSetEfecto(permisoAAgregar, "revoke"); setPermisoAAgregar(""); }}
          >
            Negar
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function UsuariosPage({ onBack }: Props) {
  const {
    filtrados, loading, error, cargar,
    busqueda, setBusqueda,
    filtroEstado, setFiltroEstado,
    panelId, abrirPanel, cerrarPanel, panelUsuario,
    rolesAsignables,
    puedeEditarRoles,
    editando, iniciarEdicion, cancelarEdicion, toggleRol, seleccion,
    guardando, errorGuardado, exito,
    tocaMaster, confirmarMaster, setConfirmarMaster,
    guardarRoles, ejecutarGuardado,
    permisos, panelUsuarioEsMaster,
    editandoExcepciones, iniciarEdicionExcepciones, cancelarEdicionExcepciones,
    setEfectoExcepcion, quitarExcepcion, seleccionExcepciones,
    guardandoExcepciones, errorGuardadoExcepciones, exitoExcepciones,
    efectoDeseadoGestionar, confirmarGestionarExcepcion, setConfirmarGestionarExcepcion,
    guardarExcepciones, ejecutarGuardadoExcepciones,
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
          onRowClick={(u) => abrirPanel(u.id)}
          loading={loading}
          emptyMessage="Sin usuarios"
        />
      )}

      <SidePanel
        open={panelId !== null}
        onClose={cerrarPanel}
        title="Detalle de usuario"
        subtitle={panelUsuario?.nombre}
        width="420px"
        footer={editando && panelUsuario ? (
          <div className="flex items-center justify-between gap-2 px-6 py-4">
            {errorGuardado ? (
              <span className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--inlop-red)" }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorGuardado}
              </span>
            ) : <span />}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={cancelarEdicion} disabled={guardando}>
                Cancelar
              </Button>
              <Button size="sm" onClick={guardarRoles} loading={guardando} disabled={guardando}>
                Guardar
              </Button>
            </div>
          </div>
        ) : editandoExcepciones && panelUsuario ? (
          <div className="flex items-center justify-between gap-2 px-6 py-4">
            {errorGuardadoExcepciones ? (
              <span className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--inlop-red)" }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorGuardadoExcepciones}
              </span>
            ) : <span />}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={cancelarEdicionExcepciones} disabled={guardandoExcepciones}>
                Cancelar
              </Button>
              <Button size="sm" onClick={guardarExcepciones} loading={guardandoExcepciones} disabled={guardandoExcepciones}>
                Guardar
              </Button>
            </div>
          </div>
        ) : undefined}
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

            <PanelSection
              title="Roles RBAC"
              icon={puedeEditarRoles && !editando && !editandoExcepciones ? (
                <button
                  type="button"
                  onClick={iniciarEdicion}
                  className="flex items-center gap-1 hover:underline focus-visible:outline-none"
                  style={{ color: "var(--navy)" }}
                  aria-label="Editar roles"
                >
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              ) : undefined}
            >
              {exito && !editando && (
                <div className="flex items-center gap-1.5 mb-3 text-[12px]" style={{ color: "#065F46" }}>
                  <Check className="w-3.5 h-3.5" /> Roles actualizados correctamente.
                </div>
              )}

              {editando ? (
                <SelectorRolesRbac roles={rolesAsignables} seleccion={seleccion} onToggle={toggleRol} />
              ) : panelUsuario.roles_rbac.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>Sin roles asignados.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {panelUsuario.roles_rbac.map(r => (
                    <Badge key={r.id} variant={r.nombre === "master" ? "purple" : "info"}>{r.nombre}</Badge>
                  ))}
                </div>
              )}
            </PanelSection>

            {/* Excepciones individuales de usuario_permisos (Sprint 3D-7.6)
                — grants/revokes puntuales, superpuestos a los roles. NO
                reemplaza la sección de Roles RBAC de arriba. */}
            <PanelSection
              title="Excepciones de permisos"
              icon={puedeEditarRoles && !editando && !editandoExcepciones ? (
                <button
                  type="button"
                  onClick={iniciarEdicionExcepciones}
                  className="flex items-center gap-1 hover:underline focus-visible:outline-none"
                  style={{ color: "var(--navy)" }}
                  aria-label="Editar excepciones"
                >
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              ) : undefined}
            >
              {panelUsuarioEsMaster && (
                <div
                  className="flex items-start gap-2 rounded-xl p-3 mb-3"
                  style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
                >
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--gray-400)" }} />
                  <p className="text-[12px]" style={{ color: "var(--gray-500)" }}>
                    Este usuario es <strong>master</strong>: su acceso total se resuelve por la
                    regla especial del motor RBAC, ANTES de considerar excepciones — estas no
                    alteran sus permisos efectivos.
                  </p>
                </div>
              )}

              {exitoExcepciones && !editandoExcepciones && (
                <div className="flex items-center gap-1.5 mb-3 text-[12px]" style={{ color: "#065F46" }}>
                  <Check className="w-3.5 h-3.5" /> Excepciones actualizadas correctamente.
                </div>
              )}

              {editandoExcepciones ? (
                <SelectorExcepciones
                  catalogo={permisos}
                  seleccion={seleccionExcepciones}
                  onSetEfecto={setEfectoExcepcion}
                  onQuitar={quitarExcepcion}
                />
              ) : panelUsuario.excepciones.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>Sin excepciones.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {panelUsuario.excepciones.map(e => (
                    <div key={e.permiso_id} className="flex items-center gap-2">
                      <Badge variant={e.efecto === "grant" ? "success" : "danger"}>
                        {e.efecto === "grant" ? "Concede" : "Niega"}
                      </Badge>
                      <span className="font-mono text-[12px]" style={{ color: "var(--gray-800)" }}>{e.nombre}</span>
                    </div>
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

      {confirmarMaster && panelUsuario && (
        <ModalConfirmarCambioMaster
          usuarioNombre={panelUsuario.nombre || panelUsuario.email}
          agregando={tocaMaster && !panelUsuario.roles_rbac.some(r => r.nombre === "master")}
          guardando={guardando}
          error={errorGuardado}
          onConfirmar={ejecutarGuardado}
          onCancelar={() => setConfirmarMaster(false)}
        />
      )}

      {confirmarGestionarExcepcion && panelUsuario && (
        <ModalConfirmarExcepcionGestionar
          usuarioNombre={panelUsuario.nombre || panelUsuario.email}
          efectoDeseado={efectoDeseadoGestionar}
          guardando={guardandoExcepciones}
          error={errorGuardadoExcepciones}
          onConfirmar={ejecutarGuardadoExcepciones}
          onCancelar={() => setConfirmarGestionarExcepcion(false)}
        />
      )}
    </div>
  );
}
