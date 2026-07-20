import { ExternalLink, MapPin, User, Briefcase, Tag } from "lucide-react";
import { SidePanel, PanelSection, InfoRow, Button, Badge } from "@/components/ui";
import type { ClienteListItem } from "../types";
import {
  ESTADO_CLIENTE_CFG,
  CLASIFICACION_ABC_CFG,
  NIVEL_ESTRATEGICO_CFG,
  ETIQUETA_CFG,
} from "../constants";

interface ClienteQuickViewProps {
  cliente: ClienteListItem;
  onClose: () => void;
  onOpenWorkspace: () => void;
}

function ClienteAvatar({ razon_social }: { razon_social: string }) {
  const words = razon_social.trim().split(/\s+/).filter(Boolean);
  const initials = words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : (words[0][0] + words[words.length - 1][0]).toUpperCase();

  return (
    <div
      className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center font-bold"
      style={{
        background: "var(--navy)",
        color: "#fff",
        fontSize: "var(--text-md)",
      }}
    >
      {initials}
    </div>
  );
}

export function ClienteQuickView({ cliente, onClose, onOpenWorkspace }: ClienteQuickViewProps) {
  const estadoCfg = ESTADO_CLIENTE_CFG[cliente.estado];

  return (
    <SidePanel
      open
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <ClienteAvatar razon_social={cliente.razon_social} />
          <div className="min-w-0">
            <div className="font-bold leading-tight truncate" style={{ fontSize: "var(--text-md)", color: "var(--navy)" }}>
              {cliente.razon_social}
            </div>
            {cliente.nombre_comercial && cliente.nombre_comercial !== cliente.razon_social && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)" }}>
                {cliente.nombre_comercial}
              </div>
            )}
          </div>
        </div>
      }
      subtitle={cliente.nit ? `NIT: ${cliente.nit}` : undefined}
      headerRight={<Badge variant={estadoCfg.variant}>{estadoCfg.label}</Badge>}
      footer={
        <div className="flex items-center gap-2 px-6 py-4">
          <Button
            variant="primary"
            size="sm"
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={onOpenWorkspace}
          >
            Abrir Workspace
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      {/* Etiquetas */}
      {cliente.etiquetas.length > 0 && (
        <PanelSection title="Etiquetas" icon={<Tag className="w-3.5 h-3.5" />} first>
          <div className="flex flex-wrap gap-1.5">
            {cliente.etiquetas.map(e => {
              const cfg = ETIQUETA_CFG[e];
              return (
                <span
                  key={e}
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: "10px",
                    background: cfg.bg,
                    color: cfg.color,
                  }}
                >
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </PanelSection>
      )}

      {/* Identificación */}
      <PanelSection title="Identificación" first={cliente.etiquetas.length === 0}>
        <InfoRow label="Razón Social" value={cliente.razon_social} />
        {cliente.nombre_comercial && cliente.nombre_comercial !== cliente.razon_social && (
          <InfoRow label="Nombre Comercial" value={cliente.nombre_comercial} />
        )}
        <InfoRow label="NIT" value={cliente.nit} mono />
        <InfoRow label="Estado" value={<Badge variant={estadoCfg.variant}>{estadoCfg.label}</Badge>} />
      </PanelSection>

      {/* Ubicación */}
      <PanelSection title="Ubicación" icon={<MapPin className="w-3.5 h-3.5" />}>
        <InfoRow label="Ciudad" value={cliente.ciudad_principal} />
        <InfoRow label="Sector" value={cliente.sector_economico} />
      </PanelSection>

      {/* Relación Comercial */}
      <PanelSection title="Relación Comercial" icon={<Briefcase className="w-3.5 h-3.5" />}>
        <InfoRow label="Ejecutivo" value={cliente.ejecutivo_comercial} />
        <InfoRow
          label="Clasificación"
          value={
            cliente.clasificacion_abc ? (
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "11px",
                  padding: "2px 10px",
                  borderRadius: "10px",
                  background: CLASIFICACION_ABC_CFG[cliente.clasificacion_abc].bg,
                  color: CLASIFICACION_ABC_CFG[cliente.clasificacion_abc].color,
                }}
              >
                {cliente.clasificacion_abc}
              </span>
            ) : null
          }
        />
        <InfoRow
          label="Nivel Estratégico"
          value={
            cliente.nivel_estrategico
              ? NIVEL_ESTRATEGICO_CFG[cliente.nivel_estrategico].label
              : null
          }
        />
      </PanelSection>

      {/* Alertas */}
      {cliente.alertas_count > 0 && (
        <PanelSection title="Alertas" icon={<User className="w-3.5 h-3.5" />}>
          <div
            className="flex items-center gap-2 text-[13px] font-medium"
            style={{ color: "#92400E" }}
          >
            <span>⚠</span>
            <span>
              {cliente.alertas_count} alerta{cliente.alertas_count !== 1 ? "s" : ""} activa{cliente.alertas_count !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-[12px] mt-1" style={{ color: "var(--gray-400)" }}>
            Abre el Workspace para ver el detalle.
          </p>
        </PanelSection>
      )}
    </SidePanel>
  );
}
