import { AuthProvider, useAuth } from "@/state/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { NavigationProvider, useNavigationContext } from "@/core/navigation";
import { LoginPage } from "@/pages/LoginPage";
import { SetPasswordPage } from "@/pages/SetPasswordPage";
import { SolicitudesPage } from "@/pages/SolicitudesPage";
import { ProgramacionPage } from "@/pages/ProgramacionPage";
import { ViajesPage } from "@/pages/ViajesPage";
import { CumplidosPage } from "@/pages/CumplidosPage";
import { GpsPage } from "@/pages/GpsPage";
import { ClientesPage } from "@/pages/ClientesPage";
import { ConfiguracionPage } from "@/pages/ConfiguracionPage";

function ComingSoon({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-32 gap-3">
      <div className="font-bold text-[18px]" style={{ color: "var(--navy)" }}>{titulo}</div>
      <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>Módulo en construcción — próximamente disponible.</p>
    </div>
  );
}

function AppInner() {
  const { user, loading, recoveryMode } = useAuth();
  const { vista, setVista } = useNavigationContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[13px]" style={{ color: "var(--gray-400)" }}>Cargando…</div>
      </div>
    );
  }

  // Sesión de recuperación de contraseña (Sprint 3D-7.8D) — SIEMPRE tiene
  // prioridad sobre `user`: un usuario que llega por /invite o /recover
  // nunca debe entrar al dashboard, sin importar que Supabase le haya dado
  // una sesión temporal válida (ver AuthContext.tsx#recoveryMode).
  if (recoveryMode) return <SetPasswordPage />;

  if (!user) return <LoginPage />;

  const renderPage = () => {
    if (vista === "solicitudes")  return <SolicitudesPage />;
    if (vista === "programacion") return <ProgramacionPage />;
    if (vista === "viajes")       return <ViajesPage />;
    if (vista === "cumplidos")    return <CumplidosPage />;
    if (vista === "mapa")         return <GpsPage />;
    if (vista === "clientes")       return <ClientesPage />;
    if (vista === "configuracion")  return <ConfiguracionPage />;
    return <ComingSoon titulo={vista.charAt(0).toUpperCase() + vista.slice(1)} />;
  };

  return (
    <AppShell vista={vista} setVista={setVista}>
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationProvider>
        <AppInner />
      </NavigationProvider>
    </AuthProvider>
  );
}
