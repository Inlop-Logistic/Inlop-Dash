import { useState } from "react";
import { ParametrosPage } from "./ParametrosPage";
import { ReportesAutomaticosPage } from "./ReportesAutomaticosPage";
import { UsuariosPage } from "./UsuariosPage";
import { RolesPermisosPage } from "./RolesPermisosPage";
import { CrearReportePage } from "./components/CrearReportePage";
import { EditarReportePage } from "./components/EditarReportePage";
import type { ReporteAutomatico } from "./types";

type SubVista =
  | "parametros" | "reportes-automaticos" | "crear-reporte" | "editar-reporte"
  | "usuarios" | "roles-permisos";

export function ConfiguracionPage() {
  const [subVista,       setSubVista]       = useState<SubVista>("parametros");
  // Reporte en edición completa (Fase 9I) — se pasa por navegación, no se
  // vuelve a pedir al backend: el listado ya lo tiene cargado.
  const [reporteEditar,  setReporteEditar]  = useState<ReporteAutomatico | null>(null);
  // Aviso no bloqueante (Fase 11D.1): "la hora de hoy ya pasó..." — el
  // wizard se desmonta al navegar de vuelta al listado, así que el mensaje
  // viaja por acá para que el listado lo muestre tras la navegación.
  const [avisoProgramacion, setAvisoProgramacion] = useState<string | null>(null);

  if (subVista === "crear-reporte") {
    return (
      <CrearReportePage
        onCreado={(aviso) => { setAvisoProgramacion(aviso ?? null); setSubVista("reportes-automaticos"); }}
        onCancelar={() => setSubVista("reportes-automaticos")}
      />
    );
  }

  if (subVista === "editar-reporte" && reporteEditar) {
    return (
      <EditarReportePage
        reporte={reporteEditar}
        onGuardado={(aviso) => { setReporteEditar(null); setAvisoProgramacion(aviso ?? null); setSubVista("reportes-automaticos"); }}
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
        avisoInicial={avisoProgramacion}
        onAvisoConsumido={() => setAvisoProgramacion(null)}
      />
    );
  }

  if (subVista === "usuarios") {
    return <UsuariosPage onBack={() => setSubVista("parametros")} />;
  }

  if (subVista === "roles-permisos") {
    return <RolesPermisosPage onBack={() => setSubVista("parametros")} />;
  }

  // Módulo raíz de esta vista: Parámetros
  return (
    <ParametrosPage
      onReportesAutomaticos={() => setSubVista("reportes-automaticos")}
      onUsuarios={() => setSubVista("usuarios")}
      onRolesPermisos={() => setSubVista("roles-permisos")}
    />
  );
}
