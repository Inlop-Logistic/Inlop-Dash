import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "@/state/AuthContext";
import { usePermisos } from "@/hooks/usePermisos";
import {
  LayoutDashboard, ClipboardList, Truck, Map,
  CalendarClock, CheckSquare, Settings, Users, ShieldCheck,
  LogOut, ChevronRight, ChevronLeft, Building2,
} from "lucide-react";
import { TopbarSearch } from "@/components/layout/TopbarSearch";
import { TopbarNotifications } from "@/components/layout/TopbarNotifications";
import { TopbarUserMenu } from "@/components/layout/TopbarUserMenu";
import type { Vista, NavSection } from "@/types/navigation";
import type { BreadcrumbItem, NavigationDestination } from "@/core/navigation";

// Re-export para compatibilidad con importadores existentes (ej. App.tsx).
export type { Vista } from "@/types/navigation";

const NAV_SECTIONS: NavSection[] = [
  {
    id: "comercial",
    label: "GESTIÓN COMERCIAL",
    items: [
      { id: "clientes", label: "Clientes", icon: <Building2 className="w-4 h-4" /> },
    ],
  },
  {
    id: "logistica",
    label: "GESTIÓN LOGÍSTICA",
    items: [
      { id: "dashboard",    label: "Inicio",               icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: "solicitudes",  label: "Solicitudes",          icon: <ClipboardList   className="w-4 h-4" /> },
      { id: "programacion", label: "Programación",         icon: <CalendarClock   className="w-4 h-4" /> },
      { id: "viajes",       label: "Viajes Activos",       icon: <Truck           className="w-4 h-4" /> },
      { id: "mapa",         label: "Centro GPS",           icon: <Map             className="w-4 h-4" /> },
      { id: "cumplidos",    label: "Viajes Finalizados",   icon: <CheckSquare     className="w-4 h-4" /> },
    ],
  },
  {
    id: "sistema",
    label: "CONFIGURACIÓN",
    breadcrumbLabel: "Configuración",
    items: [
      { id: "configuracion", label: "Parámetros", icon: <Settings className="w-4 h-4" /> },
    ],
  },
  // Secciones futuras — descomentar y agregar items[] cuando el módulo esté listo:
  // { id: "finanzas",       label: "FINANZAS",        items: [] },
  // { id: "talento_humano", label: "TALENTO HUMANO",  items: [] },
  // { id: "hseq",           label: "HSEQ",            items: [] },
];

const NAV_ALL = NAV_SECTIONS.flatMap((s) => s.items);

/**
 * Ítems fijos del sidebar de la sección "CONFIGURACIÓN" (Sprint 3D-7.11J.2).
 * A diferencia del resto de secciones, estos 3 ítems no corresponden 1:1 a
 * una `Vista` (los tres navegan a la misma vista "configuracion" con una
 * sub-pantalla distinta vía `NavPayload.configSubVista`) — por eso viven
 * en un arreglo aparte en vez del `items: NavItem[]` tipado de NavSection,
 * y por qué la sección "sistema" tiene su propia rama de render más abajo.
 * Son estáticos: SIEMPRE visibles, sin depender de que ConfiguracionPage
 * esté montada (antes de esta corrección, los ítems los declaraba
 * ConfiguracionPage vía contexto al montarse, por lo que solo aparecían
 * después de haber entrado a Configuración — ese era el bug).
 */
const CONFIG_SIDEBAR_ITEMS: {
  key:   "usuarios" | "roles-permisos" | "parametros";
  label: string;
  icon:  ReactNode;
}[] = [
  { key: "usuarios",       label: "Usuarios",   icon: <Users className="w-4 h-4" /> },
  { key: "roles-permisos", label: "Roles",      icon: <ShieldCheck className="w-4 h-4" /> },
  { key: "parametros",     label: "Parámetros", icon: <Settings className="w-4 h-4" /> },
];

/**
 * Mapa de permisos por ítem de navegación (Sprint 3D-7.11K.1).
 * Los ítems sin entrada son siempre visibles (ej. "dashboard").
 * El filtrado es fail-open: si los permisos aún están cargando o la llamada
 * falló, se muestran todos los ítems (ver usePermisos()).
 */
const PERMISO_POR_ITEM: Readonly<Partial<Record<string, string>>> = {
  clientes:     "clientes:listar",
  solicitudes:  "solicitudes:listar",
  programacion: "programacion:listar",
  viajes:       "viajes:listar",
  mapa:         "gps:listar",
  cumplidos:    "cumplidos:listar",
  // "dashboard": siempre visible — sin entrada
};

const PERMISO_POR_CONFIG: Readonly<Partial<Record<string, string>>> = {
  usuarios:         "rbac:gestionar",
  "roles-permisos": "rbac:gestionar",
  parametros:       "configuracion:acceso",
};

const STORAGE_KEY = "inlop-erp-sidebar-collapsed";

// Easing compartido — Material Design standard easing
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

interface Props {
  vista: Vista;
  setVista: (v: Vista) => void;
  /** Navega preservando `NavPayload` (Sprint 3D-7.11J.2) — lo usan los 3
   *  ítems fijos de "CONFIGURACIÓN" para indicar qué sub-pantalla abrir
   *  (`configSubVista`) sin depender de que ConfiguracionPage ya esté
   *  montada. Ver NavigationContext. */
  navigateTo: (dest: NavigationDestination) => void;
  children: ReactNode;
  badges?: Partial<Record<Vista, number>>;
  /** Tramo de breadcrumb adicional declarado por el módulo actual (Sprint
   *  3D-7.11F) — ver NavigationContext. `null`/`undefined` = breadcrumb por
   *  defecto (INLOP › [sección] › [ítem de nav actual]). */
  breadcrumbTrail?: BreadcrumbItem[] | null;
  /** Cuál de los 3 ítems fijos de "CONFIGURACIÓN" está activo (Sprint
   *  3D-7.11J.2) — ver NavigationContext. Los ítems mismos son estáticos y
   *  siempre se renderizan; esto solo decide el resaltado. `null`/`undefined`
   *  (Configuración no montada) o vista !== "configuracion" → ninguno activo. */
  configActiveItem?: "usuarios" | "roles-permisos" | "parametros" | null;
}

export function AppShell({ vista, setVista, navigateTo, children, badges = {}, breadcrumbTrail, configActiveItem }: Props) {
  const { profile, signOut } = useAuth();

  // ── Permisos (Sprint 3D-7.11K.1) ──────────────────────────────────────────
  // Una única llamada a GET /api/me/permisos para toda la shell.
  // Fail-open: mientras cargando===true (o si falló), se muestran todos los ítems.
  const { esMaster, permisos: listaPermisos, cargando: cargandoPermisos } = usePermisos();

  /** Devuelve true si el ítem con ese permiso requerido debe mostrarse. */
  const puedeVer = useMemo(() => {
    return (permiso: string | undefined): boolean => {
      if (cargandoPermisos) return true;          // fail-open (cargando o error)
      if (esMaster) return true;                  // master ve todo
      if (!permiso) return true;                  // sin permiso requerido → siempre visible
      return listaPermisos.includes(permiso);
    };
  }, [cargandoPermisos, esMaster, listaPermisos]);

  /** Secciones de nav con sus ítems filtrados por permiso. */
  const navSeccionesVisibles = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items:
          section.id === "sistema"
            ? section.items // la sección "sistema" se renderiza aparte (CONFIG_SIDEBAR_ITEMS)
            : section.items.filter((item) => puedeVer(PERMISO_POR_ITEM[item.id])),
      })).filter((section) => section.id === "sistema" || section.items.length > 0),
    [puedeVer]
  );

  /** Ítems del bloque Configuración filtrados por permiso. */
  const configItemsVisibles = useMemo(
    () => CONFIG_SIDEBAR_ITEMS.filter((item) => puedeVer(PERMISO_POR_CONFIG[item.key])),
    [puedeVer]
  );

  // ──────────────────────────────────────────────────────────────────────────

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true"
  );

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  // Texto: desvanece rápido al colapsar, aparece tarde al expandir (espera a que el aside abra)
  const textStyle: CSSProperties = collapsed
    ? {
        maxWidth: 0, opacity: 0, overflow: "hidden", whiteSpace: "nowrap", flexShrink: 0,
        transition: `opacity 80ms ease, max-width 200ms ${EASE}`,
      }
    : {
        maxWidth: "200px", opacity: 1, overflow: "hidden", whiteSpace: "nowrap", flexShrink: 0,
        transition: `opacity 150ms ease 180ms, max-width 250ms ${EASE}`,
      };

  // Etiqueta de sección: colapsa verticalmente con el texto
  const sectionLabelStyle: CSSProperties = collapsed
    ? { opacity: 0, maxHeight: 0, overflow: "hidden", transition: `opacity 80ms ease, max-height 200ms ${EASE}` }
    : { opacity: 1, maxHeight: "32px", overflow: "hidden", transition: `opacity 150ms ease 180ms, max-height 250ms ${EASE}` };

  // Tooltip compartido — dark pill a la derecha del sidebar
  const tooltipCls = [
    "pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3",
    "flex items-center gap-2 px-2.5 py-1.5 whitespace-nowrap",
    "text-white text-[var(--text-sm)] font-medium",
    "opacity-0 transition-opacity duration-[120ms]",
  ].join(" ");
  const tooltipStyle: CSSProperties = {
    background: "var(--navy)", borderRadius: "var(--radius-md)",
    boxShadow: "var(--shadow-card)", zIndex: 50,
  };

  /** Botón de navegación del sidebar — extraído (Sprint 3D-7.11J) para
   *  reutilizarlo tal cual tanto en los ítems planos de cada NavSection como
   *  en los subgrupos dinámicos de "CONFIGURACIÓN" (sidebarGroups): mismo
   *  markup, mismas clases/estilos, mismo tooltip en modo colapsado — cero
   *  estilo nuevo, solo se parametrizan id/label/icon/active/onClick/badge
   *  en vez de derivarlos de `vista === item.id`. */
  function renderNavButton({
    id, label, icon, active, badge, onClick,
  }: { id: string; label: string; icon: ReactNode; active: boolean; badge?: number; onClick: () => void }) {
    return (
      <div key={id} className="relative group/nav">
        <button
          onClick={onClick}
          aria-current={active ? "page" : undefined}
          className={[
            "w-full flex items-center py-2.5 text-left text-[var(--text-md)] font-medium",
            "rounded-[var(--radius-xl)]",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-dark)]",
            collapsed ? "justify-center gap-0" : "gap-3 px-3",
            active
              ? "bg-[var(--navy-mid)] text-white"
              : "text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.85)]",
          ].join(" ")}
          style={{ borderLeft: active ? "2px solid var(--inlop-red)" : "2px solid transparent" }}
        >
          <span className="shrink-0">{icon}</span>
          <span style={textStyle}>{label}</span>
          {badge !== undefined && badge > 0 && (
            <span
              aria-label={`${badge} notificaciones`}
              className="text-[var(--text-xs)] font-bold px-1.5 py-0.5 rounded-[var(--radius-full)] min-w-[18px] text-center shrink-0"
              style={{
                background: "var(--inlop-red)", color: "#fff",
                ...(collapsed
                  ? { opacity: 0, maxWidth: 0, overflow: "hidden", transition: `opacity 80ms ease, max-width 200ms ${EASE}` }
                  : { opacity: 1, maxWidth: "40px", transition: `opacity 150ms ease 180ms, max-width 250ms ${EASE}` }
                ),
              }}
            >
              {badge}
            </span>
          )}
        </button>

        {collapsed && (
          <div role="tooltip" className={`${tooltipCls} group-hover/nav:opacity-100`} style={tooltipStyle}>
            {label}
            {badge !== undefined && badge > 0 && (
              <span
                className="text-[var(--text-xs)] font-bold px-1.5 py-0.5 rounded-[var(--radius-full)] min-w-[18px] text-center"
                style={{ background: "var(--inlop-red)", color: "#fff" }}
              >
                {badge}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    // `height: 100vh` explícito (Sprint 3D-7.11E.3.1) además de `h-svh` —
    // refuerzo defensivo: la altura del shell no debe depender únicamente
    // de que el navegador soporte `svh` y de que el build genere esa
    // utilidad; `100vh` es el valor de máxima compatibilidad para un shell
    // de escritorio como este. Con ambos presentes el estilo en línea
    // decide (mismo valor de facto en desktop), sin cambiar nada visible.
    <div className="flex h-svh w-full overflow-hidden" style={{ height: "100vh" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {/*
       * z-index: 10 — crea un stacking context para que los tooltips
       * absolutamente posicionados aparezcan sobre el área principal.
       * Sin overflow en aside/nav — necesario para que los tooltips no sean recortados.
       */}
      <aside
        aria-label="Barra lateral"
        className="relative flex flex-col shrink-0 h-full"
        style={{
          width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)",
          background: "var(--navy-dark)",
          zIndex: 10,
          // Al colapsar: texto desvanece primero (60ms delay antes de que el aside empiece)
          // Al expandir: aside abre primero, luego el texto aparece (180ms delay en textStyle)
          transition: collapsed
            ? `width 220ms ${EASE} 60ms`
            : `width 250ms ${EASE}`,
        }}
      >

        {/* Logo ── isotipo siempre visible, texto se desvanece */}
        <div className="px-3 py-5 flex items-center gap-3 overflow-hidden">
          <div
            aria-hidden="true"
            className="shrink-0 h-9 w-9 flex items-center justify-center font-bold text-[var(--text-md)]"
            style={{ background: "var(--inlop-red)", color: "#fff", borderRadius: "var(--radius-xl)" }}
          >
            {/* TODO: reemplazar por <img src="/isotipo.svg" alt="INLOP" /> cuando esté disponible */}
            IN
          </div>
          <div style={textStyle}>
            <div className="font-bold text-[var(--text-md)] text-white leading-tight">INLOP</div>
            <div className="leading-tight whitespace-nowrap" style={{ color: "rgba(255,255,255,0.45)", fontSize: "var(--text-xs)" }}>
              ERP
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 var(--space-4)" }} />

        {/* Nav ── flex col, sin overflow para que los tooltips no sean recortados */}
        <nav aria-label="Navegación principal" className="flex-1 px-3 py-3 flex flex-col">

          {navSeccionesVisibles.filter((s) => s.items.length > 0).map((section, idx) => (
            <div key={section.id} className={idx > 0 ? "mt-4" : ""}>

              {/* Etiqueta de sección */}
              <div
                aria-hidden="true"
                className="px-3 pt-1 pb-1.5 text-[var(--text-xs)] font-semibold select-none"
                style={{ color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", ...sectionLabelStyle }}
              >
                {section.label}
              </div>

              {/* Ítems — la sección "CONFIGURACIÓN" tiene sus propios 3 ítems
                  fijos (Usuarios/Roles/Parámetros, Sprint 3D-7.11J.2):
                  siempre visibles, sin agrupadores ni acordeones, sin
                  depender de que ConfiguracionPage esté montada. El resto de
                  secciones sigue exactamente igual (ítem plano por Vista). */}
              {section.id === "sistema" ? (
                <div className="flex flex-col gap-0.5">
                  {configItemsVisibles.map((item) => renderNavButton({
                    id: item.key, label: item.label, icon: item.icon,
                    active: vista === "configuracion" && (configActiveItem ?? "parametros") === item.key,
                    onClick: () => navigateTo({ modulo: "configuracion", payload: { configSubVista: item.key } }),
                  }))}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => renderNavButton({
                    id: item.id, label: item.label, icon: item.icon,
                    active: vista === item.id, badge: badges[item.id],
                    onClick: () => setVista(item.id),
                  }))}
                </div>
              )}
            </div>
          ))}

          {/* Toggle ── empujado al fondo del nav con mt-auto */}
          <div className="mt-auto pt-3">
            <div className="relative group/toggle">
              <button
                onClick={toggle}
                aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
                aria-expanded={!collapsed}
                className={[
                  "w-full flex items-center py-2 rounded-[var(--radius-lg)]",
                  "text-[rgba(255,255,255,0.35)] transition-colors duration-150",
                  "hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.65)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-dark)]",
                  collapsed ? "justify-center gap-0" : "gap-2 px-3",
                ].join(" ")}
              >
                {collapsed
                  ? <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0" />
                  : <ChevronLeft  aria-hidden="true" className="w-4 h-4 shrink-0" />
                }
                <span className="text-[var(--text-xs)] font-medium" style={textStyle}>Contraer</span>
              </button>

              {/* Tooltip toggle (colapsado) */}
              {collapsed && (
                <div
                  role="tooltip"
                  className={`${tooltipCls} group-hover/toggle:opacity-100`}
                  style={tooltipStyle}
                >
                  Expandir
                </div>
              )}
            </div>
          </div>
        </nav>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 var(--space-4)" }} />

        {/* Footer — únicamente acción de cierre de sesión; perfil en el Header */}
        <div className="py-3 px-3">
          <div className="relative group/signout">
            <button
              onClick={signOut}
              aria-label="Cerrar sesión"
              className={[
                "w-full flex items-center text-[var(--text-base)] py-2 rounded-[var(--radius-lg)]",
                "text-[rgba(255,255,255,0.45)] transition-colors duration-150",
                "hover:bg-[rgba(255,255,255,0.07)] hover:text-white",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-dark)]",
                collapsed ? "justify-center gap-0" : "gap-2 px-3",
              ].join(" ")}
            >
              <LogOut aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
              <span style={textStyle}>Cerrar sesión</span>
            </button>

            {/* Tooltip cerrar sesión (colapsado) */}
            {collapsed && (
              <div
                role="tooltip"
                className={`${tooltipCls} group-hover/signout:opacity-100`}
                style={tooltipStyle}
              >
                Cerrar sesión
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      {/* `min-h-0` (Sprint 3D-7.11E.3.1) — un hijo flex tiene por defecto un
          tamaño mínimo automático (`min-height: auto`) que, en algunos
          navegadores/condiciones de contenido, puede impedir que se encoja
          por debajo del tamaño de su propio contenido dentro de un
          contenedor de altura fija. Este wrapper y <main> (abajo) son la
          cadena completa que debe poder encogerse para que <main> sea el
          único que scrollea internamente — nunca el documento. Sin efecto
          visual en ninguna pantalla existente. */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="grid items-center gap-4 px-5 shrink-0"
          style={{
            gridTemplateColumns: "1fr auto 1fr",
            height: "var(--topbar-height)",
            background: "#fff",
            borderBottom: "1px solid var(--gray-100)",
          }}
        >
          {/* Breadcrumb semántico — WAI-ARIA breadcrumb pattern. "INLOP" es
              siempre navegable a Inicio; si el módulo actual declaró un
              `breadcrumbTrail` propio (Sprint 3D-7.11F, ej. Configuración →
              Usuarios → Gestión de permisos) se usa ese en vez del breadcrumb
              genérico de sección/ítem de nav. */}
          <nav aria-label="Ruta de navegación">
            {(() => {
              const crumbBtnCls = "hover:underline focus-visible:outline-none";
              const crumbBtnStyle: CSSProperties = { color: "inherit" };

              if (breadcrumbTrail && breadcrumbTrail.length > 0) {
                return (
                  <ol className="flex items-center gap-1.5 list-none m-0 p-0 text-[var(--text-md)]" style={{ color: "var(--gray-400)" }}>
                    <li>
                      <button type="button" className={crumbBtnCls} style={crumbBtnStyle} onClick={() => setVista("dashboard")}>INLOP</button>
                    </li>
                    <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
                    {breadcrumbTrail.map((crumb, i) => {
                      const esUltimo = i === breadcrumbTrail.length - 1;
                      return (
                        <li key={i} className="flex items-center gap-1.5">
                          {esUltimo || !crumb.onClick ? (
                            <span
                              aria-current={esUltimo ? "page" : undefined}
                              style={esUltimo ? { color: "var(--gray-700)", fontWeight: "var(--weight-semibold)" } : undefined}
                            >
                              {crumb.label}
                            </span>
                          ) : (
                            <button type="button" className={crumbBtnCls} style={crumbBtnStyle} onClick={crumb.onClick}>{crumb.label}</button>
                          )}
                          {!esUltimo && <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />}
                        </li>
                      );
                    })}
                  </ol>
                );
              }

              const activeSec  = NAV_SECTIONS.find(s => s.items.some(i => i.id === vista));
              const activeItem = NAV_ALL.find(n => n.id === vista);
              return (
                <ol className="flex items-center gap-1.5 list-none m-0 p-0 text-[var(--text-md)]" style={{ color: "var(--gray-400)" }}>
                  <li>
                    <button type="button" className={crumbBtnCls} style={crumbBtnStyle} onClick={() => setVista("dashboard")}>INLOP</button>
                  </li>
                  <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
                  {activeSec?.breadcrumbLabel && (
                    <>
                      <li>{activeSec.breadcrumbLabel}</li>
                      <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
                    </>
                  )}
                  <li aria-current="page" style={{ color: "var(--gray-700)", fontWeight: "var(--weight-semibold)" }}>
                    {activeItem?.label ?? "—"}
                  </li>
                </ol>
              );
            })()}
          </nav>

          {/* Centro — Buscador global */}
          <TopbarSearch onNavigate={(id) => setVista(id as Vista)} />

          {/* Derecha — notificaciones + menú de usuario */}
          <div className="flex items-center justify-end gap-1">
            <TopbarNotifications />
            <div style={{ width: 1, height: 20, background: "var(--gray-200)", margin: "0 4px" }} aria-hidden="true" />
            <TopbarUserMenu
              profile={{
                nombre: profile?.nombre ?? "Usuario",
                cargo:  profile?.cargo,
                rol:    profile?.rol,
                email:  profile?.email,
              }}
              onSignOut={signOut}
            />
          </div>
        </header>

        {/* Page content — único contenedor con scroll vertical de todo el
            shell (ver comentario de min-h-0 arriba). */}
        <main className="flex-1 min-h-0 overflow-y-auto" style={{ background: "var(--gray-50)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
