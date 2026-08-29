import { useState, useEffect, useRef } from "react";
import {
  Users, AlertCircle, Pencil, Check, X as XIcon, Info, Plus, KeyRound,
  MoreHorizontal, ChevronLeft, ChevronRight, UserCheck, UserX, ShieldCheck,
} from "lucide-react";
import { PageHeader, FilterBar, DataTable, Badge, Button, SidePanel, PanelSection, InfoRow, KpiCard } from "@/components/ui";
import type { Column } from "@/components/ui";
import { formatFechaCorta } from "./types";
import type { UsuarioRbac, RolRbac, PermisoRbac } from "./types";
import { useUsuarios, type FiltroEstadoUsuario } from "./hooks/useUsuarios";
import { ModalConfirmarCambioMaster } from "./components/ModalConfirmarCambioMaster";
import { ModalConfirmarExcepcionGestionar } from "./components/ModalConfirmarExcepcionGestionar";
import { ModalCrearUsuario } from "./components/ModalCrearUsuario";
import { ModalConfirmarResetPassword } from "./components/ModalConfirmarResetPassword";
import { ModalConfirmarActivarDesactivar } from "./components/ModalConfirmarActivarDesactivar";

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

// ── Celda "Usuario" — avatar discreto (iniciales, acento navy) + nombre ─────
// Mismo algoritmo de iniciales que TopbarUserMenu.tsx (primera + última
// palabra del nombre real); tono navy/azul claro en vez de --inlop-red para
// respetar "azul INLOP únicamente como color principal" en esta pantalla.

function inicialesUsuario(nombre: string): string {
  const words = nombre.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function CeldaUsuario({ u }: { u: UsuarioRbac }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center font-semibold text-[11px]"
        style={{ background: "var(--info-bg)", color: "var(--navy)" }}
      >
        {inicialesUsuario(u.nombre || u.email)}
      </span>
      <span className="font-medium text-[13px] truncate" style={{ color: "var(--gray-800)" }}>
        {u.nombre || "—"}
      </span>
    </div>
  );
}

// ── Celda "Estado" — punto pequeño + texto, sin badge de color (rediseño UI) ─

function EstadoDot({ activo }: { activo: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: activo ? "var(--success)" : "var(--gray-300)" }}
      />
      <span className="text-[13px]" style={{ color: activo ? "var(--gray-700)" : "var(--gray-400)" }}>
        {activo ? "Activo" : "Inactivo"}
      </span>
    </span>
  );
}

/** "Rol" como texto limpio (no badge) — varios roles se listan separados por coma. */
function rolesTexto(u: UsuarioRbac): string {
  if (u.roles_rbac.length === 0) return "—";
  return u.roles_rbac.map(r => r.nombre).join(", ");
}

// ── Menú de acciones "..." — mismo patrón de dropdown (click fuera cierra)
// que TopbarUserMenu.tsx, simplificado para uso por fila de tabla. Única
// acción real: activar/desactivar (Sprint 3D-7.8D) — ver/editar roles/
// excepciones ya se cubren con clic en fila y el lápiz de Editar. ─────────

function MenuAcciones({
  usuario, puedeEditarRoles, onActivarDesactivar,
}: {
  usuario: UsuarioRbac;
  puedeEditarRoles: boolean;
  onActivarDesactivar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const itemClass = "w-full text-left px-3 py-2 text-[12.5px] hover:bg-[var(--gray-50)] disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Más acciones — ${usuario.nombre}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 rounded-lg hover:bg-[var(--gray-100)]"
      >
        <MoreHorizontal className="w-4 h-4" style={{ color: "var(--gray-500)" }} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[190px] py-1"
          style={{
            background:   "#fff",
            border:       "1px solid var(--gray-100)",
            borderRadius: "var(--radius-lg)",
            boxShadow:    "var(--shadow-dropdown)",
            zIndex:       30, // var(--z-dropdown), ver tokens.css
          }}
        >
          <button
            type="button" role="menuitem" className={itemClass}
            style={{ color: usuario.activo ? "var(--inlop-red)" : "var(--gray-700)" }}
            disabled={!puedeEditarRoles}
            onClick={() => { setOpen(false); onActivarDesactivar(); }}
          >
            {usuario.activo ? "Desactivar" : "Activar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Columnas de la tabla ──────────────────────────────────────────────────────

function buildColumns({
  abrirPanel, puedeEditarRoles, onResetPassword, onActivarDesactivar,
}: {
  abrirPanel: (id: string, editar?: "roles" | "excepciones") => void;
  puedeEditarRoles: boolean;
  onResetPassword: (id: string) => void;
  onActivarDesactivar: (id: string) => void;
}): Column<UsuarioRbac>[] {
  return [
    {
      key:    "usuario",
      header: "Usuario",
      width:  "220px",
      render: (u) => <CeldaUsuario u={u} />,
    },
    {
      key:    "email",
      header: "Email",
      width:  "220px",
      render: (u) => (
        <span className="text-[13px]" style={{ color: "var(--gray-600)" }}>{u.email || "—"}</span>
      ),
    },
    {
      key:    "rol",
      header: "Rol",
      width:  "180px",
      render: (u) => (
        <span className="text-[13px]" style={{ color: "var(--gray-700)" }}>{rolesTexto(u)}</span>
      ),
    },
    {
      key:    "estado",
      header: "Estado",
      width:  "100px",
      render: (u) => <EstadoDot activo={u.activo} />,
    },
    {
      key:    "ultimo_acceso",
      header: "Último acceso",
      width:  "120px",
      render: () => (
        // Auditado (rediseño UI): ningún dato real de último acceso está
        // disponible hoy — ni `profiles` ni GET /api/usuarios lo exponen, y
        // este sprint no crea backend nuevo solo para esto. Se muestra "---"
        // siempre, nunca una fecha inventada.
        <span className="text-[13px]" style={{ color: "var(--gray-300)" }}>---</span>
      ),
    },
    {
      key:    "created_at",
      header: "Creado",
      width:  "100px",
      render: (u) => (
        <span className="text-[13px]" style={{ color: "var(--gray-400)" }}>{formatFechaCorta(u.created_at)}</span>
      ),
    },
    {
      key:    "acciones",
      header: "Acciones",
      width:  "130px",
      align:  "right",
      render: (u) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => abrirPanel(u.id, "roles")}
            disabled={!puedeEditarRoles}
            aria-label={`Editar ${u.nombre}`}
            className="p-1.5 rounded-lg hover:bg-[var(--gray-100)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Pencil className="w-4 h-4" style={{ color: "var(--gray-500)" }} />
          </button>
          <button
            type="button"
            onClick={() => onResetPassword(u.id)}
            disabled={!puedeEditarRoles}
            aria-label={`Restablecer contraseña de ${u.nombre}`}
            className="p-1.5 rounded-lg hover:bg-[var(--gray-100)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <KeyRound className="w-4 h-4" style={{ color: "var(--gray-500)" }} />
          </button>
          <MenuAcciones
            usuario={u}
            puedeEditarRoles={puedeEditarRoles}
            onActivarDesactivar={() => onActivarDesactivar(u.id)}
          />
        </div>
      ),
    },
  ];
}

// ── Paginación compacta — todos los datos ya están cargados en memoria
// (GET /api/usuarios, sin params de paginación en el backend); paginar aquí
// es solo una vista sobre `filtrados`, sin consultas nuevas. ───────────────

const REGISTROS_POR_PAGINA_OPCIONES = [10, 25, 50];

function Paginacion({
  pagina, totalPaginas, totalRegistros, porPagina, onCambiarPagina, onCambiarPorPagina,
}: {
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
  porPagina: number;
  onCambiarPagina: (p: number) => void;
  onCambiarPorPagina: (n: number) => void;
}) {
  const desde = totalRegistros === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, totalRegistros);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--gray-500)" }}>
        <span>{desde}–{hasta} de {totalRegistros}</span>
        <select
          value={porPagina}
          onChange={(e) => onCambiarPorPagina(Number(e.target.value))}
          aria-label="Registros por página"
          className="text-[12.5px] outline-none"
          style={{ border: "1.5px solid var(--gray-200)", borderRadius: 8, padding: "4px 8px", color: "var(--gray-600)", background: "#fff" }}
        >
          {REGISTROS_POR_PAGINA_OPCIONES.map(n => (
            <option key={n} value={n}>{n} / página</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCambiarPagina(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
          className="p-1.5 rounded-lg hover:bg-[var(--gray-100)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "var(--gray-600)" }} />
        </button>
        <span className="text-[12.5px]" style={{ color: "var(--gray-600)" }}>
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => onCambiarPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Página siguiente"
          className="p-1.5 rounded-lg hover:bg-[var(--gray-100)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-600)" }} />
        </button>
      </div>
    </div>
  );
}

// ── Checklist de roles editable — mismo patrón visual de checkbox custom que
// EtapaDestinatarios.tsx (label + span estilizado + input sr-only), sin
// componente ni librería nueva. Sin cambios funcionales en este sprint. ────

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

// ── Editor de excepciones (usuario_permisos) — sin cambios funcionales en
// este sprint (ver comentario en SelectorRolesRbac de arriba). ─────────────

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
    data, filtrados, loading, error, cargar,
    busqueda, setBusqueda,
    filtroEstado, setFiltroEstado,
    filtroRol, setFiltroRol,
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
    mostrarCrearUsuario, abrirCrearUsuario, cerrarCrearUsuario,
    nuevoNombre, setNuevoNombre, nuevoEmail, setNuevoEmail,
    creandoUsuario, errorCrearUsuario, confirmarCrearUsuario,
    usuarioResetPassword, pedirResetPassword, cancelarResetPassword,
    enviandoResetPassword, errorResetPassword, exitoResetPassword, confirmarResetPassword,
    usuarioActivar, pedirCambiarActivo, cancelarCambiarActivo,
    cambiandoActivo, errorCambiarActivo, confirmarCambiarActivo,
  } = useUsuarios();

  const columns = buildColumns({
    abrirPanel, puedeEditarRoles,
    onResetPassword: pedirResetPassword,
    onActivarDesactivar: pedirCambiarActivo,
  });
  const hayBusqueda = busqueda.trim().length > 0;
  const hayFiltros  = hayBusqueda || filtroEstado !== "" || filtroRol !== "";

  // ── KPI — calculados sobre `data` (todos los usuarios ya cargados, sin
  // filtrar), no sobre `filtrados` — totales estables independientes de la
  // búsqueda activa. Ninguna consulta nueva; "Roles RBAC asignados" es la
  // suma real de roles_rbac.length por usuario (cuenta relaciones de
  // asignación, no usuarios — a diferencia del KPI retirado en 3D-4
  // "usuarios con ≥1 rol", este no tiene ambigüedad de doble conteo). ──────
  const totalUsuarios      = data.length;
  const usuariosActivos    = data.filter(u => u.activo).length;
  const usuariosInactivos  = totalUsuarios - usuariosActivos;
  const rolesAsignadosTotal = data.reduce((acc, u) => acc + u.roles_rbac.length, 0);

  // ── Paginación — vista sobre `filtrados`, ya en memoria (sin params de
  // paginación en GET /api/usuarios). Se reinicia a la página 1 si cambia
  // cualquier filtro, para no quedar "colgado" en una página vacía. ────────
  const [pagina, setPagina]       = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  useEffect(() => { setPagina(1); }, [busqueda, filtroEstado, filtroRol]);

  const totalRegistros = filtrados.length;
  const totalPaginas   = Math.max(1, Math.ceil(totalRegistros / porPagina));
  const paginaSegura   = Math.min(pagina, totalPaginas);
  const inicio         = (paginaSegura - 1) * porPagina;
  const paginaActual   = filtrados.slice(inicio, inicio + porPagina);

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

      {/* Header + acción principal — mismo patrón que ReportesAutomaticosPage */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Usuarios"
          subtitle="Administra los usuarios del ERP y sus roles RBAC actuales."
          icon={<Users className="w-5 h-5" />}
        />
        {/* Creación real de usuarios ERP (Sprint 3D-7.8D) — ver
            ModalCrearUsuario y POST /api/usuarios. */}
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={abrirCrearUsuario}
          disabled={!puedeEditarRoles}
          className="shrink-0"
        >
          Nuevo usuario
        </Button>
      </div>

      {/* KPI compactos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total usuarios"
          value={loading ? "—" : totalUsuarios}
          icon={<Users className="w-4 h-4" />}
          color="var(--navy)"
          bg="var(--gray-100)"
        />
        <KpiCard
          label="Usuarios activos"
          value={loading ? "—" : usuariosActivos}
          icon={<UserCheck className="w-4 h-4" />}
          color="var(--navy)"
          bg="var(--gray-100)"
        />
        <KpiCard
          label="Usuarios inactivos"
          value={loading ? "—" : usuariosInactivos}
          icon={<UserX className="w-4 h-4" />}
          color="var(--navy)"
          bg="var(--gray-100)"
        />
        <KpiCard
          label="Roles RBAC asignados"
          value={loading ? "—" : rolesAsignadosTotal}
          icon={<ShieldCheck className="w-4 h-4" />}
          color="var(--navy)"
          bg="var(--gray-100)"
        />
      </div>

      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        searchPlaceholder="Buscar por nombre, email o rol..."
        selects={[
          {
            value:       filtroRol,
            onChange:    setFiltroRol,
            placeholder: "Todos los roles",
            options:     rolesAsignables.map(r => ({ value: r.id, label: r.nombre })),
            ariaLabel:   "Filtrar por rol",
          },
          {
            value:       filtroEstado,
            onChange:    (v) => setFiltroEstado(v as FiltroEstadoUsuario),
            placeholder: "Todos los estados",
            options: [
              { value: "activo",   label: "Activo" },
              { value: "inactivo", label: "Inactivo" },
            ],
            ariaLabel: "Filtrar por estado",
          },
        ]}
        hayFiltros={hayFiltros}
        onLimpiar={hayFiltros ? () => { setBusqueda(""); setFiltroEstado(""); setFiltroRol(""); } : undefined}
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
        <>
          <DataTable<UsuarioRbac>
            columns={columns}
            rows={paginaActual}
            rowKey={(u) => u.id}
            onRowClick={(u) => abrirPanel(u.id)}
            loading={loading}
            emptyMessage="Sin usuarios"
          />
          {!loading && totalRegistros > 0 && (
            <Paginacion
              pagina={paginaSegura}
              totalPaginas={totalPaginas}
              totalRegistros={totalRegistros}
              porPagina={porPagina}
              onCambiarPagina={setPagina}
              onCambiarPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
            />
          )}
        </>
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

      {mostrarCrearUsuario && (
        <ModalCrearUsuario
          nombre={nuevoNombre}
          email={nuevoEmail}
          onNombreChange={setNuevoNombre}
          onEmailChange={setNuevoEmail}
          creando={creandoUsuario}
          error={errorCrearUsuario}
          onCrear={confirmarCrearUsuario}
          onCancelar={cerrarCrearUsuario}
        />
      )}

      {usuarioResetPassword && (
        <ModalConfirmarResetPassword
          usuarioNombre={usuarioResetPassword.nombre || usuarioResetPassword.email}
          guardando={enviandoResetPassword}
          error={errorResetPassword}
          exito={exitoResetPassword}
          onConfirmar={confirmarResetPassword}
          onCancelar={cancelarResetPassword}
        />
      )}

      {usuarioActivar && (
        <ModalConfirmarActivarDesactivar
          usuarioNombre={usuarioActivar.nombre || usuarioActivar.email}
          activando={!usuarioActivar.activo}
          esMaster={usuarioActivar.roles_rbac.some(r => r.nombre === "master")}
          guardando={cambiandoActivo}
          error={errorCambiarActivo}
          onConfirmar={confirmarCambiarActivo}
          onCancelar={cancelarCambiarActivo}
        />
      )}
    </div>
  );
}
