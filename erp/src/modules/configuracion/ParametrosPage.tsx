import { ChevronRight, Mail, SlidersHorizontal } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";

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
      style={{ focusRingColor: "var(--navy)" } as React.CSSProperties}
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

interface Props {
  onBack:               () => void;
  onReportesAutomaticos: () => void;
}

export function ParametrosPage({ onBack, onReportesAutomaticos }: Props) {
  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Migas de pan interna */}
      <nav aria-label="Ruta interna" className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--gray-400)" }}>
        <button
          type="button"
          onClick={onBack}
          className="hover:underline focus-visible:outline-none"
          style={{ color: "var(--gray-500)" }}
        >
          Configuración
        </button>
        <span aria-hidden="true">›</span>
        <span style={{ color: "var(--gray-700)", fontWeight: 600 }}>Parámetros</span>
      </nav>

      <PageHeader
        title="Parámetros"
        subtitle="Configuraciones funcionales del ERP."
        icon={<SlidersHorizontal className="w-5 h-5" />}
      />

      <div className="flex flex-col gap-3 max-w-xl">
        <OpcionCard
          icon={<Mail className="w-5 h-5" />}
          titulo="Reportes Automáticos"
          descripcion="Configura reportes que el ERP genera y envía automáticamente."
          onClick={onReportesAutomaticos}
        />
      </div>
    </div>
  );
}
