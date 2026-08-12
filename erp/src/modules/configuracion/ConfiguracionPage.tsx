import { useState } from "react";
import { ParametrosPage } from "./ParametrosPage";
import { ReportesAutomaticosPage } from "./ReportesAutomaticosPage";
import { CrearReportePage } from "./components/CrearReportePage";
import { EditarReportePage } from "./components/EditarReportePage";
import type { ReporteAutomatico } from "./types";

type SubVista = "parametros" | "reportes-automaticos" | "crear-reporte" | "editar-reporte";

export function ConfiguracionPage() {
  const [subVista,       setSubVista]       = useState<SubVista>("parametros");
  // Reporte en edición completa (Fase 9I) — se pasa por navegación, no se
  // vuelve a pedir al backend: el listado ya lo tiene cargado.
  const [reporteEditar,  setReporteEditar]  = useState<ReporteAutomatico | null>(null);

  if (subVista === "crear-reporte") {
    return (
      <CrearReportePage
        onCreado={() => setSubVista("reportes-automaticos")}
        onCancelar={() => setSubVista("reportes-automaticos")}
      />
    );
  }

  if (subVista === "editar-reporte" && reporteEditar) {
    return (
      <EditarReportePage
        reporte={reporteEditar}
        onGuardado={() => { setReporteEditar(null); setSubVista("reportes-automaticos"); }}
        onCancelar={() => { setReporteEditar(null); setSubVista("reportes-automaticos"); }}
      />
    );
  }

  if (subVista === "reportes-automaticos") {
    return (
      <ReportesAutomaticosPage
        onBack={() => setSubVista("parametros")}
        onCrear={() => setSubVista("crear-reporte")}
        onEditarCompleto={(r) => { setReporteEditar(r); setSubVista("editar-reporte"); }}
      />
    );
  }

  // Módulo raíz de esta vista: Parámetros
  return (
    <ParametrosPage
      onReportesAutomaticos={() => setSubVista("reportes-automaticos")}
    />
  );
}
