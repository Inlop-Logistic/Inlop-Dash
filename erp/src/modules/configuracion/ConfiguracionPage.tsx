import { useState, useEffect } from "react";
import { Users, ShieldCheck, Settings } from "lucide-react";
import { useNavigationContext } from "@/core/navigation";
import { ParametrosPage } from "./ParametrosPage";
import { ReportesAutomaticosPage } from "./ReportesAutomaticosPage";
import { UsuariosPage } from "./UsuariosPage";
import { RolesPermisosPage } from "./RolesPermisosPage";
import { GestionPermisosUsuarioPage } from "./GestionPermisosUsuarioPage";
import { CrearReportePage } from "./components/CrearReportePage";
import { EditarReportePage } from "./components/EditarReportePage";
import { obtenerMisPermisos } from "./services/api";
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

  // Progressive disclosure (Sprint 3D-7.11J, movido aquí desde
  // ParametrosPage.tsx junto con las tarjetas de Usuarios/Roles y permisos,
  // que ahora se navegan desde el sidebar) — NUNCA un mecanismo de
  // seguridad, solo evita ofrecer en el sidebar "Usuarios"/"Roles" a quien de
  // todos modos recibiría 403 al abrirlos. Mismo criterio fail-open que
  // antes: si /api/me/permisos falla o no ha respondido, se mantienen
  // visibles; solo se ocultan cuando SÍ confirma que el usuario no tiene
  // rbac:gestionar ni es master. La autorización real sigue siendo
  // exclusivamente la del backend (requirePermiso('rbac:gestionar')).
  const [puedeGestionarRbac, setPuedeGestionarRbac] = useState(true);
  useEffect(() => {
    let activo = true;
    obtenerMisPermisos()
      .then((r) => {
        if (!activo) return;
        setPuedeGestionarRbac(r.esMaster || r.permisos.includes("rbac:gestionar"));
      })
      .catch(() => { /* fail-open: se mantiene visible, ver comentario arriba */ });
    return () => { activo = false; };
  }, []);

  // Sidebar (Sprint 3D-7.11J) — reemplaza el ítem plano "Parámetros" de la
  // sección "CONFIGURACIÓN" por dos subgrupos: "Seguridad y acceso"
  // (Usuarios, Roles) y "Parámetros" (Parámetros). Son solo etiquetas
  // visuales — ningún subVista ni ruta nueva, los onClick reutilizan
  // exactamente los mismos setSubVista ya existentes. "Usuarios" queda
  // activo también en "permisos-usuario" (Gestión de permisos es su
  // pantalla hija); "Parámetros" queda activo en "reportes-automaticos"/
  // "crear-reporte"/"editar-reporte" (todas hijas de Parámetros).
  const { setBreadcrumbTrail, setSidebarGroups } = useNavigationContext();
  useEffect(() => {
    setSidebarGroups([
      {
        label: "Seguridad y acceso",
        items: puedeGestionarRbac ? [
          {
            id: "usuarios", label: "Usuarios", icon: <Users className="w-4 h-4" />,
            active: subVista === "usuarios" || subVista === "permisos-usuario",
            onClick: () => setSubVista("usuarios"),
          },
          {
            id: "roles-permisos", label: "Roles", icon: <ShieldCheck className="w-4 h-4" />,
            active: subVista === "roles-permisos",
            onClick: () => setSubVista("roles-permisos"),
          },
        ] : [],
      },
      {
        label: "Parámetros",
        items: [
          {
            id: "parametros", label: "Parámetros", icon: <Settings className="w-4 h-4" />,
            active: subVista === "parametros" || subVista === "reportes-automaticos"
              || subVista === "crear-reporte" || subVista === "editar-reporte",
            onClick: () => setSubVista("parametros"),
          },
        ],
      },
    ]);
    return () => setSidebarGroups(null);
  }, [subVista, puedeGestionarRbac, setSidebarGroups]);

  // Breadcrumb superior de AppShell (Sprint 3D-7.11F, reorganizado en
  // 3D-7.11J para reflejar la separación "Seguridad y acceso" / "Parámetros"
  // del sidebar de arriba). "Seguridad y acceso" y "Roles" (nivel intermedio
  // de "Roles y permisos") no son pantallas propias — se mantienen
  // navegables como pide el ticket llevando de vuelta a la pantalla raíz
  // "parametros", igual que "Configuración". La pantalla raíz "parametros"
  // no declara nada (null) y usa el breadcrumb genérico de AppShell, que ya
  // produce exactamente "INLOP › Configuración › Parámetros" sin necesidad
  // de un tramo custom.
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
