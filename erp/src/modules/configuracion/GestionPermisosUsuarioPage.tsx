/**
 * GestionPermisosUsuarioPage — "Gestión de permisos por usuario"
 * (Sprint 3D-7.11B, multi-rol + permisos heredados en 3D-7.11C, excepciones
 * individuales locales en 3D-7.11D, layout aprobado en 3D-7.11E.1,
 * refinamiento UX/UI final en 3D-7.11F). Página completa nueva (NO
 * SidePanel), reutilizando datos ya existentes (GET /api/usuarios, /api/roles,
 * /api/permisos) — sin endpoints nuevos.
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
 * Navegación (Sprint 3D-7.11F): esta página ya no dibuja su propia miga de
 * pan interna — el breadcrumb superior de AppShell ("Configuración ›
 * Usuarios › Gestión de permisos", navegable) lo declara ConfiguracionPage
 * vía NavigationContext#setBreadcrumbTrail. Por eso esta página ya no recibe
 * `onBack`: toda la navegación hacia atrás vive en ese breadcrumb.
 *
 * Catálogo de permisos (Sprint 3D-7.11F): se retiró el navegador vertical
 * "Ver: módulos" y los chips de filtro por estado de 3D-7.11E.2/E.4 — la
 * única forma de acotar el catálogo es el buscador; los grupos por módulo
 * (todos desplegados por defecto, con expandir/contraer manual) son ahora la
 * navegación principal del panel derecho.
 *
 * Persistencia real (Sprint 3D-7.11I) — "Restablecer cambios"/"Guardar
 * cambios" en el header habilitan/deshabilitan su estado según
 * `hayCambiosPendientes` (3D-7.11G). Ambos son ya funcionales:
 * "Restablecer" descarta roles/excepciones/grants/revokes locales y vuelve
 * al estado con el que se entró a la pantalla; "Guardar cambios" llama a
 * `guardarCambios()` del hook, que reutiliza EXACTAMENTE la infraestructura
 * RBAC ya existente y auditada (3D-7.11H) — actualizarRolesUsuario()/
 * actualizarExcepcionesUsuario() (PUT /api/usuarios/:id/roles y
 * PUT /api/usuarios/:id/permisos), sin ningún endpoint nuevo. Si la
 * operación toca el rol `master` o una excepción sobre `rbac:gestionar`,
 * se reutilizan sin cambios los mismos modales de confirmación reforzada
 * de UsuariosPage.tsx (ModalConfirmarCambioMaster/
 * ModalConfirmarExcepcionGestionar) — ninguna regla de seguridad nueva.
 *
 * Usuario inactivo: toda la columna izquierda y el panel de permisos quedan
 * deshabilitados — solo permite consulta (ver edicionBloqueada).
 */
import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Search, AlertCircle, Check, RotateCcw, Save, ChevronDown, Layers, Loader2 } from "lucide-react";
import { PageHeader, Badge, Button } from "@/components/ui";
import { useGestionPermisosUsuario } from "./hooks/useGestionPermisosUsuario";
import { ModalConfirmarCambioMaster } from "./components/ModalConfirmarCambioMaster";
import { ModalConfirmarExcepcionGestionar } from "./components/ModalConfirmarExcepcionGestionar";
import type { PermisoRbac, RolRbac } from "./types";

const SELECT_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: 10,
  padding:      "9px 12px",
  color:        "var(--gray-700)",
  background:   "#fff",
  width:        "100%",
};

const TARJETA_STYLE: React.CSSProperties = { background: "#fff", border: "1px solid var(--gray-200)" };

/** Primera letra en mayúscula — los nombres de rol vienen en minúscula desde
 *  la base de datos (p.ej. "operador"); puramente presentacional, no toca
 *  `r.nombre` (el valor real usado en checkbox/onToggle). */
function capitalizar(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

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
        <span className="text-[12.5px] font-medium leading-snug break-words" style={{ color: "var(--gray-800)" }}>
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

/** Checklist de roles compacto (Sprint 3D-7.11F) — variante propia de esta
 *  pantalla, sin descripciones ni badges (a diferencia de SelectorRolesRbac
 *  en UsuariosPage.tsx, que sí las necesita ahí): solo checkbox + nombre del
 *  rol capitalizado. No se modifica SelectorRolesRbac ni su uso en
 *  UsuariosPage — se define una variante local para no alterar el diseño ya
 *  existente de esa pantalla. */
function SelectorRolesCompacto({
  roles, seleccion, onToggle,
}: {
  roles: RolRbac[];
  seleccion: Set<string>;
  onToggle: (rolId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {roles.map(r => {
        const activo = seleccion.has(r.id);
        return (
          <label
            key={r.id}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
            style={{ background: activo ? "var(--gray-50)" : "transparent" }}
          >
            <span
              aria-hidden="true"
              className="shrink-0 flex items-center justify-center rounded"
              style={{
                width: "16px", height: "16px",
                border: `2px solid ${activo ? "var(--navy)" : "var(--gray-300)"}`,
                background: activo ? "var(--navy)" : "transparent",
                color: "#fff",
              }}
            >
              {activo && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
            </span>
            <input
              type="checkbox"
              checked={activo}
              onChange={() => onToggle(r.id)}
              className="sr-only"
              aria-label={`Asignar rol ${r.nombre}`}
            />
            <span className="text-[12.5px] font-medium" style={{ color: "var(--gray-700)" }}>
              {capitalizar(r.nombre)}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function GestionPermisosUsuarioPage() {
  const {
    usuarios, roles, loading, error, cargar,
    usuarioSeleccionadoId, usuarioSeleccionado, seleccionarUsuario,
    rolesSeleccionados, toggleRol,
    excepcionesActivadas, toggleExcepcionesActivadas,
    grantsLocales, revokesLocales, toggleExcepcionPermiso,
    busquedaPermiso, setBusquedaPermiso,
    permisosHeredadosIds, permisosHeredados, permisosEfectivosIds, permisosPorModulo,
    edicionBloqueada, hayCambiosPendientes, restablecerCambios,
    guardando, errorGuardado, guardarCambios,
    agregandoMaster, confirmarMaster, confirmarCambioMaster, cancelarConfirmacionGuardado,
    efectoDeseadoGestionar, confirmarGestionarExcepcion, confirmarExcepcionGestionar,
  } = useGestionPermisosUsuario();

  // Solo estado local de foco del buscador — sin lógica adicional.
  const [busquedaFoco, setBusquedaFoco] = useState(false);

  // Acordeón por módulo (Sprint 3D-7.11E.4, todos abiertos por defecto desde
  // 3D-7.11F) — puramente de presentación: qué grupos están COLAPSADOS a
  // mano. Por defecto (Set vacío) todos los módulos aparecen desplegados;
  // el usuario puede contraer/expandir cada uno individualmente. No decide
  // qué permisos existen ni altera permisosPorModulo.
  const [modulosColapsados, setModulosColapsados] = useState<Set<string>>(new Set());

  // Al cambiar de usuario, el acordeón vuelve a su estado neutro (todo
  // desplegado) — mismo criterio que el resto del estado local de esta
  // pantalla (useGestionPermisosUsuario ya resetea roles/excepciones/
  // búsqueda al cambiar de usuarioSeleccionado).
  useEffect(() => {
    setModulosColapsados(new Set());
  }, [usuarioSeleccionadoId]);

  function toggleModuloColapsado(modulo: string) {
    setModulosColapsados(prev => {
      const next = new Set(prev);
      if (next.has(modulo)) next.delete(modulo); else next.add(modulo);
      return next;
    });
  }

  const cambiosPendientes = grantsLocales.size + revokesLocales.size;

  const estadoDe = useCallback((permisoId: string): EstadoPermiso => {
    const heredado = permisosHeredadosIds.has(permisoId);
    if (heredado) return revokesLocales.has(permisoId) ? "revocado" : "heredado";
    return grantsLocales.has(permisoId) ? "otorgado" : "base";
  }, [permisosHeredadosIds, grantsLocales, revokesLocales]);

  // Mensaje de estado vacío del catálogo — nunca dice "heredado" cuando el
  // catálogo mostrado es el completo (modo Excepciones activas).
  const mensajeSinResultados = busquedaPermiso.trim() !== ""
    ? (excepcionesActivadas ? "Ningún permiso coincide con la búsqueda." : "Ningún permiso heredado coincide con la búsqueda.")
    : "No hay permisos para mostrar.";

  return (
    <div className="p-6 flex flex-col gap-6">
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
            {/* Restablecer (Sprint 3D-7.11G): habilitado solo con cambios
                locales pendientes (roles/excepciones/grants/revokes, ver
                hayCambiosPendientes en el hook); descarta todo y vuelve
                exactamente al estado con el que se entró a la pantalla.
                Deshabilitado también mientras se está guardando (evita
                restablecer a mitad de un guardado en curso). */}
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              disabled={!hayCambiosPendientes || edicionBloqueada || guardando}
              onClick={restablecerCambios}
            >
              Restablecer cambios
            </Button>
            {/* Guardar cambios (Sprint 3D-7.11I): guardarCambios() reutiliza
                actualizarRolesUsuario()/actualizarExcepcionesUsuario() ya
                existentes (roles primero, excepciones después) — pide
                confirmación reforzada antes si toca master/rbac:gestionar
                (ver modales abajo). `disabled` también mientras `guardando`
                evita doble envío. */}
            <Button
              size="sm"
              icon={guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              disabled={!hayCambiosPendientes || edicionBloqueada || guardando}
              onClick={guardarCambios}
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        ) : undefined}
      />

      {/* Error de guardado (Sprint 3D-7.11I) — mismo patrón visual que el
          aviso de usuario inactivo de abajo: banner rojo con AlertCircle.
          Nunca reemplaza al banner de error de carga (`error`, más abajo),
          que es un problema distinto (no se pudo cargar usuarios/roles/
          permisos). Si falló solo una parte (p.ej. roles se guardaron pero
          excepciones no), el mensaje ya lo deja explícito — ver
          ejecutarGuardado en el hook. */}
      {errorGuardado && !error && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
          style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-light)" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--inlop-red)" }} />
          <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>{errorGuardado}</p>
        </div>
      )}

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
          {/* Sprint 3D-7.11F.1: el aviso de usuario inactivo ya no separa la
              tarjeta "Usuario" del grid — vive arriba del grid (no dentro de
              ninguna columna), así ambas columnas siguen arrancando en la
              misma fila sin importar si el aviso se muestra o no. */}
          {usuarioSeleccionado && edicionBloqueada && (
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

          {/* Layout de 2 columnas (proporciones ajustadas al mockup 3D-7.11E.1).
                  `min-w-0` en ambas columnas (Sprint 3D-7.11E.3): un grid item
                  tiene por defecto `min-width: auto`, es decir NO se encoge
                  por debajo del ancho mínimo de su contenido — con la pista
                  `1fr` de la derecha, un texto largo sin espacios podía forzar
                  el ancho real del grid más allá del disponible, produciendo
                  overflow horizontal dentro de <main> (el único contenedor con
                  scroll del shell, ver AppShell.tsx) y por tanto una segunda
                  barra de scroll compitiendo con la vertical natural del
                  contenido. `min-w-0` permite que cada columna se ajuste al
                  ancho real de su pista y delega el corte de texto largo al
                  `min-w-0`/`break-words` ya puesto en los elementos internos
                  (ver TarjetaPermiso y la tarjeta de solo lectura, abajo).
                  `min-h-0` en ambas columnas (Sprint 3D-7.11E.3.1) — mismo
                  refuerzo defensivo que en AppShell.tsx, por si algún
                  ancestro llegara a acotar la altura de este grid; con el
                  <main> actual (altura automática, sin acotar) no tiene
                  efecto visible, pero mantiene la misma regla aplicada de
                  forma consistente en toda la cadena. */}
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">

                {/* IZQUIERDA — Usuario + Roles + Excepciones + Resumen.
                    Sprint 3D-7.11F.1: "Usuario" vuelve a ser el primer
                    elemento DENTRO de esta columna (en vez de una tarjeta
                    suelta encima del grid, como en 3D-7.11F) para que
                    arranque en la misma fila que el panel "Permisos
                    heredados" de la derecha — ambos son ahora el primer hijo
                    de su respectiva columna del mismo grid. Se muestra
                    siempre (incluso sin usuario elegido, para poder elegir
                    uno); Roles/Excepciones/Resumen siguen apareciendo solo
                    una vez hay un usuario seleccionado.
                    `sticky top-6` (Sprint 3D-7.11E.3.2) — con el catálogo de
                    permisos a menudo más alto que esta columna (una vez hay
                    roles/excepciones con varios módulos), bajo `items-start`
                    la fila del grid ya mide lo que mida la columna derecha
                    (la más alta); sin sticky, esta columna simplemente
                    termina a media altura y el resto del scroll transcurre
                    únicamente sobre el catálogo — se percibe como una zona
                    de scroll aparte. Con sticky, esta columna viaja fijada
                    mientras se scrollea el catálogo, dentro del único
                    contenedor de scroll real (<main>, ver AppShell.tsx): no
                    crea un contexto de scroll nuevo, no oculta ni recorta
                    nada, solo reposiciona. `top-6` iguala el padding
                    superior de la página (p-6) para que no quede pegada al
                    borde de <main>. */}
                <div className="flex flex-col gap-5 min-w-0 min-h-0 lg:sticky lg:top-6 lg:self-start">
                  {/* Usuario + información del usuario seleccionado,
                      integrados en una sola tarjeta (Sprint 3D-7.11F). */}
                  <div className="rounded-xl p-5" style={TARJETA_STYLE}>
                    <label
                      htmlFor="gestion-permisos-usuario"
                      className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5"
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

                    {usuarioSeleccionado && (
                      <>
                        <div style={{ height: 1, background: "var(--gray-100)", margin: "16px 0" }} />
                        <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--gray-400)" }}>
                          Información del usuario
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
                      </>
                    )}
                  </div>

                  {usuarioSeleccionado && (
                  <>
                  {/* Roles asignados — checklist compacto sin descripciones
                      ni badges (Sprint 3D-7.11F, ver SelectorRolesCompacto). */}
                  <div className="rounded-xl p-5" style={TARJETA_STYLE}>
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
                      <SelectorRolesCompacto roles={roles} seleccion={rolesSeleccionados} onToggle={toggleRol} />
                    </fieldset>
                    {/* Feedback visual local en tiempo real (3D-7.11C) — se
                        actualiza solo con cada marca/desmarca, sin mensaje
                        de guardado (nada de esto persiste todavía). */}
                    <p className="text-[11.5px] mt-2.5" style={{ color: "var(--gray-400)" }}>
                      Los permisos heredados son la unión de los roles seleccionados.
                    </p>
                  </div>

                  {/* Excepciones de permisos */}
                  <div className="rounded-xl p-5" style={TARJETA_STYLE}>
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
                  <div className="rounded-xl p-5 flex items-center" style={TARJETA_STYLE}>
                    <EstadisticaResumen valor={rolesSeleccionados.size} etiqueta="Roles seleccionados" />
                    <div className="w-px self-stretch" style={{ background: "var(--gray-100)" }} />
                    <EstadisticaResumen valor={permisosEfectivosIds.size} etiqueta="Permisos activos" />
                    <div className="w-px self-stretch" style={{ background: "var(--gray-100)" }} />
                    <EstadisticaResumen valor={cambiosPendientes} etiqueta="Cambios pendientes" />
                  </div>
                  </>
                  )}
                </div>

                {/* DERECHA — Catálogo de permisos. Sprint 3D-7.11F: se retiró
                    el navegador "Ver: módulos" y los chips de filtro por
                    estado — el buscador es ahora el único filtro, y los
                    grupos por módulo (todos desplegados por defecto) son la
                    navegación principal. */}
                <div
                  className="rounded-xl p-5 flex flex-col gap-4 min-w-0 min-h-0"
                  style={TARJETA_STYLE}
                >
                {usuarioSeleccionado ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Cantidad + concepto (Sprint 3D-7.11F): el número y su
                        etiqueta ("permisos heredados"/"permisos efectivos")
                        se leen como una sola unidad, con un ícono de apoyo —
                        mismos valores ya calculados en el hook. */}
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="shrink-0 rounded-lg flex items-center justify-center"
                        style={{ width: "40px", height: "40px", background: "var(--gray-50)", color: "var(--navy)" }}
                      >
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-[26px] leading-none" style={{ color: "var(--navy)" }}>
                            {excepcionesActivadas ? permisosEfectivosIds.size : permisosHeredados.length}
                          </span>
                          <span className="text-[13px] font-semibold" style={{ color: "var(--gray-700)" }}>
                            {excepcionesActivadas ? "permisos efectivos" : "permisos heredados"}
                          </span>
                        </div>
                        <div className="text-[11.5px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                          {excepcionesActivadas ? "Heredados + excepciones locales" : "Por los roles asignados"}
                        </div>
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

                  {!excepcionesActivadas && rolesSeleccionados.size === 0 ? (
                    <p className="text-[13px] py-8 text-center" style={{ color: "var(--gray-400)" }}>
                      Selecciona al menos un rol para ver sus permisos heredados.
                    </p>
                  ) : permisosPorModulo.size === 0 ? (
                    <p className="text-[13px] py-8 text-center" style={{ color: "var(--gray-400)" }}>
                      {mensajeSinResultados}
                    </p>
                  ) : (
                    <fieldset
                      disabled={edicionBloqueada}
                      style={{ opacity: edicionBloqueada ? 0.5 : 1, pointerEvents: edicionBloqueada ? "none" : "auto" }}
                    >
                      {/* Grupos por módulo, todos abiertos por defecto
                          (Sprint 3D-7.11F) — la navegación/contenido
                          principal del panel. Alturas y espaciados
                          compactados un poco respecto a 3D-7.11E.4
                          (gap-2 → gap-1.5, px-2.5 py-2 → px-2 py-1.5). */}
                      <div className="flex flex-col gap-1.5">
                        {[...permisosPorModulo.entries()].map(([modulo, lista]) => {
                          const expandido = !modulosColapsados.has(modulo);
                          return (
                            <div key={modulo} className="rounded-lg" style={{ border: "1px solid var(--gray-100)" }}>
                              <button
                                type="button"
                                onClick={() => toggleModuloColapsado(modulo)}
                                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left"
                                style={{ cursor: "pointer" }}
                              >
                                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--gray-400)" }}>
                                  {modulo} <span style={{ color: "var(--gray-300)" }}>· {lista.length}</span>
                                </span>
                                <ChevronDown
                                  className="w-3.5 h-3.5 shrink-0 transition-transform"
                                  style={{ color: "var(--gray-400)", transform: expandido ? "rotate(180deg)" : "rotate(0deg)" }}
                                />
                              </button>
                              {expandido && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 px-2 pb-2">
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
                                        <span className="flex-1 min-w-0 text-[12.5px] font-medium leading-snug break-words" style={{ color: "var(--gray-800)" }}>
                                          {p.descripcion || "—"}
                                        </span>
                                      </div>
                                    )
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                </>
                ) : (
                  <p className="text-[13px] py-8 text-center" style={{ color: "var(--gray-400)" }}>
                    Selecciona un usuario para ver sus permisos.
                  </p>
                )}
                </div>
              </div>
        </>
      )}

      {/* Confirmación reforzada al guardar (Sprint 3D-7.11I) — mismos
          componentes que ya usa UsuariosPage.tsx, sin modificarlos: el
          request real lo dispara guardarCambios()/ejecutarGuardado() en el
          hook, estos modales solo confirman y reflejan guardando/error. */}
      {confirmarMaster && usuarioSeleccionado && (
        <ModalConfirmarCambioMaster
          usuarioNombre={usuarioSeleccionado.nombre || usuarioSeleccionado.email}
          agregando={agregandoMaster}
          guardando={guardando}
          error={errorGuardado}
          onConfirmar={confirmarCambioMaster}
          onCancelar={cancelarConfirmacionGuardado}
        />
      )}
      {confirmarGestionarExcepcion && usuarioSeleccionado && (
        <ModalConfirmarExcepcionGestionar
          usuarioNombre={usuarioSeleccionado.nombre || usuarioSeleccionado.email}
          efectoDeseado={efectoDeseadoGestionar}
          guardando={guardando}
          error={errorGuardado}
          onConfirmar={confirmarExcepcionGestionar}
          onCancelar={cancelarConfirmacionGuardado}
        />
      )}
    </div>
  );
}
