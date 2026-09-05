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
  // Sub-pantalla inicial (Sprint 3D-7.11J.2): los ítems fijos del sidebar
  // ("Usuarios"/"Roles"/"Parámetros") navegan pasando `configSubVista` en el
  // NavPayload — se lee acá una sola vez al montar para no depender de que
  // esta página ya estuviera montada (esa dependencia era la causa del bug
  // de la versión anterior: Usuarios/Roles solo aparecían tras haber
  // entrado antes a Configuración). Sin payload (ej. recarga directa en
  // Configuración) cae al landing "parametros" de siempre.
  const { navPayload, setBreadcrumbTrail, setConfigActiveItem } = useNavigationContext();
  const [subVista, setSubVista] = useState<SubVista>(
    () => navPayload?.configSubVista ?? "parametros"
  );

  // Si la página ya está montada y el usuario vuelve a hacer clic en otro
  // ítem fijo del sidebar (vista sigue siendo "configuracion", por lo que
  // este componente no se desmonta/remonta), el único cambio detectable es
  // un `navPayload` nuevo — este efecto sincroniza subVista con él.
  useEffect(() => {
    const destino = navPayload?.configSubVista;
    if (destino) setSubVista(destino);
  }, [navPayload]);

  // Reporte en edición completa (Fase 9I) — se pasa por navegación, no se
  // vuelve a pedir al backend: el listado ya lo tiene cargado.
  const [reporteEditar,  setReporteEditar]  = useState<ReporteAutomatico | null>(null);
  // Aviso no bloqueante (Fase 11D.1): "la hora de hoy ya pasó..." — el
  // wizard se desmonta al navegar de vuelta al listado, así que el mensaje
  // viaja por acá para que el listado lo muestre tras la navegación.
  const [avisoProgramacion, setAvisoProgramacion] = useState<string | null>(null);

  // Sidebar (Sprint 3D-7.11J.2): los 3 ítems fijos ("Usuarios"/"Roles"/
  // "Parámetros") ya están declarados de forma estática en AppShell — nunca
  // dependen de que esta página esté montada. Lo único que se reporta acá es
  // cuál de los 3 debe verse activo, para que quede sincronizado con
  // `subVista`. "Usuarios" queda activo también en "permisos-usuario"
  // (Gestión de permisos es su pantalla hija); "Parámetros" queda activo en
  // "reportes-automaticos"/"crear-reporte"/"editar-reporte" (hijas de
  // Parámetros).
  useEffect(() => {
    if (subVista === "usuarios" || subVista === "permisos-usuario") {
      setConfigActiveItem("usuarios");
    } else if (subVista === "roles-permisos") {
      setConfigActiveItem("roles-permisos");
    } else {
      setConfigActiveItem("parametros");
    }
    return () => setConfigActiveItem(null);
  }, [subVista, setConfigActiveItem]);

  // Breadcrumb superior de AppShell (Sprint 3D-7.11F, simplificado en
  // 3D-7.11J.2 al eliminar el nivel intermedio "Seguridad y acceso" — el
  // sidebar ya no lo usa como agrupador). "Roles" (nivel intermedio de
  // "Roles y permisos", que es la única pantalla real de esa sub-jerarquía)
  // se mantiene navegable como pide el ticket, llevando de vuelta a la
  // pantalla raíz "parametros", igual que "Configuración". La pantalla raíz
  // "parametros" no declara nada (null) y usa el breadcrumb genérico de
  // AppShell, que ya produce exactamente "INLOP › Configuración ›
  // Parámetros" sin necesidad de un tramo custom.
  useEffect(() => {
    const irAParametros = () => setSubVista("parametros");
    let trail: { label: string; onClick?: () => void }[] | null = null;

    if (subVista === "usuarios") {
      trail = [
        { label: "Configuración", onClick: irAParametros },
        { label: "Usuarios" },
      ];
    } else if (subVista === "permisos-usuario") {
      trail = [
        { label: "Configuración", onClick: irAParametros },
        { label: "Usuarios",      onClick: () => setSubVista("usuarios") },
        { label: "Gestión de permisos" },
      ];
    } else if (subVista === "roles-permisos") {
      trail = [
        { label: "Configuración", onClick: irAParametros },
        { label: "Roles",         onClick: irAParametros },
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
        onCrear={() => setSubVista("crear-reporte")}
        onEditarCompleto={(r) => { setReporteEditar(r); setSubVista("editar-reporte"); }}
        avisoInicial={avisoProgramacion}
        onAvisoConsumido={() => setAvisoProgramacion(null)}
      />
    );
  }

  if (subVista === "usuarios") {
    return <UsuariosPage onGestionPermisos={() => setSubVista("permisos-usuario")} />;
  }

  if (subVista === "roles-permisos") {
    return <RolesPermisosPage />;
  }

  if (subVista === "permisos-usuario") {
    return <GestionPermisosUsuarioPage />;
  }

  // Módulo raíz de esta vista: Parámetros — desde 3D-7.11J solo lista lo que
  // cuelga de "Parámetros" en la jerarquía aprobada (Reportes automáticos);
  // Usuarios y Roles se navegan directamente desde el sidebar, ya no desde
  // tarjetas aquí (evita navegación duplicada hacia el mismo destino).
  return <ParametrosPage onReportesAutomaticos={() => setSubVista("reportes-automaticos")} />;
}
