import { useEffect, useState } from "react";
import { ChevronRight, Mail, SlidersHorizontal, Users, ShieldCheck } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { obtenerMisPermisos } from "./services/api";

interface OpcionCard {
  icon:        React.ReactNode;
  titulo:      string;
  descripcion: string;
  onClick:     () => void;
}

function OpcionCard({ icon, titulo, descripcion, onClick }: OpcionCard) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-[var(--radius-2xl)]"
      style={{ focusRingColor: "var(--navy)" } as React.CSSProperties}
    >
      <Card
        className="hover:shadow-md transition-shadow"
        style={{ cursor: "pointer" }}
      >
        <div className="px-5 py-4 flex items-center gap-4">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--navy-dark)", color: "#fff" }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[14px] leading-snug" style={{ color: "var(--navy)" }}>
              {titulo}
            </div>
            <div className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--gray-400)" }}>
              {descripcion}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
        </div>
      </Card>
    </button>
  );
}

interface Props {
  onReportesAutomaticos: () => void;
  onUsuarios:             () => void;
  onRolesPermisos:        () => void;
}

export function ParametrosPage({ onReportesAutomaticos, onUsuarios, onRolesPermisos }: Props) {
  // ── Progressive disclosure (Sprint 3D-4) — NUNCA un mecanismo de seguridad.
  // Las tarjetas de Usuarios/Roles y Permisos se muestran por defecto (fail-
  // open): si /api/me/permisos falla o todavía no responde, se mantienen
  // visibles. Solo se ocultan cuando la consulta SÍ respondió y confirma que
  // el usuario no tiene rbac:gestionar ni es master. La autorización real
  // vive exclusivamente en el backend (requirePermiso('rbac:gestionar') en
  // GET /api/usuarios, /api/roles, /api/permisos — Sprint 3D-3); si alguien
  // llega igual a esas pantallas sin el permiso, el backend responde 403 y
  // la pantalla lo muestra como error (ver UsuariosPage/RolesPermisosPage).
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

  return (
    <div className="p-6 flex flex-col gap-6">
      <PageHeader
        title="Parámetros"
        subtitle="Configuraciones funcionales del ERP."
        icon={<SlidersHorizontal className="w-5 h-5" />}
      />

      {/* Sprint 3D-7.11J: las tarjetas se agrupan visualmente en "Seguridad y
          acceso" y "Parámetros" — son solo etiquetas de sección, no páginas
          ni rutas nuevas; ambos grupos siguen viviendo en esta misma pantalla
          (subVista "parametros" de ConfiguracionPage), sin cambios en las
          páginas de destino de cada tarjeta. */}
      <div className="flex flex-col gap-6 max-w-xl">
        {puedeGestionarRbac && (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest px-1" style={{ color: "var(--gray-400)" }}>
              Seguridad y acceso
            </div>
            <OpcionCard
              icon={<Users className="w-5 h-5" />}
              titulo="Usuarios"
              descripcion="Usuarios del ERP y sus roles RBAC actuales."
              onClick={onUsuarios}
            />
            <OpcionCard
              icon={<ShieldCheck className="w-5 h-5" />}
              titulo="Roles y Permisos"
              descripcion="Catálogo de roles, permisos y su relación."
              onClick={onRolesPermisos}
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-widest px-1" style={{ color: "var(--gray-400)" }}>
            Parámetros
          </div>
          <OpcionCard
            icon={<Mail className="w-5 h-5" />}
            titulo="Reportes Automáticos"
            descripcion="Configura reportes que el ERP genera y envía automáticamente."
            onClick={onReportesAutomaticos}
          />
        </div>
      </div>
    </div>
  );
}
