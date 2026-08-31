/**
 * GestionPermisosUsuarioPage — "Gestión de permisos por usuario"
 * (Sprint 3D-7.11B, multi-rol + permisos heredados en 3D-7.11C, excepciones
 * individuales locales en 3D-7.11D, layout aprobado en 3D-7.11E.1). Página
 * completa nueva (NO SidePanel), reutilizando datos y componentes ya
 * existentes (GET /api/usuarios, /api/roles, /api/permisos;
 * SelectorRolesRbac de UsuariosPage.tsx).
 *
 * Decisión de producto ya cerrada (3D-7.11B.1): un usuario puede tener
 * múltiples roles simultáneos — el checklist de la izquierda es
 * deliberadamente multi-selección (checkbox), no un radio de rol único.
 *
 * Fórmula de permisos efectivos (3D-7.11D, replicada del motor RBAC real
 * — services/rbac/resolver.js — puramente para previsualización local):
 *
 *   permisos_efectivos = permisos_heredados (unión de roles) + grants − revokes
 *
 * Con "Excepciones de permisos" DESACTIVADAS: el panel derecho se comporta
 * exactamente como en 3D-7.11C — solo heredados, todos activos, sin ON/OFF
 * individual, buscador acotado a los heredados.
 *
 * Con "Excepciones de permisos" ACTIVADAS: el panel derecho muestra el
 * catálogo COMPLETO; cada permiso es clickeable — heredados alternan un
 * revoke local, no-heredados alternan un grant local (toggleExcepcionPermiso,
 * en el hook). Volver a coincidir con el estado base elimina la excepción.
 *
 * SIGUE SIN PERSISTIR: "Restablecer cambios"/"Guardar cambios" en el header
 * (Sprint 3D-7.11E.1) son ubicación/estructura visual únicamente — quedan
 * deshabilitados a propósito, mismo patrón ya usado en este proyecto para
 * una acción de UI todavía no conectada a backend (ver "Nuevo usuario" en
 * UsuariosPage antes de 3D-7.8D). Nada de esto llama a
 * PUT /api/usuarios/:id/roles ni a PUT /api/usuarios/:id/permisos (ya
 * existentes, pendientes de conectar en un sprint de guardado posterior).
 *
 * Usuario inactivo: toda la columna izquierda y el panel de permisos quedan
 * deshabilitados — solo permite consulta (ver edicionBloqueada).
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { ShieldCheck, Search, AlertCircle, Check, RotateCcw, Save } from "lucide-react";
import { PageHeader, Badge, Button } from "@/components/ui";
import { useGestionPermisosUsuario } from "./hooks/useGestionPermisosUsuario";
import { SelectorRolesRbac } from "./UsuariosPage";
import type { PermisoRbac } from "./types";

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

/** Estado visual de un permiso en modo "Excepciones activadas" — deriva
 *  puramente de si es heredado y de si tiene una excepción local sobre él;
 *  no es un estado propio, se recalcula en cada render (ver TarjetaPermiso). */
type EstadoPermiso = "heredado" | "revocado" | "otorgado" | "base";

function TarjetaPermiso({
  permiso, estado, interactivo, onClick,
}: {
  permiso: PermisoRbac;
  estado: EstadoPermiso;
  /** false en modo "Excepciones desactivadas" — solo lectura. */
  interactivo: boolean;
  onClick: () => void;
}) {
  const activo = estado === "heredado" || estado === "otorgado";
  const cajaBg = estado === "otorgado" ? "#6D28D9" : activo ? "var(--navy)" : "#fff";
  const cajaBorde = estado === "revocado" ? "var(--inlop-red)" : activo ? cajaBg : "var(--gray-300)";

  const Contenedor = interactivo ? "button" : "div";

  return (
    <Contenedor
      type={interactivo ? "button" : undefined}
      onClick={interactivo ? onClick : undefined}
      className="rounded-lg px-3 py-2.5 flex items-start gap-2 text-left w-full transition-colors"
      style={{
        background: "var(--gray-50)",
        border: "1px solid var(--gray-200)",
        cursor: interactivo ? "pointer" : "default",
      }}
    >
      <span
        aria-hidden="true"
        className="shrink-0 flex items-center justify-center rounded mt-0.5"
        style={{ width: "16px", height: "16px", border: `2px solid ${cajaBorde}`, background: cajaBg }}
      >
        {activo && <Check className="w-2.5 h-2.5" style={{ color: "#fff" }} strokeWidth={3} />}
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--gray-800)" }}>
          {permiso.descripcion || "—"}
        </span>
        {/* Distinción visual explícita — solo para los dos estados que son
            una excepción local respecto al rol (requisito 4 del ticket).
            "Heredado" y "sin asignar" ya se comunican con el color de la
            casilla, sin necesidad de una insignia en cada tarjeta. */}
        {estado === "revocado" && <Badge variant="danger">Revocado</Badge>}
        {estado === "otorgado" && <Badge variant="purple">Otorgado</Badge>}
      </span>
    </Contenedor>
  );
}

/** Iniciales para el avatar del usuario seleccionado — puramente
 *  presentacional, derivado del nombre/correo ya cargados (sin campo de
 *  foto en UsuarioRbac; no se inventa uno). */
function iniciales(nombre: string, email: string): string {
  const base = nombre.trim() || email.trim();
  if (!base) return "?";
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** Card de estadística simple para "Resumen actual" — solo redistribuye
 *  valores ya calculados en el hook, sin ningún cómputo nuevo. */
function EstadisticaResumen({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="font-bold text-[24px] leading-none" style={{ color: "var(--navy)" }}>{valor}</div>
      <div className="text-[11px] mt-1" style={{ color: "var(--gray-500)" }}>{etiqueta}</div>
    </div>
  );
}

/** Filtro rápido por estado (Sprint 3D-7.11E.2) — solo aplica en modo
 *  "Excepciones activadas", donde tiene sentido distinguir estos 4 casos
 *  (en modo normal todo lo visible es "heredado" por definición). */
type FiltroEstado = "todos" | EstadoPermiso;

/** Chip de filtro compacto — reutilizado para módulo y para estado, sin
 *  introducir un componente de UI nuevo (mismo estilo de pill que Badge). */
function Chip({
  activo, onClick, children, punto,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Color del punto indicador, para los chips de estado. */
  punto?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-colors shrink-0"
      style={{
        background: activo ? "var(--navy)" : "var(--gray-100)",
        color:      activo ? "#fff" : "var(--gray-600)",
      }}
    >
      {punto && (
        <span aria-hidden="true" className="rounded-full shrink-0" style={{ width: "7px", height: "7px", background: activo ? "#fff" : punto }} />
      )}
      {children}
    </button>
  );
}

export function GestionPermisosUsuarioPage({ onBack }: Props) {
  const {
    usuarios, roles, permisos, loading, error, cargar,
    usuarioSeleccionadoId, usuarioSeleccionado, seleccionarUsuario,
    rolesSeleccionados, toggleRol,
    excepcionesActivadas, toggleExcepcionesActivadas,
    grantsLocales, revokesLocales, toggleExcepcionPermiso,
    busquedaPermiso, setBusquedaPermiso,
    permisosHeredadosIds, permisosHeredados, permisosEfectivosIds, permisosPorModulo,
    edicionBloqueada,
  } = useGestionPermisosUsuario();

  // Solo estado local de foco del buscador — sin lógica adicional.
  const [busquedaFoco, setBusquedaFoco] = useState(false);

  // Filtros rápidos del catálogo (Sprint 3D-7.11E.2) — puramente de
  // presentación: solo deciden QUÉ se muestra, nunca tocan
  // permisosHeredadosIds/grantsLocales/revokesLocales/permisosEfectivosIds
  // (esos siguen viviendo exclusivamente en el hook, sin duplicar lógica RBAC).
  const [filtroModulo, setFiltroModulo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  // Al cambiar de usuario, los filtros vuelven a su estado neutro — mismo
  // criterio que el resto del estado local de esta pantalla (useGestionPermisosUsuario
  // ya resetea roles/excepciones/búsqueda al cambiar de usuarioSeleccionado).
  useEffect(() => {
    setFiltroModulo("todos");
    setFiltroEstado("todos");
  }, [usuarioSeleccionadoId]);

  const cambiosPendientes = grantsLocales.size + revokesLocales.size;

  const estadoDe = useCallback((permisoId: string): EstadoPermiso => {
    const heredado = permisosHeredadosIds.has(permisoId);
    if (heredado) return revokesLocales.has(permisoId) ? "revocado" : "heredado";
    return grantsLocales.has(permisoId) ? "otorgado" : "base";
  }, [permisosHeredadosIds, grantsLocales, revokesLocales]);

  // Catálogo base según el modo actual — mismo criterio ya usado dentro del
  // hook para permisosPorModulo (heredados en modo normal, catálogo
  // completo con Excepciones activadas). Se recalcula aquí solo para los
  // contadores de los chips, sin duplicar la agrupación por módulo del hook.
  const catalogoBase = excepcionesActivadas ? permisos : permisosHeredados;

  // Chips de módulo — cuenta real de permisos por módulo dentro del
  // catálogo base actual (no del catálogo completo si estamos en modo
  // normal, para que "Todos" siempre coincida con lo que hay para ver).
  const moduloChips = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const p of catalogoBase) {
      const key = p.modulo || "otros";
      conteo.set(key, (conteo.get(key) ?? 0) + 1);
    }
    return [...conteo.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalogoBase]);

  // Chips de estado — solo tienen sentido con Excepciones activadas (en
  // modo normal todo lo visible es "heredado" por definición). Cuenta real
  // sobre el catálogo completo, usando exactamente estadoDe() (misma lógica
  // que ya pinta cada tarjeta) — no se inventa un cálculo paralelo.
  const estadoChips = useMemo(() => {
    if (!excepcionesActivadas) return null;
    const conteo: Record<EstadoPermiso, number> = { heredado: 0, otorgado: 0, revocado: 0, base: 0 };
    for (const p of permisos) conteo[estadoDe(p.id)]++;
    return conteo;
  }, [excepcionesActivadas, permisos, estadoDe]);

  // Aplica los filtros de módulo y estado sobre el agrupado que ya arma el
  // hook (permisosPorModulo, que ya viene filtrado por el buscador y por el
  // modo actual) — combinación búsqueda + módulo + estado en un solo lugar.
  const permisosPorModuloFiltrados = useMemo(() => {
    let entradas = [...permisosPorModulo.entries()];
    if (filtroModulo !== "todos") {
      entradas = entradas.filter(([modulo]) => modulo === filtroModulo);
    }
    if (excepcionesActivadas && filtroEstado !== "todos") {
      entradas = entradas
        .map(([modulo, lista]) => [modulo, lista.filter(p => estadoDe(p.id) === filtroEstado)] as [string, PermisoRbac[]])
        .filter(([, lista]) => lista.length > 0);
    }
    return new Map(entradas);
  }, [permisosPorModulo, filtroModulo, filtroEstado, excepcionesActivadas, estadoDe]);

  // Mensaje de estado vacío (requisito 6) — nunca dice "heredado" cuando el
  // vacío viene de un filtro de módulo/estado/búsqueda distinto, para no
  // confundir a alguien mirando, por ejemplo, "Revocados".
  const hayFiltrosActivos = busquedaPermiso.trim() !== "" || filtroModulo !== "todos" || (excepcionesActivadas && filtroEstado !== "todos");
  const mensajeSinResultados = hayFiltrosActivos
    ? "Ningún permiso coincide con los filtros actuales."
    : excepcionesActivadas
      ? "Ningún permiso coincide con la búsqueda."
      : "Ningún permiso heredado coincide con la búsqueda.";

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
        subtitle="Administra los roles y excepciones de permisos para cada usuario del ERP."
        icon={<ShieldCheck className="w-5 h-5" />}
        actions={usuarioSeleccionado ? (
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div
                className="text-[12.5px] font-semibold flex items-center gap-1.5 justify-end"
                style={{ color: cambiosPendientes > 0 ? "var(--warning)" : "var(--gray-400)" }}
              >
                {cambiosPendientes > 0 && (
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--warning)" }} />
                )}
                {cambiosPendientes} cambio{cambiosPendientes === 1 ? "" : "s"} pendiente{cambiosPendientes === 1 ? "" : "s"}
              </div>
              <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>
                {cambiosPendientes > 0 ? "Sin guardar" : "Todo al día"}
              </div>
            </div>
            {/* Guardado real pendiente de un sprint posterior (ver comentario
                del módulo) — estructura/posición ya aprobadas por el mockup,
                deshabilitados a propósito para no simular una acción que
                todavía no existe. */}
            <Button variant="outline" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} disabled title="Disponible en un sprint posterior">
              Restablecer cambios
            </Button>
            <Button size="sm" icon={<Save className="w-3.5 h-3.5" />} disabled title="Disponible en un sprint posterior">
              Guardar cambios
            </Button>
          </div>
        ) : undefined}
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
          {/* Selector superior de usuario — mecanismo de elección, sin cambios
              de comportamiento; el mockup lo asume ya resuelto y muestra el
              resultado en la tarjeta "Usuario seleccionado" de la izquierda. */}
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

              {/* Layout de 2 columnas (proporciones ajustadas al mockup 3D-7.11E.1) */}
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">

                {/* IZQUIERDA — Usuario + Roles + Excepciones + Resumen */}
                <div className="flex flex-col gap-4">
                  {/* Usuario seleccionado */}
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "#fff", border: "1px solid var(--gray-200)" }}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--gray-400)" }}>
                      Usuario seleccionado
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="shrink-0 rounded-full flex items-center justify-center font-bold text-[13px]"
                        style={{ width: "40px", height: "40px", background: "var(--gray-100)", color: "var(--navy)" }}
                      >
                        {iniciales(usuarioSeleccionado.nombre, usuarioSeleccionado.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold truncate" style={{ color: "var(--gray-800)" }}>
                            {usuarioSeleccionado.nombre || "—"}
                          </span>
                          <Badge variant={usuarioSeleccionado.activo ? "success" : "default"}>
                            {usuarioSeleccionado.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <div className="text-[12.5px] truncate" style={{ color: "var(--gray-500)" }}>
                          {usuarioSeleccionado.email || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Roles asignados */}
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "#fff", border: "1px solid var(--gray-200)" }}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--gray-400)" }}>
                      Roles asignados ({rolesSeleccionados.size})
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
                    {/* Feedback visual local en tiempo real (3D-7.11C) — se
                        actualiza solo con cada marca/desmarca, sin mensaje
                        de guardado (nada de esto persiste todavía). */}
                    <p className="text-[11.5px] mt-2.5" style={{ color: "var(--gray-400)" }}>
                      Los permisos heredados son la unión de los roles seleccionados.
                    </p>
                  </div>

                  {/* Excepciones de permisos */}
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
                      {excepcionesActivadas && cambiosPendientes > 0 && (
                        <Badge variant="warning">{cambiosPendientes} cambios</Badge>
                      )}
                    </label>
                    <p className="text-[11.5px] mt-2" style={{ color: "var(--gray-400)" }}>
                      {excepcionesActivadas
                        ? "Toca un permiso a la derecha para otorgarlo o revocarlo."
                        : "Actívalo para otorgar o revocar permisos puntuales para este usuario."}
                    </p>
                  </div>

                  {/* Resumen actual — redistribuye valores ya calculados
                      (rolesSeleccionados/permisosEfectivosIds/cambiosPendientes),
                      sin ningún cómputo nuevo. */}
                  <div
                    className="rounded-xl p-4 flex items-center"
                    style={{ background: "#fff", border: "1px solid var(--gray-200)" }}
                  >
                    <EstadisticaResumen valor={rolesSeleccionados.size} etiqueta="Roles seleccionados" />
                    <div className="w-px self-stretch" style={{ background: "var(--gray-100)" }} />
                    <EstadisticaResumen valor={permisosEfectivosIds.size} etiqueta="Permisos activos" />
                    <div className="w-px self-stretch" style={{ background: "var(--gray-100)" }} />
                    <EstadisticaResumen valor={cambiosPendientes} etiqueta="Cambios pendientes" />
                  </div>
                </div>

                {/* DERECHA — Catálogo de permisos */}
                <div
                  className="rounded-xl p-4 flex flex-col gap-4"
                  style={{ background: "#fff", border: "1px solid var(--gray-200)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--gray-400)" }}>
                          {excepcionesActivadas ? "Permisos efectivos" : "Permisos heredados"}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-[24px] leading-none" style={{ color: "var(--navy)" }}>
                            {excepcionesActivadas ? permisosEfectivosIds.size : permisosHeredados.length}
                          </span>
                          <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
                            {excepcionesActivadas ? "permisos activos" : "heredados del rol"}
                          </span>
                        </div>
                        {excepcionesActivadas && (
                          <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>
                            Heredados + excepciones locales
                          </div>
                        )}
                      </div>
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

                  {/* Filtros rápidos (Sprint 3D-7.11E.2) — solo deciden qué se
                      muestra; no tocan roles, excepciones ni el cálculo RBAC. */}
                  {(!excepcionesActivadas ? permisosHeredados.length > 0 : permisos.length > 0) && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Chip activo={filtroModulo === "todos"} onClick={() => setFiltroModulo("todos")}>
                          Todos ({catalogoBase.length})
                        </Chip>
                        {moduloChips.map(([modulo, n]) => (
                          <Chip key={modulo} activo={filtroModulo === modulo} onClick={() => setFiltroModulo(modulo)}>
                            {modulo} ({n})
                          </Chip>
                        ))}
                      </div>
                      {estadoChips && (
                        <div className="flex flex-wrap gap-1.5">
                          <Chip activo={filtroEstado === "todos"} onClick={() => setFiltroEstado("todos")}>
                            Todos ({permisos.length})
                          </Chip>
                          <Chip activo={filtroEstado === "heredado"} onClick={() => setFiltroEstado("heredado")} punto="var(--navy)">
                            Heredados ({estadoChips.heredado})
                          </Chip>
                          <Chip activo={filtroEstado === "otorgado"} onClick={() => setFiltroEstado("otorgado")} punto="#6D28D9">
                            Otorgados ({estadoChips.otorgado})
                          </Chip>
                          <Chip activo={filtroEstado === "revocado"} onClick={() => setFiltroEstado("revocado")} punto="var(--inlop-red)">
                            Revocados ({estadoChips.revocado})
                          </Chip>
                          <Chip activo={filtroEstado === "base"} onClick={() => setFiltroEstado("base")} punto="var(--gray-300)">
                            No heredados ({estadoChips.base})
                          </Chip>
                        </div>
                      )}
                    </div>
                  )}

                  {!excepcionesActivadas && rolesSeleccionados.size === 0 ? (
                    <p className="text-[13px] py-8 text-center" style={{ color: "var(--gray-400)" }}>
                      Selecciona al menos un rol para ver sus permisos heredados.
                    </p>
                  ) : permisosPorModuloFiltrados.size === 0 ? (
                    <p className="text-[13px] py-8 text-center" style={{ color: "var(--gray-400)" }}>
                      {mensajeSinResultados}
                    </p>
                  ) : (
                    <fieldset
                      disabled={edicionBloqueada}
                      style={{ opacity: edicionBloqueada ? 0.5 : 1, pointerEvents: edicionBloqueada ? "none" : "auto" }}
                    >
                      <div className="flex flex-col gap-5">
                        {[...permisosPorModuloFiltrados.entries()].map(([modulo, lista]) => (
                          <div key={modulo}>
                            <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--gray-400)" }}>
                              {modulo} <span style={{ color: "var(--gray-300)" }}>· {lista.length}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                              {lista.map(p => (
                                excepcionesActivadas ? (
                                  <TarjetaPermiso
                                    key={p.id}
                                    permiso={p}
                                    estado={estadoDe(p.id)}
                                    interactivo
                                    onClick={() => toggleExcepcionPermiso(p.id)}
                                  />
                                ) : (
                                  // Modo normal (excepciones desactivadas) — mismo
                                  // render de solo lectura de 3D-7.11C, sin cambios.
                                  <div
                                    key={p.id}
                                    className="rounded-lg px-3 py-2.5 flex items-start gap-2"
                                    style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
                                  >
                                    <Check
                                      className="w-3.5 h-3.5 shrink-0 mt-0.5"
                                      style={{ color: "#065F46" }}
                                      aria-label="Activo (heredado del rol)"
                                    />
                                    <span className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--gray-800)" }}>
                                      {p.descripcion || "—"}
                                    </span>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </fieldset>
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
