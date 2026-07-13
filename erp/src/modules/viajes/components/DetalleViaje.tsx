import { Car, User, MapPin, FileText, Activity, Wifi, CalendarClock, ChevronRight, Map, ClipboardList, CheckSquare } from "lucide-react";
import { SidePanel, PanelSection, InfoRow } from "@/components/ui";
import { useNavigationContext, navActions } from "@/core/navigation";
import type { TmsViaje } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { ProgressBar } from "./ProgressBar";
import { GpsStatus } from "./GpsStatus";
import { parseFechaDMY } from "@/utils/parseFecha";

const LOCALE = "es-CO";

function fmtFechaLarga(str: string | null | undefined): string {
  if (!str) return "—";
  const d = parseFechaDMY(str);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface NavLinkProps {
  icon:      React.ReactNode;
  label:     string;
  onClick?:  () => void;
  disabled?: boolean;
  badge?:    string;
}

function NavLink({ icon, label, onClick, disabled, badge }: NavLinkProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
      style={{
        background:    disabled ? "var(--gray-50)" : "#fff",
        color:         disabled ? "var(--gray-300)" : "var(--gray-700)",
        border:        `1.5px solid ${disabled ? "var(--gray-100)" : "var(--gray-200)"}`,
        cursor:        disabled ? "not-allowed" : "pointer",
      }}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {disabled && badge ? (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--gray-100)", color: "var(--gray-300)" }}>
          {badge}
        </span>
      ) : (
        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: disabled ? "var(--gray-200)" : "var(--gray-400)" }} />
      )}
    </button>
  );
}

interface DetalleViajeProps {
  viaje:   TmsViaje;
  onClose: () => void;
}

export function DetalleViaje({ viaje, onClose }: DetalleViajeProps) {
  const { navigateTo } = useNavigationContext();

  const clienteNombre = viaje.company_customer_name?.split(",")[0].trim() ?? "—";

  return (
    <SidePanel
      open
      onClose={onClose}
      title={viaje.trip_number}
      subtitle={clienteNombre !== "—" ? clienteNombre : undefined}
      headerRight={<EstadoBadge estado={viaje.state_travel} />}
      width="480px"
    >
      {/* Información general */}
      <PanelSection title="Información general" icon={<FileText className="w-3.5 h-3.5" />} first>
        <InfoRow label="Trip number"  value={viaje.trip_number} mono />
        <InfoRow label="Remisión"     value={viaje.number_order ?? "—"} mono />
        <InfoRow label="Operación"    value={viaje.type_operation ?? "—"} />
        <InfoRow label="Activado"     value={fmtFechaLarga(viaje.activated_on)} />
      </PanelSection>

      {/* Cliente */}
      <PanelSection title="Cliente" icon={<FileText className="w-3.5 h-3.5" />}>
        <InfoRow label="Empresa" value={viaje.company_customer_name ?? "—"} />
      </PanelSection>

      {/* Vehículo y conductor */}
      <PanelSection title="Vehículo y conductor" icon={<User className="w-3.5 h-3.5" />}>
        {viaje.driver_name ? (
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-3"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {viaje.driver_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold" style={{ color: "var(--gray-800)" }}>
                {viaje.driver_name}
              </div>
              {viaje.driver_phone && (
                <div className="text-[12px] mt-0.5 font-mono" style={{ color: "var(--gray-500)" }}>
                  {viaje.driver_phone}
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
        {viaje.license_plate && (
          <div
            className="p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
              <div
                className="text-[18px] font-bold tracking-widest"
                style={{ color: "var(--navy)", fontFamily: "monospace" }}
              >
                {viaje.license_plate}
              </div>
            </div>
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
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>
                {viaje.origin_city_name ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>
                {viaje.destiny_city_name ?? "—"}
              </div>
            </div>
          </div>
        </div>
        {viaje.stops && (
          <InfoRow label="Paradas" value={viaje.stops} />
        )}
        {viaje.current_address_location && (
          <InfoRow label="Última ubicación" value={viaje.current_address_location} />
        )}
      </PanelSection>

      {/* Estado y avance */}
      <PanelSection title="Estado y avance" icon={<Activity className="w-3.5 h-3.5" />}>
        <div className="flex items-center gap-3 mb-3">
          <EstadoBadge estado={viaje.state_travel} />
        </div>
        <div className="px-1">
          <ProgressBar value={viaje.percentage_travel} maxWidth="100%" />
        </div>
        {viaje.appointment_fulfillment && (
          <InfoRow label="Cumplimiento cita" value={viaje.appointment_fulfillment} />
        )}
      </PanelSection>

      {/* GPS */}
      <PanelSection title="GPS" icon={<Wifi className="w-3.5 h-3.5" />}>
        <div className="mb-2">
          <GpsStatus report={viaje.latest_gps_report} />
        </div>
        <InfoRow label="Último reporte" value={fmtFechaLarga(viaje.latest_gps_report)} />
      </PanelSection>

      {/* Último evento */}
      {viaje.last_event && (
        <PanelSection title="Último evento" icon={<FileText className="w-3.5 h-3.5" />}>
          <div
            className="text-[13px] px-3 py-3 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-700)", border: "1px solid var(--gray-100)", lineHeight: 1.5 }}
          >
            {viaje.last_event}
          </div>
          {viaje.last_alarm_name && (
            <div
              className="mt-2 text-[12px] px-3 py-2.5 rounded-xl font-medium"
              style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}
            >
              Novedad: {viaje.last_alarm_name}
            </div>
          )}
        </PanelSection>
      )}

      {/* Módulos relacionados — navegación contextual */}
      <PanelSection title="Módulos relacionados" icon={<ChevronRight className="w-3.5 h-3.5" />}>
        <div className="flex flex-col gap-2">
          <NavLink
            icon={<CalendarClock className="w-3.5 h-3.5" />}
            label="Ver en Programación"
            onClick={() => navigateTo(navActions.verProgramacion(viaje.trip_number, "viajes"))}
          />
          <NavLink
            icon={<ClipboardList className="w-3.5 h-3.5" />}
            label="Ver Solicitud"
            disabled
            badge="Próximamente"
          />
          <NavLink
            icon={<Map className="w-3.5 h-3.5" />}
            label="Ver GPS"
            disabled
            badge="Próximamente"
          />
          <NavLink
            icon={<CheckSquare className="w-3.5 h-3.5" />}
            label="Ver Cumplidos"
            disabled
            badge="Próximamente"
          />
        </div>
      </PanelSection>
    </SidePanel>
  );
}
