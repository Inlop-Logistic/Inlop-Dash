import { Mail } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ConfiguradorReporte } from "./ConfiguradorReporte";

interface Props {
  /**
   * Invocado tras persistir con éxito — el caller navega al listado.
   * `aviso` (Fase 11D.1): mensaje "la hora de hoy ya pasó..." cuando
   * aplica, para que el listado lo muestre tras la navegación.
   */
  onCreado:   (aviso?: string) => void;
  onCancelar: () => void;
}

export function CrearReportePage({ onCreado, onCancelar }: Props) {
  return (
    <div className="p-6 flex flex-col gap-6 h-full min-h-0">

      {/* Migas de pan interna */}
      <nav
        aria-label="Ruta interna"
        className="flex items-center gap-1.5 text-[13px]"
        style={{ color: "var(--gray-400)" }}
      >
        <button
          type="button"
          onClick={onCancelar}
          className="hover:underline focus-visible:outline-none"
          style={{ color: "var(--gray-500)" }}
        >
          Reportes Automáticos
        </button>
        <span aria-hidden="true">›</span>
        <span style={{ color: "var(--gray-700)", fontWeight: 600 }}>Crear reporte</span>
      </nav>

      <PageHeader
        title="Crear reporte"
        subtitle="Configura el reporte automático paso a paso."
        icon={<Mail className="w-5 h-5" />}
      />

      <ConfiguradorReporte onCreado={onCreado} onCancelar={onCancelar} />

    </div>
  );
}
