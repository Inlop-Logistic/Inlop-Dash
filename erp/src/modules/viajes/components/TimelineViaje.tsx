import {
  ClipboardList, Truck, Package, Navigation, PackageOpen, CheckCircle2, XCircle, Moon,
} from "lucide-react";
import { PanelSection } from "@/components/ui";
import { fmtTms } from "@/utils/parseFecha";
import type { TmsViaje, TmsEvent } from "../types";
import { TimelineItem } from "./TimelineItem";

/** Posición ordinal de cada estado en el ciclo de vida. */
const STATE_POS: Record<string, number> = {
  "sin asignar":  0,
  "sin activar":  1,
  "iniciado":     2,
  "cargando":     3,
  "en transíto":  4,
  "pernoctando":  4,
  "descargando":  5,
  "completado":   6,
  "finalizado":   6,
  "cancelado":   -1,
};

interface Milestone {
  id:   string;
  pos:  number;
  label:       string;
  sublabel:    string;
  icon:        React.ReactNode;
  timestamp?:  string | null;
}

function buildMilestones(viaje: TmsViaje): Milestone[] {
  return [
    {
      id: "registrado", pos: 1, label: "Programado",
      sublabel: "Viaje registrado en el sistema",
      icon: <ClipboardList className="w-3 h-3" />,
      timestamp: fmtTms(viaje.created_on, "MDY"),
    },
    {
      id: "activado", pos: 2, label: "Activado",
      sublabel: "Servicio iniciado en la plataforma de monitoreo",
      icon: <Truck className="w-3 h-3" />,
      timestamp: fmtTms(viaje.activated_on, "MDY"),
    },
    {
      id: "cargue", pos: 3, label: "En Cargue",
      sublabel: "Proceso de cargue iniciado",
      icon: <Package className="w-3 h-3" />,
    },
    {
      id: "transito", pos: 4, label: "En Tránsito",
      sublabel: "Vehículo en ruta hacia el destino",
      icon: <Navigation className="w-3 h-3" />,
    },
    {
      id: "descargue", pos: 5, label: "En Descargue",
      sublabel: "Proceso de descargue en destino",
      icon: <PackageOpen className="w-3 h-3" />,
    },
    {
      id: "finalizado", pos: 6, label: "Finalizado",
      sublabel: "Servicio completado exitosamente",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
  ];
}

function milestoneStatus(milestonePos: number, currentPos: number, cancelled: boolean): TmsEvent["status"] {
  if (cancelled)              return "pending";
  if (currentPos > milestonePos)  return "completed";
  if (currentPos === milestonePos) return "active";
  return "pending";
}

export function TimelineViaje({ viaje }: { viaje: TmsViaje }) {
  const state      = (viaje.state_travel ?? "").toLowerCase();
  const cancelled  = state === "cancelado";
  const currentPos = cancelled ? -1 : (STATE_POS[state] ?? 0);
  const milestones = buildMilestones(viaje);

  return (
    <PanelSection title="Timeline" icon={<ClipboardList className="w-3.5 h-3.5" />}>
      <div className="pt-1">
        {cancelled && (
          <div className="mb-3">
            <TimelineItem
              icon={<XCircle className="w-3 h-3" />}
              label="Cancelado"
              sublabel="El viaje fue cancelado"
              status="cancelled"
              isLast
            />
          </div>
        )}

        {milestones.map((m, idx) => {
          const status = milestoneStatus(m.pos, currentPos, cancelled);
          const isPernoctando = state === "pernoctando" && m.id === "transito" && status === "active";
          return (
            <TimelineItem
              key={m.id}
              icon={isPernoctando ? <Moon className="w-3 h-3" /> : m.icon}
              label={isPernoctando ? "Pernoctando" : m.label}
              sublabel={isPernoctando ? "Vehículo en pernocta durante el tránsito" : m.sublabel}
              timestamp={m.timestamp && m.timestamp !== "—" ? m.timestamp : undefined}
              status={cancelled ? "pending" : status}
              isLast={idx === milestones.length - 1}
            />
          );
        })}
      </div>
    </PanelSection>
  );
}
