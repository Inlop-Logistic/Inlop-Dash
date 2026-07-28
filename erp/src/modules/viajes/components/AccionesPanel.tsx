import { Map, CheckSquare, Building2, ChevronRight, Link2 } from "lucide-react";
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

  return (
    <PanelSection title="Conexiones" icon={<Link2 className="w-3.5 h-3.5" />}>
      <div className="flex flex-col gap-2">

        {/* Cliente — siempre habilitado */}
        <Accion
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Cliente"
          onClick={() => navigateTo(navActions.verCliente(viaje.empresa_cliente_id ?? "", "viajes"))}
          tooltip="Abrir la ficha del cliente"
        />

        {/* Centro GPS — siempre habilitado */}
        <Accion
          icon={<Map className="w-3.5 h-3.5" />}
          label="Centro GPS"
          onClick={() => navigateTo(navActions.verGps(viaje.license_plate ?? "", trip, "viajes"))}
          tooltip="Abrir el mapa con el vehículo seleccionado"
        />

        {/* Viajes Finalizados — habilitado cuando existe trip_number */}
        <Accion
          icon={<CheckSquare className="w-3.5 h-3.5" />}
          label="Viajes Finalizados"
          onClick={trip ? () => navigateTo(navActions.verCumplidos(trip, "viajes")) : undefined}
          disabled={!trip}
          tooltip={trip
            ? "Buscar el registro de este viaje en Viajes Finalizados"
            : "Este viaje aún no cuenta con un registro en Viajes Finalizados."}
        />

      </div>
    </PanelSection>
  );
}
