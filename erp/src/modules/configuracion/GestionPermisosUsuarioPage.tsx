/**
 * GestionPermisosUsuarioPage — base UI de "Gestión de permisos por usuario"
 * (Sprint 3D-7.11B). Página completa nueva (NO SidePanel), reutilizando
 * datos y componentes ya existentes (GET /api/usuarios, /api/roles,
 * /api/permisos; SelectorRolesRbac de UsuariosPage.tsx).
 *
 * Decisión de producto ya cerrada (3D-7.11B.1): un usuario puede tener
 * múltiples roles simultáneos — el checklist de la izquierda es
 * deliberadamente multi-selección (checkbox), no un radio de rol único.
 *
 * ALCANCE DE ESTE SPRINT — SOLO estado local / preparación visual:
 *   - Selección de roles (checkbox múltiple) y el interruptor "Excepciones
 *     de permisos" no persisten todavía, ni calculan la unión de permisos
 *     de los roles seleccionados, ni derivan qué permisos "heredaría" el
 *     usuario — ese cálculo es exactamente el trabajo de 3D-7.11C. El panel
 *     derecho, mientras tanto, muestra el catálogo completo de permisos,
 *     agrupado por módulo y filtrable por texto, sin conexión todavía a la
 *     selección de roles ni al modo de excepciones.
 *   - Usuario inactivo: toda la columna izquierda (roles + excepciones)
 *     queda deshabilitada — solo permite consulta (ver edicionBloqueada).
 *   - Sin botón Guardar: nada de esto se persiste todavía.
 */
import { useState } from "react";
import { ShieldCheck, Search, AlertCircle, KeyRound } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui";
import { useGestionPermisosUsuario } from "./hooks/useGestionPermisosUsuario";
import { SelectorRolesRbac } from "./UsuariosPage";

interface Props {
  onBack: () => void;
}

const SELECT_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: 10,
  padding:      "9px 12px",
  color:        "var(--gray-700)",
  background:   "#fff",
  width:        "100%",
};

export function GestionPermisosUsuarioPage({ onBack }: Props) {
  const {
    usuarios, roles, loading, error, cargar,
    usuarioSeleccionadoId, usuarioSeleccionado, seleccionarUsuario,
    rolesSeleccionados, toggleRol,
    excepcionesActivadas, toggleExcepcionesActivadas,
    busquedaPermiso, setBusquedaPermiso, permisosPorModulo,
    edicionBloqueada,
  } = useGestionPermisosUsuario();

  // Solo estado local de foco del buscador — sin lógica adicional.
  const [busquedaFoco, setBusquedaFoco] = useState(false);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Migas de pan interna — mismo patrón que UsuariosPage/RolesPermisosPage */}
      <nav aria-label="Ruta interna" className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--gray-400)" }}>
        <button
          type="button"
          onClick={onBack}
          className="hover:underline focus-visible:outline-none"
          style={{ color: "var(--gray-500)" }}
        >
          Usuarios
        </button>
        <span aria-hidden="true">›</span>
        <span style={{ color: "var(--gray-700)", fontWeight: 600 }}>Gestión de permisos</span>
      </nav>

      <PageHeader
        title="Gestión de permisos"
        subtitle="Roles y excepciones individuales de un usuario del ERP."
        icon={<ShieldCheck className="w-5 h-5" />}
      />

      {error ? (
        <div className="py-16 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--inlop-red)", opacity: 0.5 }} />
          <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
          <button type="button" onClick={cargar} className="mt-3 text-[12px] underline" style={{ color: "var(--navy)" }}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Selector superior de usuario */}
          <div className="max-w-md">
            <label
              htmlFor="gestion-permisos-usuario"
              className="block text-[11px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: "var(--gray-500)" }}
            >
              Usuario
            </label>
            <select
              id="gestion-permisos-usuario"
              value={usuarioSeleccionadoId ?? ""}
              onChange={(e) => seleccionarUsuario(e.target.value)}
              disabled={loading}
              className="text-[13.5px] outline-none"
              style={SELECT_STYLE}
            >
              <option value="">{loading ? "Cargando…" : "Selecciona un usuario…"}</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre || u.email} — {u.email}</option>
              ))}
            </select>
          </div>

          {usuarioSeleccionado && (
            <>
              {/* Cabecera del usuario — Nombre/Correo/Estado, solo lectura */}
              <div
                className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-xl"
                style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Nombre</div>
                  <div className="text-[14px] font-semibold" style={{ color: "var(--gray-800)" }}>{usuarioSeleccionado.nombre || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Correo</div>
                  <div className="text-[13px]" style={{ color: "var(--gray-600)" }}>{usuarioSeleccionado.email || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Estado</div>
                  <Badge variant={usuarioSeleccionado.activo ? "success" : "default"}>
                    {usuarioSeleccionado.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </div>

              {edicionBloqueada && (
                <div
                  className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
                  style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-light)" }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
                  <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>
                    Este usuario está inactivo — no se pueden editar sus roles ni excepciones de permisos.
                    Actívalo primero desde <strong>Configuración → Usuarios</strong>.
                  </p>
                </div>
              )}

              {/* Layout de 2 columnas */}
              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

                {/* IZQUIERDA — Roles + Excepciones */}
                <div className="flex flex-col gap-6">
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "#fff", border: "1px solid var(--gray-200)" }}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--gray-400)" }}>
                      Roles
                    </div>
                    {/* Usuario inactivo (3D-7.11B.1): además del atributo
                        `disabled` (que ya impide interactuar con los
                        checkboxes internos), se refuerza con estilo
                        explícito — no depender solo de que el navegador
                        aplique la pseudo-clase :disabled sobre <fieldset>. */}
                    <fieldset
                      disabled={edicionBloqueada}
                      style={{
                        opacity:       edicionBloqueada ? 0.5 : 1,
                        pointerEvents: edicionBloqueada ? "none" : "auto",
                      }}
                    >
                      <SelectorRolesRbac roles={roles} seleccion={rolesSeleccionados} onToggle={toggleRol} />
                    </fieldset>
                  </div>

                  <div
                    className="rounded-xl p-4"
                    style={{ background: "#fff", border: "1px solid var(--gray-200)" }}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--gray-400)" }}>
                      Excepciones de permisos
                    </div>
                    <label
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                      style={{
                        background: excepcionesActivadas ? "var(--gray-50)" : "transparent",
                        border: `1.5px solid ${excepcionesActivadas ? "var(--gray-200)" : "transparent"}`,
                        opacity:       edicionBloqueada ? 0.5 : 1,
                        cursor:        edicionBloqueada ? "not-allowed" : "pointer",
                        pointerEvents: edicionBloqueada ? "none" : "auto",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="shrink-0 flex items-center justify-center rounded-full transition-colors"
                        style={{
                          width: "34px", height: "20px", padding: "2px",
                          background: excepcionesActivadas ? "var(--navy)" : "var(--gray-300)",
                          display: "flex", justifyContent: excepcionesActivadas ? "flex-end" : "flex-start",
                        }}
                      >
                        <span className="rounded-full bg-white" style={{ width: "16px", height: "16px" }} />
                      </span>
                      <input
                        type="checkbox"
                        checked={excepcionesActivadas}
                        onChange={toggleExcepcionesActivadas}
                        disabled={edicionBloqueada}
                        className="sr-only"
                        aria-label="Activar excepciones individuales de permisos"
                      />
                      <span className="text-[12.5px] font-medium" style={{ color: "var(--gray-700)" }}>
                        {excepcionesActivadas ? "Activadas" : "Desactivadas"}
                      </span>
                    </label>
                    <p className="text-[11.5px] mt-2" style={{ color: "var(--gray-400)" }}>
                      Permitirá otorgar o revocar permisos puntuales para este usuario — disponible en un
                      próximo sprint.
                    </p>
                  </div>
                </div>

                {/* DERECHA — Catálogo de permisos */}
                <div
                  className="rounded-xl p-4 flex flex-col gap-4"
                  style={{ background: "#fff", border: "1px solid var(--gray-200)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--gray-400)" }}>
                      Permisos
                    </div>
                    <div className="relative w-full max-w-xs">
                      <Search
                        className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: "var(--gray-400)" }}
                      />
                      <input
                        type="text"
                        value={busquedaPermiso}
                        onChange={(e) => setBusquedaPermiso(e.target.value)}
                        onFocus={() => setBusquedaFoco(true)}
                        onBlur={() => setBusquedaFoco(false)}
                        placeholder="Buscar permiso…"
                        aria-label="Buscar permiso"
                        className="w-full text-[12.5px] outline-none"
                        style={{
                          ...SELECT_STYLE,
                          padding: "7px 12px 7px 30px",
                          borderColor: busquedaFoco ? "var(--navy)" : "var(--gray-200)",
                        }}
                      />
                    </div>
                  </div>

                  {permisosPorModulo.size === 0 ? (
                    <p className="text-[13px] py-8 text-center" style={{ color: "var(--gray-400)" }}>
                      Ningún permiso coincide con la búsqueda.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {[...permisosPorModulo.entries()].map(([modulo, lista]) => (
                        <div key={modulo}>
                          <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--gray-400)" }}>
                            {modulo}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                            {lista.map(p => (
                              <div
                                key={p.id}
                                className="rounded-lg px-3 py-2.5 flex items-start gap-2"
                                style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
                              >
                                <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--gray-400)" }} />
                                <span className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--gray-800)" }}>
                                  {p.descripcion || "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
