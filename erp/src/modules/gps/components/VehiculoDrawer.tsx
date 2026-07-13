import { Car, User, MapPin, Activity, Truck, CalendarClock, ClipboardList, CheckSquare, ChevronRight } from "lucide-react";
import { SidePanel, PanelSection, InfoRow } from "@/components/ui";
import { useNavigationContext, navActions } from "@/core/navigation";
import { fmtTms } from "@/utils/parseFecha";
import { EstadoGpsBadge } from "./EstadoGpsBadge";
import { GpsStatusCard } from "./GpsStatusCard";
import type { GpsRecord } from "../types";

interface AccionProps {
  icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; badge?: string;
}
function Accion({ icon, label, onClick, disabled, badge }: AccionProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
      style={{
        background: disabled ? "var(--gray-50)" : "#fff",
        color:      disabled ? "var(--gray-300)" : "var(--gray-700)",
        border:     `1.5px solid ${disabled ? "var(--gray-100)" : "var(--gray-200)"}`,
        cursor:     disabled ? "not-allowed" : "pointer",
      }}
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      {disabled && badge
        ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--gray-100)", color: "var(--gray-300)" }}>{badge}</span>
        : !disabled ? <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} /> : null
      }
    </button>
  );
}

interface VehiculoDrawerProps {
  vehiculo: GpsRecord;
  onClose:  () => void;
}

export function VehiculoDrawer({ vehiculo, onClose }: VehiculoDrawerProps) {
  const { navigateTo } = useNavigationContext();
  const trip    = vehiculo.trip_number;
  const cliente = vehiculo.company_customer_name?.split(",")[0].trim() ?? undefined;

  return (
    <SidePanel
      open
      onClose={onClose}
      title={vehiculo.license_plate ?? "Sin placa"}
      subtitle={cliente}
      headerRight={<EstadoGpsBadge estado={vehiculo.estadoGps} />}
      width="440px"
    >
      {/* Información general */}
      <PanelSection title="Información general" icon={<Car className="w-3.5 h-3.5" />} first>
        <InfoRow label="Placa"    value={vehiculo.license_plate ?? "—"} mono />
        <InfoRow label="Viaje"    value={vehiculo.trip_number}          mono />
        <InfoRow label="Remisión" value={vehiculo.number_order ?? "—"}  mono />
        <InfoRow label="Estado"   value={vehiculo.state_travel}         />
        <InfoRow label="Cliente"  value={vehiculo.company_customer_name ?? "—"} />
      </PanelSection>

      {/* Conductor */}
      <PanelSection title="Conductor" icon={<User className="w-3.5 h-3.5" />}>
        {vehiculo.driver_name ? (
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {vehiculo.driver_name.charAt(0).toUpperCase()}
            </div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--gray-800)" }}>
              {vehiculo.driver_name}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl" style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}>
            <User className="w-3.5 h-3.5 shrink-0" />
            Sin conductor asignado
          </div>
        )}
      </PanelSection>

      {/* Ruta */}
      <PanelSection title="Ruta" icon={<MapPin className="w-3.5 h-3.5" />}>
        <div className="flex items-center gap-2 px-3 py-3 rounded-xl" style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--navy)" }} />
            <div className="w-0.5 h-5" style={{ background: "var(--gray-200)" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--inlop-red)" }} />
          </div>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Origen</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{vehiculo.origin_city_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{vehiculo.destiny_city_name ?? "—"}</div>
            </div>
          </div>
        </div>
      </PanelSection>

      {/* Estado GPS */}
      <PanelSection title="Estado GPS" icon={<Activity className="w-3.5 h-3.5" />}>
        <div className="flex items-center gap-3 mb-3">
          <EstadoGpsBadge estado={vehiculo.estadoGps} />
          {vehiculo.latest_gps_report && (
            <span className="text-[11px] font-mono" style={{ color: "var(--gray-400)" }}>
              {fmtTms(vehiculo.latest_gps_report, "MDY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <GpsStatusCard vehiculo={vehiculo} />
      </PanelSection>

      {/* Acciones */}
      <PanelSection title="Acciones" icon={<ChevronRight className="w-3.5 h-3.5" />}>
        <div className="flex flex-col gap-2">
          <Accion
            icon={<Truck className="w-3.5 h-3.5" />}
            label="Abrir Viaje"
            onClick={() => navigateTo(navActions.verViaje(trip, "mapa"))}
          />
          <Accion
            icon={<CalendarClock className="w-3.5 h-3.5" />}
            label="Abrir Programación"
            onClick={() => navigateTo(navActions.verProgramacion(trip, "mapa"))}
          />
          <Accion
            icon={<ClipboardList className="w-3.5 h-3.5" />}
            label="Abrir Solicitud"
            onClick={() => navigateTo(navActions.verSolicitud(trip, "mapa"))}
          />
          <Accion
            icon={<CheckSquare className="w-3.5 h-3.5" />}
            label="Abrir Cumplido"
            onClick={() => navigateTo(navActions.verCumplidos(trip, "mapa"))}
          />
          <Accion icon={<Car className="w-3.5 h-3.5" />}   label="Abrir Vehículo"  disabled badge="Próximamente" />
          <Accion icon={<User className="w-3.5 h-3.5" />}  label="Abrir Conductor" disabled badge="Próximamente" />
        </div>
      </PanelSection>

      {/* Coordenadas */}
      {(vehiculo.lat !== null && vehiculo.lon !== null) && (
        <PanelSection title="Posición" icon={<MapPin className="w-3.5 h-3.5" />}>
          <div className="flex gap-3">
            <InfoRow label="Latitud"  value={vehiculo.lat.toFixed(6)}  mono />
            <InfoRow label="Longitud" value={vehiculo.lon.toFixed(6)}  mono />
          </div>
          <a
            href={`https://maps.google.com/?q=${vehiculo.lat},${vehiculo.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--navy)", background: "#DBEAFE", border: "1px solid #BFDBFE" }}
          >
            <MapPin className="w-3 h-3" />
            Ver en Google Maps
          </a>
        </PanelSection>
      )}
    </SidePanel>
  );
}
