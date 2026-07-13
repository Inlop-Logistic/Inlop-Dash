import {
  Truck, FileText, Search, CheckCircle2, Receipt, ClipboardCheck,
} from "lucide-react";
import { PanelSection } from "@/components/ui";
import { fmtTms } from "@/utils/parseFecha";
import type { CumplidoRecord } from "../types";

type ItemStatus = "completed" | "active" | "pending";

interface TLItemProps {
  icon:       React.ReactNode;
  label:      string;
  sublabel?:  string;
  timestamp?: string;
  status:     ItemStatus;
  isLast?:    boolean;
}

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
          <div className="w-0.5 flex-1 mt-1" style={{ background: dim ? "var(--gray-100)" : "var(--gray-200)", minHeight: 20 }} />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-semibold" style={{ color: dim ? "var(--gray-300)" : "var(--gray-800)" }}>
            {label}
          </span>
          {timestamp && (
            <span className="text-[11px] font-mono shrink-0" style={{ color: dim ? "var(--gray-200)" : "var(--gray-400)" }}>
              {timestamp}
            </span>
          )}
        </div>
        {sublabel && (
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: dim ? "var(--gray-200)" : "var(--gray-400)" }}>
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

export function TimelineCumplido({ cumplido }: { cumplido: CumplidoRecord }) {
  const estado = cumplido.estado_documental;

  const POS: Record<string, number> = {
    pendiente: 1, en_revision: 2, con_observaciones: 2,
    aprobado: 3, rechazado: 3, listo_facturacion: 4,
  };
  const pos = POS[estado] ?? 1;

  const s = (threshold: number): ItemStatus =>
    pos > threshold ? "completed" : pos === threshold ? "active" : "pending";

  return (
    <PanelSection title="Timeline documental" icon={<ClipboardCheck className="w-3.5 h-3.5" />}>
      <div className="pt-1">
        <TLItem
          icon={<Truck className="w-3 h-3" />}
          label="Viaje finalizado"
          sublabel="Servicio completado en la plataforma de monitoreo"
          timestamp={fmtTms(cumplido.activated_on, "DMY")}
          status="completed"
        />
        <TLItem
          icon={<FileText className="w-3 h-3" />}
          label="Documentación recibida"
          sublabel="Expediente físico recibido por el área operativa"
          status={s(1)}
        />
        <TLItem
          icon={<Search className="w-3 h-3" />}
          label="Documentación revisada"
          sublabel="Revisión de checklist documental completada"
          timestamp={cumplido.fecha_validacion ? fmtTms(cumplido.fecha_validacion, "DMY") : undefined}
          status={s(2)}
        />
        <TLItem
          icon={<CheckCircle2 className="w-3 h-3" />}
          label="Aprobado"
          sublabel={cumplido.aprobado_por ? `Por ${cumplido.aprobado_por}` : "Expediente validado"}
          status={s(3)}
        />
        <TLItem
          icon={<Receipt className="w-3 h-3" />}
          label="Listo para facturación"
          sublabel="Expediente completo y aprobado para facturar"
          status={s(4)}
          isLast
        />
      </div>
    </PanelSection>
  );
}
