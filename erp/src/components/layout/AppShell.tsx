import type { ReactNode } from "react";
import { useAuth } from "@/state/AuthContext";
import {
  LayoutDashboard, ClipboardList, Truck, Map,
  AlertTriangle, Car, CalendarDays, CheckSquare,
  LogOut, ChevronRight,
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

// ── Estructura de navegación ──────────────────────────────────────────────────
//
// Agregar un nuevo módulo: push a items[] de la sección correspondiente
//        y extender el tipo Vista con el nuevo id.
// Agregar una nueva sección: descomentar la entrada correspondiente e incluir
//        sus NavItem[] cuando el módulo esté listo.
//
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
  // { id: "comercial",      label: "COMERCIAL",      items: [] },
  // { id: "finanzas",       label: "FINANZAS",        items: [] },
  // { id: "talento_humano", label: "TALENTO HUMANO",  items: [] },
  // { id: "hseq",           label: "HSEQ",            items: [] },
  // { id: "configuracion",  label: "CONFIGURACIÓN",   items: [] },
];

// Vista plana de todos los ítems — usada para búsquedas (breadcrumb, etc.)
const NAV_ALL = NAV_SECTIONS.flatMap((s) => s.items);

interface Props {
  vista: Vista;
  setVista: (v: Vista) => void;
  children: ReactNode;
  badges?: Partial<Record<Vista, number>>;
}

export function AppShell({ vista, setVista, children, badges = {} }: Props) {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex h-svh w-full overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────── */}
      <aside
        aria-label="Barra lateral"
        className="flex flex-col shrink-0 h-full"
        style={{ width: "var(--sidebar-width)", background: "var(--navy-dark)" }}
      >
        {/* Logo — isotipo es decorativo; el nombre del producto lo describe */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div
            aria-hidden="true"
            className="h-9 w-9 flex items-center justify-center shrink-0 font-bold text-[var(--text-md)]"
            style={{ background: "var(--inlop-red)", color: "#fff", borderRadius: "var(--radius-xl)" }}
          >
            {/* TODO: reemplazar por <img src="/isotipo.svg" alt="INLOP" /> cuando esté disponible */}
            IN
          </div>
          <div>
            <div className="font-bold text-[var(--text-md)] text-white leading-tight">INLOP ERP</div>
            <div className="leading-tight whitespace-nowrap" style={{ color: "rgba(255,255,255,0.45)", fontSize: "var(--text-xs)" }}>
              Plataforma Empresarial Integrada
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 var(--space-4)" }} />

        {/* Nav — secciones con agrupación lógica */}
        <nav aria-label="Navegación principal" className="flex-1 px-3 py-3 flex flex-col overflow-y-auto">
          {NAV_SECTIONS.filter((s) => s.items.length > 0).map((section, sectionIdx) => (
            <div key={section.id} className={sectionIdx > 0 ? "mt-4" : ""}>

              {/* Etiqueta de sección */}
              <div
                className="px-3 pt-1 pb-1.5 text-[var(--text-xs)] font-semibold tracking-widest select-none"
                style={{ color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em" }}
                aria-hidden="true"
              >
                {section.label}
              </div>

              {/* Ítems de la sección */}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = vista === item.id;
                  const badge  = badges[item.id];
                  return (
                    <button
                      key={item.id}
                      onClick={() => setVista(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all text-[var(--text-md)] font-medium relative",
                        "rounded-[var(--radius-xl)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-dark)]",
                        active
                          ? "bg-[var(--navy-mid)] text-white"
                          : "text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.85)]",
                      ].join(" ")}
                      style={{ borderLeft: active ? "2px solid var(--inlop-red)" : "2px solid transparent" }}
                    >
                      {item.icon}
                      <span className="flex-1">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span
                          aria-label={`${badge} notificaciones`}
                          className="text-[var(--text-xs)] font-bold px-1.5 py-0.5 rounded-[var(--radius-full)] min-w-[18px] text-center"
                          style={{ background: "var(--inlop-red)", color: "#fff" }}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 var(--space-4)" }} />

        {/* Footer usuario */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2.5 mb-3">
            {/* Avatar decorativo — el nombre se muestra en texto adyacente */}
            <div
              aria-hidden="true"
              className="h-8 w-8 rounded-[var(--radius-full)] flex items-center justify-center shrink-0 font-bold text-[var(--text-sm)]"
              style={{ background: "var(--inlop-red)", color: "#fff" }}
            >
              {profile?.nombre?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <div className="text-[var(--text-base)] font-semibold text-white truncate">{profile?.nombre ?? "—"}</div>
              <div className="text-[var(--text-xs)] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                {profile?.cargo ?? profile?.rol ?? "—"}
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            aria-label="Cerrar sesión"
            className="w-full flex items-center gap-2 text-[var(--text-base)] px-3 py-2 rounded-[var(--radius-lg)] transition-all text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-dark)]"
          >
            <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: "var(--topbar-height)", background: "#fff", borderBottom: "1px solid var(--gray-100)" }}
        >
          {/* Breadcrumb semántico — WAI-ARIA breadcrumb pattern */}
          <nav aria-label="Ruta de navegación">
            <ol className="flex items-center gap-1.5 list-none m-0 p-0 text-[var(--text-md)]" style={{ color: "var(--gray-400)" }}>
              <li>
                <span>INLOP ERP</span>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
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
