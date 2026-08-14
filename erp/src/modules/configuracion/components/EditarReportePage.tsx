/**
 * EditarReportePage — "Editar configuración completa" (Fase 9I).
 *
 * Página espejo de CrearReportePage: mismo layout, mismo ConfiguradorReporte
 * (el wizard de 6 etapas nunca se duplica). La única diferencia es que aquí
 * se le pasan `reporteId` + `datosIniciales` para que precargue el reporte
 * existente y guarde los cambios sobre el mismo id en vez de crear uno nuevo.
 */
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ConfiguradorReporte } from "./ConfiguradorReporte";
import { datosConfiguradorDesdeReporte, type ReporteAutomatico } from "../types";

interface Props {
  reporte:    ReporteAutomatico;
  /**
   * Invocado tras guardar con éxito — el caller navega al listado.
   * `aviso` (Fase 11D.1): mensaje "la hora de hoy ya pasó..." cuando
   * aplica, para que el listado lo muestre tras la navegación.
   */
  onGuardado: (aviso?: string) => void;
  onCancelar: () => void;
}

export function EditarReportePage({ reporte, onGuardado, onCancelar }: Props) {
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
        <span style={{ color: "var(--gray-700)", fontWeight: 600 }}>Editar reporte</span>
      </nav>

      <PageHeader
        title={`Editar reporte — ${reporte.nombre}`}
        subtitle="Modifica cualquier etapa y guarda los cambios sobre este mismo reporte."
        icon={<Mail className="w-5 h-5" />}
      />

      <ConfiguradorReporte
        reporteId={reporte.id}
        datosIniciales={datosConfiguradorDesdeReporte(reporte)}
        onCreado={onGuardado}
        onCancelar={onCancelar}
      />

    </div>
  );
}
