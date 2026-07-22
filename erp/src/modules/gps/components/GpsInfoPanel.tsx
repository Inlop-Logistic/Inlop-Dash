import {
  Monitor, User, MapPin, Truck, CalendarClock,
  ClipboardList, CheckSquare, ChevronRight, X, AlertTriangle,
} from "lucide-react";
import { useNavigationContext, navActions } from "@/core/navigation";
import { fmtTms } from "@/utils/parseFecha";
import { EstadoGpsBadge } from "./EstadoGpsBadge";
import { GpsStatusCard } from "./GpsStatusCard";
import { ESTADO_GPS_CFG } from "../constants";
import type { GpsRecord } from "../types";

interface GpsInfoPanelProps {
  vehiculo:  GpsRecord | null;
  vehiculos: GpsRecord[];
  loading:   boolean;
  onSelect:  (id: string) => void;
  onClose:   () => void;
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--gray-150,var(--gray-200))", borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--gray-400)" }}>
      {children}
    </div>
  );
}

function DataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-[11px] shrink-0" style={{ color: "var(--gray-400)" }}>{label}</span>
      <span className={`text-[11px] font-medium text-right truncate ${mono ? "font-mono" : ""}`} style={{ color: "var(--gray-700)" }}>
        {value}
      </span>
    </div>
  );
}

function NavBtn({ icon, label, onClick, disabled, badge }: {
  icon: React.ReactNode; label: string;
  onClick?: () => void; disabled?: boolean; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors"
      style={{
        background: disabled ? "var(--gray-50)" : "#fff",
        color:      disabled ? "var(--gray-300)" : "var(--gray-700)",
        border:     `1px solid ${disabled ? "var(--gray-100)" : "var(--gray-200)"}`,
        cursor:     disabled ? "not-allowed" : "pointer",
      }}
    >
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      {disabled && badge ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--gray-100)", color: "var(--gray-300)" }}>
          {badge}
        </span>
      ) : !disabled ? (
        <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--gray-400)" }} />
      ) : null}
    </button>
  );
}

function EmptyState({ vehiculos, loading, onSelect }: {
  vehiculos: GpsRecord[]; loading: boolean; onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-center justify-center py-7 px-4 shrink-0">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
             style={{ background: "var(--gray-100)" }}>
          <Monitor className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
        </div>
        <div className="text-[13px] font-semibold text-center mb-1" style={{ color: "var(--gray-600)" }}>
          Torre de Control
        </div>
        <div className="text-[11px] text-center leading-relaxed" style={{ color: "var(--gray-400)" }}>
          Seleccione un vehículo en el mapa o en la lista para ver su ficha
        </div>
      </div>

      <div style={{ height: 1, background: "var(--gray-100)", margin: "0 12px 10px" }} />

      <div className="px-3 pb-1.5 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray-400)" }}>
          {loading && vehiculos.length === 0 ? "Cargando…" : `${vehiculos.length} vehículo${vehiculos.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {vehiculos.length === 0 && !loading ? (
          <div className="text-[12px] py-4 text-center" style={{ color: "var(--gray-400)" }}>
            Sin vehículos para los filtros activos.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {vehiculos.map((v) => {
              const cfg = ESTADO_GPS_CFG[v.estadoGps];
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors"
                  style={{ background: "#fff", border: "1px solid var(--gray-100)", cursor: "pointer" }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
                  <span className="text-[11px] font-bold font-mono tracking-wider shrink-0 w-[68px]"
                        style={{ color: "var(--navy)" }}>
                    {v.license_plate ?? "—"}
                  </span>
                  <span className="text-[11px] truncate flex-1" style={{ color: "var(--gray-500)" }}>
                    {v.driver_name ?? "Sin conductor"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function GpsInfoPanel({ vehiculo, vehiculos, loading, onSelect, onClose }: GpsInfoPanelProps) {
  const { navigateTo } = useNavigationContext();

  if (!vehiculo) {
    return (
      <div className="flex flex-col h-full rounded-xl overflow-hidden"
           style={{ border: "1px solid var(--gray-200)", background: "var(--gray-50)" }}>
        <EmptyState vehiculos={vehiculos} loading={loading} onSelect={onSelect} />
      </div>
    );
  }

  const trip    = vehiculo.trip_number;
  const cliente = vehiculo.company_customer_name?.split(",")[0].trim() ?? "—";

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden"
         style={{ border: "1px solid var(--gray-200)", background: "var(--gray-50)" }}>

      {/* Ficha header */}
      <div className="px-3.5 py-3 shrink-0 flex items-center gap-2"
           style={{ background: "#fff", borderBottom: "1px solid var(--gray-100)" }}>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <div className="text-[15px] font-bold font-mono tracking-widest leading-none"
               style={{ color: "var(--navy)" }}>
            {vehiculo.license_plate ?? "Sin placa"}
          </div>
          <div className="text-[11px] truncate" style={{ color: "var(--gray-400)" }}>{cliente}</div>
        </div>
        <EstadoGpsBadge estado={vehiculo.estadoGps} size="sm" />
        <button type="button" onClick={onClose} aria-label="Cerrar ficha"
                className="w-6 h-6 flex items-center justify-center rounded-lg shrink-0"
                style={{ color: "var(--gray-400)", background: "var(--gray-100)" }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable ficha content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">

        {/* Ubicación */}
        <div>
          <SectionLabel>Ubicación</SectionLabel>
          <GpsStatusCard vehiculo={vehiculo} />
        </div>

        {/* Ruta */}
        <div>
          <SectionLabel>Ruta</SectionLabel>
          <InfoCard>
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--navy)" }} />
                <div className="w-0.5 h-5" style={{ background: "var(--gray-200)" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--inlop-red)" }} />
              </div>
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Origen</div>
                  <div className="text-[12px] font-semibold truncate" style={{ color: "var(--gray-800)" }}>
                    {vehiculo.origin_city_name ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
                  <div className="text-[12px] font-semibold truncate" style={{ color: "var(--gray-800)" }}>
                    {vehiculo.destiny_city_name ?? "—"}
                  </div>
                </div>
              </div>
            </div>
          </InfoCard>
        </div>

        {/* Conductor */}
        <div>
          <SectionLabel>Conductor</SectionLabel>
          <InfoCard>
            {vehiculo.driver_name ? (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-[12px] shrink-0"
                     style={{ background: "var(--navy)", color: "#fff" }}>
                  {vehiculo.driver_name.charAt(0).toUpperCase()}
                </div>
                <div className="text-[12px] font-semibold truncate" style={{ color: "var(--gray-800)" }}>
                  {vehiculo.driver_name}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--gray-400)" }}>
                <User className="w-3.5 h-3.5 shrink-0" />
                Sin conductor asignado
              </div>
            )}
          </InfoCard>
        </div>

        {/* Viaje */}
        <div>
          <SectionLabel>Viaje</SectionLabel>
          <InfoCard>
            <div className="flex flex-col gap-1.5">
              <DataRow label="Viaje"     value={vehiculo.trip_number}         mono />
              <DataRow label="Remisión"  value={vehiculo.number_order ?? "—"} mono />
              <DataRow label="Estado"    value={vehiculo.state_travel} />
              <DataRow label="Cliente"   value={cliente} />
              {vehiculo.latest_gps_report && (
                <DataRow
                  label="Señal"
                  value={fmtTms(vehiculo.latest_gps_report, "MDY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                />
              )}
              {vehiculo.lat != null && vehiculo.lon != null && (
                <>
                  <div style={{ height: 1, background: "var(--gray-100)", margin: "2px 0" }} />
                  <div className="flex gap-4">
                    <DataRow label="Lat" value={vehiculo.lat.toFixed(5)} mono />
                    <DataRow label="Lon" value={vehiculo.lon.toFixed(5)} mono />
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${vehiculo.lat},${vehiculo.lon}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg mt-0.5"
                    style={{ color: "var(--navy)", background: "#DBEAFE", border: "1px solid #BFDBFE" }}
                  >
                    <MapPin className="w-3 h-3" />
                    Ver en Google Maps
                  </a>
                </>
              )}
            </div>
          </InfoCard>
        </div>

        {/* Alarma activa */}
        {vehiculo.last_alarm_name && (
          <div>
            <SectionLabel>Alarma activa</SectionLabel>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-semibold"
                 style={{ background: "#FEE2E2", color: "#9F1239", border: "1px solid #FECACA" }}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {vehiculo.last_alarm_name}
            </div>
          </div>
        )}

        {/* Acciones de navegación */}
        <div>
          <SectionLabel>Navegar a</SectionLabel>
          <div className="flex flex-col gap-1">
            <NavBtn icon={<Truck        className="w-3 h-3" />} label="Viaje"         onClick={() => navigateTo(navActions.verViaje(trip, "mapa"))} />
            <NavBtn icon={<CalendarClock className="w-3 h-3" />} label="Programación" onClick={() => navigateTo(navActions.verProgramacion(trip, "mapa"))} />
            <NavBtn icon={<ClipboardList className="w-3 h-3" />} label="Solicitud"    onClick={() => navigateTo(navActions.verSolicitud(trip, "mapa"))} />
            <NavBtn icon={<CheckSquare  className="w-3 h-3" />} label="Cumplido"     onClick={() => navigateTo(navActions.verCumplidos(trip, "mapa"))} />
          </div>
        </div>

      </div>
    </div>
  );
}
