import { useState } from "react";
import { ParametrosPage } from "./ParametrosPage";
import { ReportesAutomaticosPage } from "./ReportesAutomaticosPage";
import { CrearReportePage } from "./components/CrearReportePage";

type SubVista = "parametros" | "reportes-automaticos" | "crear-reporte";

export function ConfiguracionPage() {
  const [subVista, setSubVista] = useState<SubVista>("parametros");

  if (subVista === "crear-reporte") {
    return (
      <CrearReportePage
        onCreado={() => setSubVista("reportes-automaticos")}
        onCancelar={() => setSubVista("reportes-automaticos")}
      />
    );
  }

  if (subVista === "reportes-automaticos") {
    return (
      <ReportesAutomaticosPage
        onBack={() => setSubVista("parametros")}
        onCrear={() => setSubVista("crear-reporte")}
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
