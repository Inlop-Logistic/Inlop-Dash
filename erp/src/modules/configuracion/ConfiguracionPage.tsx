import { useState, useEffect } from "react";
import { useNavigationContext } from "@/core/navigation";
import { ParametrosPage } from "./ParametrosPage";
import { ReportesAutomaticosPage } from "./ReportesAutomaticosPage";
import { UsuariosPage } from "./UsuariosPage";
import { RolesPermisosPage } from "./RolesPermisosPage";
import { GestionPermisosUsuarioPage } from "./GestionPermisosUsuarioPage";
import { CrearReportePage } from "./components/CrearReportePage";
import { EditarReportePage } from "./components/EditarReportePage";
import type { ReporteAutomatico } from "./types";

type SubVista =
  | "parametros" | "reportes-automaticos" | "crear-reporte" | "editar-reporte"
  | "usuarios" | "roles-permisos" | "permisos-usuario";

export function ConfiguracionPage() {
  const [subVista,       setSubVista]       = useState<SubVista>("parametros");
  // Reporte en edición completa (Fase 9I) — se pasa por navegación, no se
  // vuelve a pedir al backend: el listado ya lo tiene cargado.
  const [reporteEditar,  setReporteEditar]  = useState<ReporteAutomatico | null>(null);
  // Aviso no bloqueante (Fase 11D.1): "la hora de hoy ya pasó..." — el
  // wizard se desmonta al navegar de vuelta al listado, así que el mensaje
  // viaja por acá para que el listado lo muestre tras la navegación.
  const [avisoProgramacion, setAvisoProgramacion] = useState<string | null>(null);

  // Breadcrumb superior de AppShell (Sprint 3D-7.11F, reorganizado en
  // 3D-7.11J para reflejar la separación "Seguridad y acceso" / "Parámetros"
  // — ver ParametrosPage.tsx). Ambos son solo etiquetas visuales de sección
  // en esa pantalla, NO subVistas ni rutas propias: por eso su onClick en el
  // breadcrumb navega de vuelta a "parametros" (la única pantalla donde
  // viven), igual que "Configuración". "Roles" (nivel intermedio de "Roles y
  // permisos") tampoco es una pantalla propia — incluirlo como intermedio
  // navegable respeta la jerarquía aprobada sin inventar una página nueva.
  // La pantalla raíz "parametros" no declara nada (null) y usa el breadcrumb
  // genérico de AppShell, que ya produce exactamente "INLOP › Configuración
  // › Parámetros" sin necesidad de un tramo custom.
  const { setBreadcrumbTrail } = useNavigationContext();
  useEffect(() => {
    const irAParametros = () => setSubVista("parametros");
    let trail: { label: string; onClick?: () => void }[] | null = null;

    if (subVista === "usuarios") {
      trail = [
        { label: "Configuración",      onClick: irAParametros },
        { label: "Seguridad y acceso", onClick: irAParametros },
        { label: "Usuarios" },
      ];
    } else if (subVista === "permisos-usuario") {
      trail = [
        { label: "Configuración",      onClick: irAParametros },
        { label: "Seguridad y acceso", onClick: irAParametros },
        { label: "Usuarios",           onClick: () => setSubVista("usuarios") },
        { label: "Gestión de permisos" },
      ];
    } else if (subVista === "roles-permisos") {
      trail = [
        { label: "Configuración",      onClick: irAParametros },
        { label: "Seguridad y acceso", onClick: irAParametros },
        { label: "Roles",              onClick: irAParametros },
        { label: "Roles y permisos" },
      ];
    } else if (subVista === "reportes-automaticos") {
      trail = [
        { label: "Configuración", onClick: irAParametros },
        { label: "Parámetros",    onClick: irAParametros },
        { label: "Reportes automáticos" },
      ];
    }

    setBreadcrumbTrail(trail);
    return () => setBreadcrumbTrail(null);
  }, [subVista, setBreadcrumbTrail]);

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
    return (
      <UsuariosPage
        onBack={() => setSubVista("parametros")}
        onGestionPermisos={() => setSubVista("permisos-usuario")}
      />
    );
  }

  if (subVista === "roles-permisos") {
    return <RolesPermisosPage onBack={() => setSubVista("parametros")} />;
  }

  if (subVista === "permisos-usuario") {
    return <GestionPermisosUsuarioPage />;
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
