import { useState } from "react";
import { ParametrosPage } from "./ParametrosPage";
import { ReportesAutomaticosPage } from "./ReportesAutomaticosPage";

type SubVista = "parametros" | "reportes-automaticos";

export function ConfiguracionPage() {
  const [subVista, setSubVista] = useState<SubVista>("parametros");

  if (subVista === "reportes-automaticos") {
    return (
      <ReportesAutomaticosPage
        onBack={() => setSubVista("parametros")}
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
