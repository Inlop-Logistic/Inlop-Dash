import { useState } from "react";
import { ChevronRight, Settings, SlidersHorizontal } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { ParametrosPage } from "./ParametrosPage";
import { ReportesAutomaticosPage } from "./ReportesAutomaticosPage";

type SubVista = "home" | "parametros" | "reportes-automaticos";

interface OpcionCard {
  icon:        React.ReactNode;
  titulo:      string;
  descripcion: string;
  onClick:     () => void;
}

function OpcionCard({ icon, titulo, descripcion, onClick }: OpcionCard) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-[var(--radius-2xl)]"
    >
      <Card
        className="hover:shadow-md transition-shadow"
        style={{ cursor: "pointer" }}
      >
        <div className="px-5 py-4 flex items-center gap-4">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--navy-dark)", color: "#fff" }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[14px] leading-snug" style={{ color: "var(--navy)" }}>
              {titulo}
            </div>
            <div className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--gray-400)" }}>
              {descripcion}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
        </div>
      </Card>
    </button>
  );
}

export function ConfiguracionPage() {
  const [subVista, setSubVista] = useState<SubVista>("home");

  if (subVista === "parametros") {
    return (
      <ParametrosPage
        onBack={() => setSubVista("home")}
        onReportesAutomaticos={() => setSubVista("reportes-automaticos")}
      />
    );
  }

  if (subVista === "reportes-automaticos") {
    return (
      <ReportesAutomaticosPage
        onBack={() => setSubVista("parametros")}
      />
    );
  }

  // Home: listado de secciones de Configuración implementadas
  return (
    <div className="p-6 flex flex-col gap-6">
      <PageHeader
        title="Configuración"
        subtitle="Administra los parámetros y ajustes del sistema."
        icon={<Settings className="w-5 h-5" />}
      />

      <div className="flex flex-col gap-3 max-w-xl">
        <OpcionCard
          icon={<SlidersHorizontal className="w-5 h-5" />}
          titulo="Parámetros"
          descripcion="Configuraciones funcionales del ERP."
          onClick={() => setSubVista("parametros")}
        />
      </div>
    </div>
  );
}
