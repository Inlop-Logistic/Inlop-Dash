import { CheckCircle, XCircle } from "lucide-react";
import { fmtFecha } from "@/utils/date";
import { ESTADO_CFG, ESTADO_FLOW } from "../constants";
import type { HistorialEstado } from "../types";

interface TimelineProps {
  historial:     HistorialEstado[];
  estadoActual:  string;
}

export function Timeline({ historial, estadoActual }: TimelineProps) {
  const isCancelado = estadoActual === "cancelado";

  if (isCancelado) {
    const entrada = historial.find((h) => h.estado === "cancelado");
    return (
      <div className="flex items-start gap-3">
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "#FFE4E6" }}
        >
          <XCircle className="w-3.5 h-3.5" style={{ color: "#E30613" }} />
        </div>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "#9F1239" }}>Cancelado</div>
          {entrada && (
            <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-400)" }}>
              {fmtFecha(entrada.cambiado_en)}
              {entrada.cambiado_por ? ` · ${entrada.cambiado_por}` : ""}
            </div>
          )}
          {entrada?.notas && (
            <div className="text-[12px] mt-1 px-2.5 py-1.5 rounded-lg" style={{ background: "#FFF1F2", color: "#9F1239" }}>
              {entrada.notas}
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentIdx = ESTADO_FLOW.indexOf(estadoActual as typeof ESTADO_FLOW[number]);

  return (
    <div className="flex flex-col gap-0">
      {ESTADO_FLOW.map((estado, idx) => {
        const done    = idx <= currentIdx;
        const active  = idx === currentIdx;
        const isLast  = idx === ESTADO_FLOW.length - 1;
        const entrada = historial.find((h) => h.estado === estado);
        const cfg     = ESTADO_CFG[estado];

        return (
          <div key={estado} className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center z-10"
                style={{
                  background: done ? (active ? cfg.bg : "#D1FAE5") : "var(--gray-100)",
                  border: active ? `2px solid ${cfg.dot}` : "2px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                {done && !active && (
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "#059669" }} />
                )}
                {active && (
                  <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                )}
                {!done && (
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--gray-300)" }} />
                )}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 flex-1 min-h-[20px]"
                  style={{ background: done && !active ? "#D1FAE5" : "var(--gray-100)", marginTop: 2 }}
                />
              )}
            </div>

            <div className="pb-4 min-w-0 flex-1">
              <div
                className="text-[13px] font-semibold"
                style={{ color: active ? cfg.color : done ? "var(--gray-700)" : "var(--gray-300)" }}
              >
                {cfg?.label ?? estado}
              </div>
              {entrada ? (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                  {fmtFecha(entrada.cambiado_en)}
                  {entrada.cambiado_por ? ` · ${entrada.cambiado_por}` : ""}
                </div>
              ) : (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-300)" }}>
                  {done ? "Completado" : "Pendiente"}
                </div>
              )}
              {entrada?.notas && (
                <div className="text-[11px] mt-1 italic" style={{ color: "var(--gray-400)" }}>
                  {entrada.notas}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
