import { CalendarClock, ClipboardList, Map, CheckSquare, Car, User, Building2, ChevronRight } from "lucide-react";
import { PanelSection } from "@/components/ui";
import { useNavigationContext, navActions } from "@/core/navigation";
import type { TmsViaje } from "../types";

interface AccionProps {
  icon:      React.ReactNode;
  label:     string;
  onClick?:  () => void;
  disabled?: boolean;
  badge?:    string;
  tooltip?:  string;
}

function Accion({ icon, label, onClick, disabled, badge, tooltip }: AccionProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={tooltip}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
      style={{
        background: disabled ? "var(--gray-50)" : "#fff",
        color:      disabled ? "var(--gray-300)" : "var(--gray-700)",
        border:     `1.5px solid ${disabled ? "var(--gray-100)" : "var(--gray-200)"}`,
        cursor:     disabled ? "not-allowed" : "pointer",
      }}
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      {disabled && badge ? (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--gray-100)", color: "var(--gray-300)" }}>
          {badge}
        </span>
      ) : !disabled ? (
        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
      ) : null}
    </button>
  );
}

export function AccionesPanel({ viaje }: { viaje: TmsViaje }) {
  const { navigateTo } = useNavigationContext();
  const trip = viaje.trip_number;

  const tienePrograma  = navActions.implementado("programacion");
  const tieneSolicitud = navActions.implementado("solicitudes");
  const tieneMapa      = navActions.implementado("mapa");
  const tieneCumplidos = navActions.implementado("cumplidos");
  const tieneClientes  = navActions.implementado("clientes");

  return (
    <PanelSection title="Acciones" icon={<ChevronRight className="w-3.5 h-3.5" />}>
      <div className="flex flex-col gap-2">
        <Accion
          icon={<CalendarClock className="w-3.5 h-3.5" />}
          label="Abrir Programación"
          onClick={() => navigateTo(navActions.verProgramacion(trip, "viajes"))}
          disabled={!tienePrograma}
          badge={!tienePrograma ? "No disponible" : undefined}
          tooltip={tienePrograma ? "Ver la programación asociada a este viaje" : "Módulo de programación no disponible"}
        />
        <Accion
          icon={<ClipboardList className="w-3.5 h-3.5" />}
          label="Abrir Solicitud"
          onClick={() => navigateTo(navActions.verSolicitud(trip, "viajes"))}
          disabled={!tieneSolicitud}
          badge={!tieneSolicitud ? "No disponible" : undefined}
          tooltip={tieneSolicitud ? "Ver la solicitud de origen del viaje" : "Módulo de solicitudes no disponible"}
        />
        <Accion
          icon={<Map className="w-3.5 h-3.5" />}
          label="Abrir GPS"
          onClick={() => navigateTo(navActions.verGps(viaje.license_plate ?? "", trip, "viajes"))}
          disabled={!tieneMapa}
          badge={!tieneMapa ? "No disponible" : undefined}
          tooltip={tieneMapa ? "Ver seguimiento GPS en el mapa" : "Módulo de mapa no disponible"}
        />
        <Accion
          icon={<CheckSquare className="w-3.5 h-3.5" />}
          label="Abrir Viajes Finalizados"
          onClick={() => navigateTo(navActions.verCumplidos(trip, "viajes"))}
          disabled={!tieneCumplidos}
          badge={!tieneCumplidos ? "No disponible" : undefined}
          tooltip={tieneCumplidos ? "Ver cumplidos y documentos del viaje" : "Módulo de cumplidos no disponible"}
        />
        <Accion
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Abrir Cliente"
          onClick={tieneClientes && viaje.empresa_cliente_id
            ? () => navigateTo(navActions.verCliente(viaje.empresa_cliente_id!, "viajes"))
            : undefined}
          disabled={!tieneClientes || !viaje.empresa_cliente_id}
          badge={!tieneClientes ? "Próximamente" : !viaje.empresa_cliente_id ? "Sin cliente" : undefined}
          tooltip={tieneClientes && viaje.empresa_cliente_id ? "Ver ficha del cliente" : undefined}
        />
        <Accion
          icon={<Car className="w-3.5 h-3.5" />}
          label="Abrir Vehículo"
          disabled
          badge="Próximamente"
        />
        <Accion
          icon={<User className="w-3.5 h-3.5" />}
          label="Abrir Conductor"
          disabled
          badge="Próximamente"
        />
      </div>
    </PanelSection>
  );
}
