import {
  Truck, CalendarClock, ClipboardList, Map, Receipt,
  Building2, Car, User, ChevronRight,
} from "lucide-react";
import { PanelSection } from "@/components/ui";
import { useNavigationContext, navActions } from "@/core/navigation";
import type { CumplidoRecord } from "../types";

interface ConexionProps {
  icon:      React.ReactNode;
  label:     string;
  onClick?:  () => void;
  disabled?: boolean;
  motivo?:   string;
}

function Conexion({ icon, label, onClick, disabled, motivo }: ConexionProps) {
  return (
    <div>
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
        {!disabled && <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />}
        {disabled && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: "var(--gray-100)", color: "var(--gray-300)" }}
          >
            Próximamente
          </span>
        )}
      </button>
      {disabled && motivo && (
        <p className="text-[10px] px-3 pt-0.5 pb-1" style={{ color: "var(--gray-300)" }}>
          {motivo}
        </p>
      )}
    </div>
  );
}

export function ConexionesCumplido({ cumplido }: { cumplido: CumplidoRecord }) {
  const { navigateTo } = useNavigationContext();
  const trip           = cumplido.trip_number;

  return (
    <PanelSection title="Conexiones" icon={<ChevronRight className="w-3.5 h-3.5" />}>
      <div className="flex flex-col gap-2">
        <Conexion
          icon={<Truck className="w-3.5 h-3.5" />}
          label="Abrir Viaje"
          onClick={() => navigateTo(navActions.verViaje(trip, "cumplidos"))}
        />
        <Conexion
          icon={<CalendarClock className="w-3.5 h-3.5" />}
          label="Abrir Programación"
          onClick={() => navigateTo(navActions.verProgramacion(trip, "cumplidos"))}
        />
        <Conexion
          icon={<ClipboardList className="w-3.5 h-3.5" />}
          label="Abrir Solicitud"
          onClick={() => navigateTo(navActions.verSolicitud(trip, "cumplidos"))}
        />
        <Conexion
          icon={<Map className="w-3.5 h-3.5" />}
          label="Abrir GPS"
          onClick={() => navigateTo(navActions.verGps(cumplido.license_plate ?? "", trip, "cumplidos"))}
        />
        <Conexion
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Abrir Cliente"
          disabled
          motivo="Módulo de clientes en desarrollo"
        />
        <Conexion
          icon={<Car className="w-3.5 h-3.5" />}
          label="Abrir Vehículo"
          disabled
          motivo="Módulo de vehículos en desarrollo"
        />
        <Conexion
          icon={<User className="w-3.5 h-3.5" />}
          label="Abrir Conductor"
          disabled
          motivo="Módulo de conductores en desarrollo"
        />
        <Conexion
          icon={<Receipt className="w-3.5 h-3.5" />}
          label="Abrir Facturación"
          disabled
          motivo="Módulo de facturación en desarrollo"
        />
      </div>
    </PanelSection>
  );
}
