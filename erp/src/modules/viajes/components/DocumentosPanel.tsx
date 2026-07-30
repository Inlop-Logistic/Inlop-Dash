import { FileText, ChevronRight, FileSignature, Receipt, ClipboardCheck, CalendarClock, ClipboardList } from "lucide-react";
import { PanelSection } from "@/components/ui";
import { useNavigationContext, navActions } from "@/core/navigation";
import type { TmsViaje } from "../types";

interface DocRowProps {
  icon:      React.ReactNode;
  label:     string;
  value?:    string | null;
  onClick?:  () => void;
  disabled?: boolean;
  badge?:    string;
}

function DocRow({ icon, label, value, onClick, disabled, badge }: DocRowProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] transition-colors"
      style={{
        background: disabled ? "var(--gray-50)" : "#fff",
        color:      disabled ? "var(--gray-300)" : "var(--gray-700)",
        border:     `1.5px solid ${disabled ? "var(--gray-100)" : "var(--gray-200)"}`,
        cursor:     disabled ? "not-allowed" : onClick ? "pointer" : "default",
        fontWeight: disabled ? 400 : 500,
      }}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
        {value && (
          <span className="text-[11px] font-mono" style={{ color: "var(--gray-400)" }}>
            {value}
          </span>
        )}
      </span>
      {disabled && badge ? (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--gray-100)", color: "var(--gray-300)" }}>
          {badge}
        </span>
      ) : onClick && !disabled ? (
        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
      ) : null}
    </button>
  );
}

export function DocumentosPanel({ viaje }: { viaje: TmsViaje }) {
  const { navigateTo } = useNavigationContext();

  return (
    <PanelSection title="Documentos asociados" icon={<FileText className="w-3.5 h-3.5" />}>
      <div className="flex flex-col gap-2">
        <DocRow
          icon={<ClipboardList className="w-3.5 h-3.5" />}
          label="Solicitud origen"
          onClick={() => navigateTo(navActions.verSolicitud(viaje.trip_number, "viajes"))}
        />
        <DocRow
          icon={<CalendarClock className="w-3.5 h-3.5" />}
          label="Programación"
          onClick={() => navigateTo(navActions.verProgramacion(viaje.trip_number, "viajes"))}
        />
        <DocRow
          icon={<ClipboardCheck className="w-3.5 h-3.5" />}
          label="Cumplido"
          disabled
          badge="Próximamente"
        />
        <DocRow
          icon={<Receipt className="w-3.5 h-3.5" />}
          label="Factura"
          disabled
          badge="Próximamente"
        />
        <DocRow
          icon={<FileSignature className="w-3.5 h-3.5" />}
          label="Evidencias / Firma"
          disabled
          badge="Próximamente"
        />
      </div>
    </PanelSection>
  );
}
