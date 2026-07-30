import { MapPin, Navigation } from "lucide-react";
import { PanelSection } from "@/components/ui";
import type { TmsViaje } from "../types";

export function SeguimientoPanel({ viaje }: { viaje: TmsViaje }) {
  return (
    <PanelSection title="Seguimiento GPS" icon={<Navigation className="w-3.5 h-3.5" />}>
      {viaje.current_address_location ? (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--gray-400)" }} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--gray-400)" }}>
              Última posición conocida
            </div>
            <p className="text-[12px] leading-snug" style={{ color: "var(--gray-700)" }}>
              {viaje.current_address_location}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 text-[12px] px-3 py-2.5 rounded-xl"
          style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          Sin posición registrada actualmente
        </div>
      )}
    </PanelSection>
  );
}
