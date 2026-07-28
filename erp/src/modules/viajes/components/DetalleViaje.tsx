import { Car, User, MapPin, FileText, Activity, Phone } from "lucide-react";
import { SidePanel, PanelSection, InfoRow } from "@/components/ui";
import { fmtTms } from "@/utils/parseFecha";
import { gpsRelativo } from "@/utils/parseFecha";
import type { TmsViaje } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { ProgressBar } from "./ProgressBar";
import { TimelineViaje } from "./TimelineViaje";
import { AlarmasPanel } from "./AlarmasPanel";
import { SeguimientoPanel } from "./SeguimientoPanel";
import { DocumentosPanel } from "./DocumentosPanel";
import { AccionesPanel } from "./AccionesPanel";

interface DetalleViajeProps {
  viaje:   TmsViaje;
  onClose: () => void;
}

function formatTelUri(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function formatWaUri(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("57") ? digits : `57${digits}`;
  return `https://wa.me/${number}`;
}

export function DetalleViaje({ viaje, onClose }: DetalleViajeProps) {
  const clienteNombre = viaje.razon_social ?? viaje.company_customer_name?.split(",")[0].trim() ?? "—";
  const gps = gpsRelativo(viaje.latest_gps_report);

  return (
    <SidePanel
      open
      onClose={onClose}
      title={viaje.trip_number}
      subtitle={clienteNombre !== "—" ? clienteNombre : undefined}
      headerRight={<EstadoBadge estado={viaje.state_travel} />}
      width="480px"
    >
      {/* Franja de progreso + GPS — inmediatamente bajo el header */}
      <div
        className="px-4 py-3 flex items-center gap-4 border-b"
        style={{ borderColor: "var(--gray-100)", background: "var(--gray-50)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--gray-400)" }}>
            Avance del viaje
          </div>
          <ProgressBar value={viaje.percentage_travel} maxWidth="100%" />
        </div>
        {viaje.current_address_location && (
          <div className="shrink-0 max-w-[160px] min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--gray-400)" }}>
              Última posición
            </div>
            <p
              className="text-[11px] truncate"
              style={{ color: gps.level === "ok" ? "#059669" : gps.level === "warn" ? "#D97706" : "var(--gray-500)" }}
              title={viaje.current_address_location}
            >
              {viaje.current_address_location}
            </p>
          </div>
        )}
      </div>

      {/* Estado y avance — primera sección */}
      <PanelSection title="Estado y avance" icon={<Activity className="w-3.5 h-3.5" />} first>
        <div className="flex items-center gap-3 mb-3">
          <EstadoBadge estado={viaje.state_travel} />
        </div>
        {viaje.last_event && (() => {
          const m = viaje.last_event!.match(
            /fecha aproximada.*?es\s+(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})/i,
          );
          const eta = m ? m[1].trim() : null;
          return eta ? (
            <div style={{ marginBottom: 12, padding: "6px 4px 4px" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Llegada aproximada al destino
              </div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--navy)", fontVariantNumeric: "tabular-nums" }}>
                {eta}
              </div>
            </div>
          ) : (
            <div
              className="mb-3 text-[12px] px-3 py-2.5 rounded-xl"
              style={{ background: "var(--gray-50)", color: "var(--gray-600)", border: "1px solid var(--gray-100)", lineHeight: 1.5 }}
            >
              {viaje.last_event}
            </div>
          );
        })()}
      </PanelSection>

      {/* Información general */}
      <PanelSection title="Información general" icon={<FileText className="w-3.5 h-3.5" />}>
        <InfoRow label="Manifiesto" value={viaje.trip_number} mono />
        <InfoRow label="Operación"  value={viaje.type_operation ?? "—"} />
        <InfoRow label="Cliente"    value={clienteNombre} />
        <InfoRow label="Activado"   value={fmtTms(viaje.activated_on, "MDY", {
          weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        })} />
      </PanelSection>

      {/* Vehículo y conductor */}
      <PanelSection title="Vehículo y conductor" icon={<User className="w-3.5 h-3.5" />}>
        {viaje.driver_name ? (
          <div
            className="flex items-start gap-3 p-3 rounded-xl mb-3"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {viaje.driver_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold" style={{ color: "var(--gray-800)" }}>
                {viaje.driver_name}
              </div>
              {viaje.driver_phone && (
                <div className="text-[12px] mt-0.5 font-mono" style={{ color: "var(--gray-500)" }}>
                  {viaje.driver_phone}
                </div>
              )}
              {viaje.driver_phone && (
                <div className="flex items-center gap-2 mt-2">
                  <a
                    href={formatTelUri(viaje.driver_phone)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "var(--navy)", color: "#fff", textDecoration: "none" }}
                  >
                    <Phone className="w-3 h-3" />
                    Llamar
                  </a>
                  <a
                    href={formatWaUri(viaje.driver_phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "#25D366", color: "#fff", textDecoration: "none" }}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                </div>
              )}
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
        {viaje.license_plate ? (
          <div
            className="p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
              <span className="text-[18px] font-bold tracking-widest" style={{ color: "var(--navy)", fontFamily: "monospace" }}>
                {viaje.license_plate}
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
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{viaje.origin_city_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{viaje.destiny_city_name ?? "—"}</div>
            </div>
          </div>
        </div>
        {viaje.stops && <InfoRow label="Paradas" value={viaje.stops} />}
      </PanelSection>

      {/* Timeline cronológico */}
      <TimelineViaje viaje={viaje} />

      {/* Alarmas */}
      <AlarmasPanel viaje={viaje} />

      {/* Seguimiento GPS — última posición */}
      <SeguimientoPanel viaje={viaje} />

      {/* Acciones contextuales */}
      <AccionesPanel viaje={viaje} />

      {/* Documentos asociados */}
      <DocumentosPanel viaje={viaje} />
    </SidePanel>
  );
}
