import { AuthProvider, useAuth } from "@/state/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { NavigationProvider, useNavigationContext } from "@/core/navigation";
import { LoginPage } from "@/pages/LoginPage";
import { SolicitudesPage } from "@/pages/SolicitudesPage";
import { ProgramacionPage } from "@/pages/ProgramacionPage";
import { ViajesPage } from "@/pages/ViajesPage";

function ComingSoon({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-32 gap-3">
      <div className="font-bold text-[18px]" style={{ color: "var(--navy)" }}>{titulo}</div>
      <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>Módulo en construcción — próximamente disponible.</p>
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  const { vista, setVista } = useNavigationContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[13px]" style={{ color: "var(--gray-400)" }}>Cargando…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const renderPage = () => {
    if (vista === "solicitudes")  return <SolicitudesPage />;
    if (vista === "programacion") return <ProgramacionPage />;
    if (vista === "viajes")       return <ViajesPage />;
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
