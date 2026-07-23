import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { PanelSection } from "@/components/ui";
import type { TmsViaje } from "../types";

interface AlarmasProps {
  viaje: TmsViaje;
}

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  alta:  { label: "Alta",  color: "#DC2626", bg: "#FEE2E2", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  media: { label: "Media", color: "#D97706", bg: "#FEF3C7", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  baja:  { label: "Baja",  color: "#2563EB", bg: "#DBEAFE", icon: <Info className="w-3.5 h-3.5" /> },
};

function getPriority(priority: string | null | undefined) {
  return PRIORITY_CFG[(priority ?? "").toLowerCase()] ?? PRIORITY_CFG["alta"];
}

export function AlarmasPanel({ viaje }: AlarmasProps) {
  const tieneAlarma = !!viaje.last_alarm_name;

  return (
    <PanelSection title="Alarmas" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
      {!tieneAlarma ? (
        <div
          className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-[12px] font-medium"
          style={{ background: "#D1FAE5", color: "#065F46", border: "1px solid #A7F3D0" }}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#059669" }} />
          Sin alarmas activas
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Alarma principal */}
          <AlarmCard
            name={viaje.last_alarm_name!}
            code={viaje.alarm_code}
            description={viaje.alarm_description}
            priority={viaje.alarm_priority}
          />

          {/* Aviso de campos futuros */}
          <div
            className="text-[11px] px-3 py-2 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-400)", border: "1px solid var(--gray-100)" }}
          >
            Historial de alarmas disponible próximamente
          </div>
        </div>
      )}
    </PanelSection>
  );
}

interface AlarmCardProps {
  name:         string;
  code?:        string | null;
  description?: string | null;
  priority?:    string | null;
}

function AlarmCard({ name, code, description, priority }: AlarmCardProps) {
  const cfg = getPriority(priority ?? "alta");
  return (
    <div
      className="px-3 py-3 rounded-xl flex flex-col gap-1.5"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2" style={{ color: cfg.color }}>
          {cfg.icon}
          <span className="text-[13px] font-semibold">{name}</span>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: cfg.color, color: "#fff" }}
        >
          {cfg.label}
        </span>
      </div>
      {code && (
        <span className="text-[11px] font-mono" style={{ color: cfg.color }}>
          Código: {code}
        </span>
      )}
      {description && (
        <p className="text-[12px] leading-snug" style={{ color: cfg.color }}>
          {description}
        </p>
      )}
    </div>
  );
}
