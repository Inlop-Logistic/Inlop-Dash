import { useState } from "react";
import { Mail } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { FormReporteAutomatico } from "./FormReporteAutomatico";
import { crearReporteAutomatico } from "../services/api";
import type { ReporteBase } from "../types";

interface Props {
  /** Invocado tras persistir con éxito — el caller navega de vuelta al listado. */
  onCreado:   () => void;
  onCancelar: () => void;
}

export function CrearReportePage({ onCreado, onCancelar }: Props) {
  const [guardando, setGuardando] = useState(false);

  const handleCrear = async (datos: ReporteBase) => {
    setGuardando(true);
    try {
      await crearReporteAutomatico(datos);
      onCreado();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6">

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
        subtitle="Define la información básica del reporte automático."
        icon={<Mail className="w-5 h-5" />}
      />

      <div className="max-w-lg">
        <Card padding="md">
          <FormReporteAutomatico
            guardando={guardando}
            labelAccion="Crear reporte"
            onGuardar={handleCrear}
            onCancelar={onCancelar}
          />
        </Card>
      </div>

    </div>
  );
}
