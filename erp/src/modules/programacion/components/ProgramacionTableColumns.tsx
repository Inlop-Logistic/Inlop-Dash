import { ChevronRight, ArrowRight, AlertTriangle } from "lucide-react";
import { fmtHora } from "@/utils/date";
import type { Column } from "@/components/ui";
import type { ViajeResumen } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { estadoVisual } from "../constants";

export const COLUMNS: Column<ViajeResumen>[] = [
  {
    key: "hora",
    header: "Salida",
    width: "96px",
    render: (v) => {
      const esVencido = estadoVisual(v) === "vencido";
      return (
        <div className="flex items-start gap-1">
          <div>
            <div className="text-[13px] font-bold tabular-nums leading-tight" style={{ color: esVencido ? "#92400E" : "var(--navy)" }}>
              {fmtHora(v.schedulate_origin)}
            </div>
            <div className="text-[10px] font-mono leading-tight mt-0.5" style={{ color: "var(--gray-400)" }}>
              {v.trip_number}
            </div>
          </div>
          {esVencido && (
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "#F59E0B" }} />
          )}
        </div>
      );
    },
  },
  {
    key: "cliente",
    header: "Cliente",
    render: (v) => (
      <div className="text-[13px] font-medium truncate" style={{ color: v.company_customer_name ? "var(--gray-800)" : "var(--gray-300)" }}>
        {v.company_customer_name ?? "Sin cliente"}
      </div>
    ),
  },
  {
    key: "conductor",
    header: "Conductor",
    render: (v) => (
      <div>
        <div className="text-[13px] truncate" style={{ color: v.driver_name ? "var(--gray-700)" : "var(--gray-300)" }}>
          {v.driver_name ?? "Sin asignar"}
        </div>
        {v.license_plate && (
          <div className="text-[11px] font-mono leading-tight mt-0.5" style={{ color: "var(--gray-400)" }}>
            {v.license_plate}
          </div>
        )}
      </div>
    ),
  },
  {
    key: "ruta",
    header: "Ruta",
    render: (v) => (
      <div className="text-[12px]" style={{ color: "var(--gray-600)" }}>
        <span className="font-medium">{v.city_origin ?? "—"}</span>
        <span className="inline-flex items-center mx-1" style={{ color: "var(--gray-300)" }}>
          <ArrowRight className="w-3 h-3" />
        </span>
        <span>{v.city_destination ?? "—"}</span>
      </div>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    width: "130px",
    render: (v) => <EstadoBadge estado={estadoVisual(v)} />,
  },
  {
    key: "arrow",
    header: "",
    width: "28px",
    render: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
  },
];
