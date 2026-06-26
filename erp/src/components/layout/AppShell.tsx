import { useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "@/state/AuthContext";
import {
  LayoutDashboard, ClipboardList, Truck, Map,
  AlertTriangle, Car, CalendarDays, CheckSquare,
  LogOut, ChevronRight, ChevronLeft,
} from "lucide-react";

export type Vista =
  | "dashboard"
  | "solicitudes"
  | "viajes"
  | "mapa"
  | "alarmas"
  | "vehiculos"
  | "planeados"
  | "cumplidos";

interface NavItem    { id: Vista; label: string; icon: ReactNode; badge?: number }
interface NavSection { id: string; label: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    id: "operaciones",
    label: "OPERACIONES",
    items: [
      { id: "dashboard",   label: "Inicio",      icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: "solicitudes", label: "Solicitudes",  icon: <ClipboardList   className="w-4 h-4" /> },
      { id: "viajes",      label: "Viajes",       icon: <Truck           className="w-4 h-4" /> },
      { id: "mapa",        label: "Mapa GPS",     icon: <Map             className="w-4 h-4" /> },
      { id: "alarmas",     label: "Alarmas",      icon: <AlertTriangle   className="w-4 h-4" /> },
      { id: "vehiculos",   label: "Vehículos",    icon: <Car             className="w-4 h-4" /> },
      { id: "planeados",   label: "Planeados",    icon: <CalendarDays    className="w-4 h-4" /> },
      { id: "cumplidos",   label: "Cumplidos",    icon: <CheckSquare     className="w-4 h-4" /> },
    ],
  },
  // Secciones futuras — descomentar y agregar items[] cuando el módulo esté listo:
  // { id: "comercial",      label: "COMERCIAL",      items: [] },
  // { id: "finanzas",       label: "FINANZAS",        items: [] },
  // { id: "talento_humano", label: "TALENTO HUMANO",  items: [] },
  // { id: "hseq",           label: "HSEQ",            items: [] },
  // { id: "configuracion",  label: "CONFIGURACIÓN",   items: [] },
];

const NAV_ALL = NAV_SECTIONS.flatMap((s) => s.items);

const STORAGE_KEY = "inlop-erp-sidebar-collapsed";

// Easing compartido — Material Design standard easing
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

interface Props {
  vista: Vista;
  setVista: (v: Vista) => void;
  children: ReactNode;
  badges?: Partial<Record<Vista, number>>;
}

export function AppShell({ vista, setVista, children, badges = {} }: Props) {
  const { profile, signOut } = useAuth();

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

  return (
    <div className="flex h-svh w-full overflow-hidden">

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
            <div className="font-bold text-[var(--text-md)] text-white leading-tight">INLOP ERP</div>
            <div className="leading-tight whitespace-nowrap" style={{ color: "rgba(255,255,255,0.45)", fontSize: "var(--text-xs)" }}>
              Plataforma Empresarial Integrada
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 var(--space-4)" }} />

        {/* Nav ── flex col, sin overflow para que los tooltips no sean recortados */}
        <nav aria-label="Navegación principal" className="flex-1 px-3 py-3 flex flex-col">

          {NAV_SECTIONS.filter((s) => s.items.length > 0).map((section, idx) => (
            <div key={section.id} className={idx > 0 ? "mt-4" : ""}>

              {/* Etiqueta de sección */}
              <div
                aria-hidden="true"
                className="px-3 pt-1 pb-1.5 text-[var(--text-xs)] font-semibold select-none"
                style={{ color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", ...sectionLabelStyle }}
              >
                {section.label}
              </div>

              {/* Ítems */}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = vista === item.id;
                  const badge  = badges[item.id];
                  return (
                    <div key={item.id} className="relative group/nav">
                      <button
                        onClick={() => setVista(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "w-full flex items-center py-2.5 text-left text-[var(--text-md)] font-medium",
                          "rounded-[var(--radius-xl)]",
                          "transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-dark)]",
                          // gap y padding condicionales: gap-0 evita descentrado del ícono en modo colapsado
                          collapsed ? "justify-center gap-0" : "gap-3 px-3",
                          active
                            ? "bg-[var(--navy-mid)] text-white"
                            : "text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.85)]",
                        ].join(" ")}
                        style={{ borderLeft: active ? "2px solid var(--inlop-red)" : "2px solid transparent" }}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span style={textStyle}>{item.label}</span>
                        {badge !== undefined && badge > 0 && (
                          <span
                            aria-label={`${badge} notificaciones`}
                            className="text-[var(--text-xs)] font-bold px-1.5 py-0.5 rounded-[var(--radius-full)] min-w-[18px] text-center shrink-0"
                            style={{
                              background: "var(--inlop-red)", color: "#fff",
                              // Badge se desvanece con el texto en modo colapsado
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

                      {/* Tooltip — solo en modo colapsado */}
                      {collapsed && (
                        <div
                          role="tooltip"
                          className={`${tooltipCls} group-hover/nav:opacity-100`}
                          style={tooltipStyle}
                        >
                          {item.label}
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
                })}
              </div>
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

        {/* Footer usuario */}
        <div className="py-4 px-3">
          <div className={`flex items-center mb-3 overflow-hidden ${collapsed ? "justify-center gap-0" : "gap-2.5"}`}>
            {/* Avatar decorativo — el nombre se muestra en texto adyacente */}
            <div
              aria-hidden="true"
              className="shrink-0 h-8 w-8 rounded-[var(--radius-full)] flex items-center justify-center font-bold text-[var(--text-sm)]"
              style={{ background: "var(--inlop-red)", color: "#fff" }}
            >
              {profile?.nombre?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0" style={textStyle}>
              <div className="text-[var(--text-base)] font-semibold text-white truncate">{profile?.nombre ?? "—"}</div>
              <div className="text-[var(--text-xs)] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                {profile?.cargo ?? profile?.rol ?? "—"}
              </div>
            </div>
          </div>

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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: "var(--topbar-height)", background: "#fff", borderBottom: "1px solid var(--gray-100)" }}
        >
          {/* Breadcrumb semántico — WAI-ARIA breadcrumb pattern */}
          <nav aria-label="Ruta de navegación">
            <ol className="flex items-center gap-1.5 list-none m-0 p-0 text-[var(--text-md)]" style={{ color: "var(--gray-400)" }}>
              <li><span>INLOP ERP</span></li>
              <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
              <li aria-current="page" style={{ color: "var(--gray-700)", fontWeight: "var(--weight-semibold)" }}>
                {NAV_ALL.find((n) => n.id === vista)?.label ?? "—"}
              </li>
            </ol>
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-[var(--text-base)]" style={{ color: "var(--gray-500)" }}>
              {profile?.nombre}
            </span>
            {/* Avatar decorativo — el nombre se muestra en el span adyacente */}
            <div
              aria-hidden="true"
              className="h-8 w-8 rounded-[var(--radius-full)] flex items-center justify-center font-bold text-[var(--text-sm)]"
              style={{ background: "var(--inlop-red)", color: "#fff" }}
            >
              {profile?.nombre?.charAt(0).toUpperCase() ?? "U"}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--gray-50)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
