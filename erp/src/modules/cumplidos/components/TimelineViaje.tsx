import {
  ClipboardList, CalendarClock, Truck, CheckCircle2, FileCheck,
} from "lucide-react";
import { PanelSection } from "@/components/ui";
import { fmtTms } from "@/utils/parseFecha";
import type { CumplidoRecord } from "../types";

type ItemStatus = "completed" | "active" | "pending";

const STATUS_COLOR: Record<ItemStatus, string> = {
  completed: "#059669",
  active:    "var(--navy)",
  pending:   "var(--gray-300)",
};
const STATUS_BG: Record<ItemStatus, string> = {
  completed: "#D1FAE5",
  active:    "#DBEAFE",
  pending:   "var(--gray-100)",
};

interface TLItemProps {
  icon:      React.ReactNode;
  label:     string;
  sublabel?: string;
  timestamp?: string;
  status:    ItemStatus;
  isLast?:   boolean;
}

function TLItem({ icon, label, sublabel, timestamp, status, isLast }: TLItemProps) {
  const color = STATUS_COLOR[status];
  const bg    = STATUS_BG[status];
  const dim   = status === "pending";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: bg, color, border: `2px solid ${color}`, opacity: dim ? 0.35 : 1 }}
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center">{icon}</span>
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-1"
            style={{ background: dim ? "var(--gray-100)" : "var(--gray-200)", minHeight: 20 }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[13px] font-semibold"
            style={{ color: dim ? "var(--gray-300)" : "var(--gray-800)" }}
          >
            {label}
          </span>
          {timestamp && (
            <span
              className="text-[11px] font-mono shrink-0"
              style={{ color: dim ? "var(--gray-200)" : "var(--gray-400)" }}
            >
              {timestamp}
            </span>
          )}
        </div>
        {sublabel && (
          <p
            className="text-[11px] mt-0.5 leading-snug"
            style={{ color: dim ? "var(--gray-200)" : "var(--gray-400)" }}
          >
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

function estadoDocLabel(cumplido: CumplidoRecord): string {
  if (cumplido.estado_cumplido === "SOLICITADO")        return "Documentos solicitados al conductor";
  if (cumplido.estado_cumplido === "CUMPLIDO RECIBIDO") return "Documentos recibidos físicamente";
  if (cumplido.estado_cumplido === "CUMPLIDO ENVIADO")  return "Documentos enviados al área de facturación";
  if (cumplido.estado_cumplido === "LIQUIDADO")         return "Liquidado y cerrado";
  if (cumplido.tiene_soporte)                           return "Al menos un documento subido al expediente";
  return "Sin documentación recibida aún";
}

function estadoDocStatus(cumplido: CumplidoRecord): ItemStatus {
  const e = cumplido.estado_cumplido ?? "";
  if (["CUMPLIDO ENVIADO", "LIQUIDADO", "CUMPLIDO RECIBIDO"].includes(e)) return "completed";
  if (e === "SOLICITADO" || cumplido.tiene_soporte) return "active";
  return "pending";
}

export function TimelineViaje({ cumplido }: { cumplido: CumplidoRecord }) {
  const docStatus = estadoDocStatus(cumplido);

  return (
    <PanelSection title="Timeline del viaje" icon={<ClipboardList className="w-3.5 h-3.5" />}>
      <div className="pt-1">
        <TLItem
          icon={<ClipboardList className="w-3 h-3" />}
          label="Solicitud creada"
          sublabel="Servicio registrado en el sistema"
          timestamp={fmtTms(cumplido.created_on, "MDY")}
          status="completed"
        />
        <TLItem
          icon={<CalendarClock className="w-3 h-3" />}
          label="Viaje programado"
          sublabel="Asignación de vehículo y conductor confirmada"
          status="completed"
        />
        <TLItem
          icon={<Truck className="w-3 h-3" />}
          label="Viaje en tránsito"
          sublabel="Servicio activo en plataforma de monitoreo"
          timestamp={fmtTms(cumplido.activated_on, "MDY")}
          status="completed"
        />
        <TLItem
          icon={<CheckCircle2 className="w-3 h-3" />}
          label="Viaje finalizado"
          sublabel="Servicio completado en la plataforma"
          timestamp={fmtTms(cumplido.fecha_cumplido, "DMY")}
          status="completed"
        />
        <TLItem
          icon={<FileCheck className="w-3 h-3" />}
          label="Documentación de cumplido"
          sublabel={estadoDocLabel(cumplido)}
          status={docStatus}
          isLast
        />
      </div>
    </PanelSection>
  );
}
