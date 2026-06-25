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

interface NavItem { id: Vista; label: string; icon: ReactNode; badge?: number }

const NAV: NavItem[] = [
  { id: "dashboard",   label: "Dashboard",   icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "solicitudes", label: "Solicitudes",  icon: <ClipboardList   className="w-4 h-4" /> },
  { id: "viajes",      label: "Viajes",       icon: <Truck           className="w-4 h-4" /> },
  { id: "mapa",        label: "Mapa GPS",     icon: <Map             className="w-4 h-4" /> },
  { id: "alarmas",     label: "Alarmas",      icon: <AlertTriangle   className="w-4 h-4" /> },
  { id: "vehiculos",   label: "Vehículos",    icon: <Car             className="w-4 h-4" /> },
  { id: "planeados",   label: "Planeados",    icon: <CalendarDays    className="w-4 h-4" /> },
  { id: "cumplidos",   label: "Cumplidos",    icon: <CheckSquare     className="w-4 h-4" /> },
];

interface Props {
  vista: Vista;
  setVista: (v: Vista) => void;
  children: ReactNode;
  badges?: Partial<Record<Vista, number>>;
}

export function AppShell({ vista, setVista, children, badges = {} }: Props) {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────── */}
      <aside
        className="flex flex-col w-[220px] shrink-0 h-full"
        style={{ background: "var(--navy-dark)" }}
      >
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-[13px]"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            IN
          </div>
          <div>
            <div className="font-bold text-[13px] text-white leading-tight">INLOP ERP</div>
            <div className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>
              Torre de Control
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 16px" }} />

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = vista === item.id;
            const badge  = badges[item.id];
            return (
              <button
                key={item.id}
                onClick={() => setVista(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-[13px] font-medium relative"
                style={{
                  background:  active ? "var(--navy-mid)" : "transparent",
                  color:       active ? "#fff" : "rgba(255,255,255,0.55)",
                  borderLeft:  active ? "2px solid var(--inlop-red)" : "2px solid transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {badge !== undefined && badge > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                    style={{ background: "var(--inlop-red)", color: "#fff" }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 16px" }} />

        {/* Footer usuario */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px]"
              style={{ background: "var(--inlop-red)", color: "#fff" }}
            >
              {profile?.nombre?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white truncate">{profile?.nombre ?? "—"}</div>
              <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                {profile?.cargo ?? profile?.rol ?? "—"}
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg transition-all"
            style={{ color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="h-14 flex items-center justify-between px-6 shrink-0"
          style={{ background: "#fff", borderBottom: "1px solid var(--gray-100)" }}
        >
          <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--gray-400)" }}>
            <span>INLOP ERP</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span style={{ color: "var(--gray-700)", fontWeight: 600 }}>
              {NAV.find((n) => n.id === vista)?.label ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
              {profile?.nombre}
            </span>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-[11px]"
              style={{ background: "var(--navy)", color: "#fff" }}
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
