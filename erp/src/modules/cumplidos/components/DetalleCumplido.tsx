import { Car, User, MapPin, FileText, Activity } from "lucide-react";
import { SidePanel, PanelSection, InfoRow } from "@/components/ui";
import { fmtTms } from "@/utils/parseFecha";
import type { CumplidoRecord } from "../types";
import { EstadoDocumental } from "./EstadoDocumental";
import { DocumentChecklist } from "./DocumentChecklist";
import { TimelineCumplido } from "./TimelineCumplido";
import { AccionesCumplido } from "./AccionesCumplido";

interface DetalleCumplidoProps {
  cumplido: CumplidoRecord;
  onClose:  () => void;
}

export function DetalleCumplido({ cumplido, onClose }: DetalleCumplidoProps) {
  const clienteNombre = cumplido.company_customer_name?.split(",")[0].trim() ?? "—";

  return (
    <SidePanel
      open
      onClose={onClose}
      title={cumplido.trip_number}
      subtitle={clienteNombre !== "—" ? clienteNombre : undefined}
      headerRight={<EstadoDocumental estado={cumplido.estado_documental} />}
      width="480px"
    >
      {/* Información general */}
      <PanelSection title="Información general" icon={<FileText className="w-3.5 h-3.5" />} first>
        <InfoRow label="Trip number"  value={cumplido.trip_number} mono />
        <InfoRow label="Remisión"     value={cumplido.number_order ?? "—"} mono />
        <InfoRow label="Cliente"      value={cumplido.company_customer_name ?? "—"} />
        <InfoRow label="Fecha viaje"  value={fmtTms(cumplido.activated_on, "DMY", {
          weekday: "short", day: "2-digit", month: "short", year: "numeric",
        })} />
        <InfoRow label="Fecha cumplido" value={fmtTms(cumplido.fecha_cumplido, "DMY")} />
        {cumplido.responsable && (
          <InfoRow label="Responsable" value={cumplido.responsable} />
        )}
      </PanelSection>

      {/* Vehículo y conductor */}
      <PanelSection title="Vehículo y conductor" icon={<User className="w-3.5 h-3.5" />}>
        {cumplido.driver_name ? (
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-3"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {cumplido.driver_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold" style={{ color: "var(--gray-800)" }}>
                {cumplido.driver_name}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl mb-3"
            style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            Sin conductor asignado
          </div>
        )}
        {cumplido.license_plate ? (
          <div
            className="p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
              <span className="text-[18px] font-bold tracking-widest" style={{ color: "var(--navy)", fontFamily: "monospace" }}>
                {cumplido.license_plate}
              </span>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
          >
            <Car className="w-3.5 h-3.5 shrink-0" />
            Sin vehículo asignado
          </div>
        )}
      </PanelSection>

      {/* Ruta */}
      <PanelSection title="Ruta" icon={<MapPin className="w-3.5 h-3.5" />}>
        <div
          className="flex items-center gap-2 px-3 py-3 rounded-xl"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
        >
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--navy)" }} />
            <div className="w-0.5 h-5" style={{ background: "var(--gray-200)" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--inlop-red)" }} />
          </div>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Origen</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{cumplido.origin_city_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{cumplido.destiny_city_name ?? "—"}</div>
            </div>
          </div>
        </div>
      </PanelSection>

      {/* Estado documental */}
      <PanelSection title="Estado documental" icon={<Activity className="w-3.5 h-3.5" />}>
        <div className="flex items-center gap-3 mb-3">
          <EstadoDocumental estado={cumplido.estado_documental} />
        </div>
        {cumplido.observaciones && (
          <div
            className="text-[12px] px-3 py-2.5 rounded-xl"
            style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", lineHeight: 1.5 }}
          >
            {cumplido.observaciones}
          </div>
        )}
      </PanelSection>

      {/* Checklist documental */}
      <DocumentChecklist documentos={cumplido.documentos} />

      {/* Timeline documental */}
      <TimelineCumplido cumplido={cumplido} />

      {/* Acciones contextuales */}
      <AccionesCumplido cumplido={cumplido} />
    </SidePanel>
  );
}
