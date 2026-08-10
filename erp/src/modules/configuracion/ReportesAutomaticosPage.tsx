import { Mail } from "lucide-react";
import { PageHeader } from "@/components/ui";

interface Props {
  onBack: () => void;
}

export function ReportesAutomaticosPage({ onBack }: Props) {
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
          Parámetros
        </button>
        <span aria-hidden="true">›</span>
        <span style={{ color: "var(--gray-700)", fontWeight: 600 }}>Reportes Automáticos</span>
      </nav>

      <PageHeader
        title="Reportes Automáticos"
        subtitle="Configura reportes que el ERP genera y envía automáticamente."
        icon={<Mail className="w-5 h-5" />}
      />

      {/* Placeholder — contenido pendiente de implementación */}
      <div
        className="flex flex-col items-center justify-center py-24 rounded-[var(--radius-2xl)] gap-3"
        style={{ border: "1.5px dashed var(--gray-200)", background: "var(--gray-50)" }}
      >
        <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gray-100)" }}>
          <Mail className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
        </div>
        <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
          Próximamente disponible
        </p>
        <p className="text-[13px] text-center max-w-[340px]" style={{ color: "var(--gray-400)" }}>
          La configuración de reportes automáticos estará disponible en una próxima versión del ERP.
        </p>
      </div>
    </div>
  );
}
