import { useState } from "react";
import { AuthProvider, useAuth } from "@/state/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import type { Vista } from "@/types/navigation";
import { LoginPage } from "@/pages/LoginPage";
import { SolicitudesPage } from "@/pages/SolicitudesPage";

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
  const [vista, setVista] = useState<Vista>("solicitudes");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[13px]" style={{ color: "var(--gray-400)" }}>Cargando…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const renderPage = () => {
    if (vista === "solicitudes") return <SolicitudesPage />;
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
      <AppInner />
    </AuthProvider>
  );
}
