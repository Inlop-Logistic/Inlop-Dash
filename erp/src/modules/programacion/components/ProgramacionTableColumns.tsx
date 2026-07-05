import { ChevronRight, User, Car, ArrowRight, AlertTriangle } from "lucide-react";
import { fmtHora } from "@/utils/date";
import type { Column } from "@/components/ui";
import type { ViajeResumen } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { estadoVisual } from "../constants";

export const COLUMNS: Column<ViajeResumen>[] = [
  {
    key: "hora",
    header: "Hora",
    width: "120px",
    render: (v) => {
      const esVencido = estadoVisual(v) === "vencido";
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold tabular-nums" style={{ color: esVencido ? "#92400E" : "var(--navy)" }}>
              {fmtHora(v.schedulate_origin)}
            </span>
            {esVencido && (
              <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "#F59E0B" }} />
            )}
          </div>
          <div className="text-[11px] font-mono" style={{ color: "var(--gray-400)" }}>
            {v.trip_number}
          </div>
        </div>
      );
    },
  },
  {
    key: "cliente",
    header: "Cliente",
    render: (v) => (
      <div className="text-[13px] font-medium" style={{ color: "var(--gray-700)" }}>
        {v.company_customer_name ?? <span style={{ color: "var(--gray-300)" }}>Sin cliente</span>}
      </div>
    ),
  },
  {
    key: "conductor",
    header: "Conductor / placa",
    render: (v) => (
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--gray-500)" }}>
        {v.driver_name ? (
          <>
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{v.driver_name}</span>
          </>
        ) : (
          <span style={{ color: "var(--gray-300)" }}>Sin conductor</span>
        )}
        {v.license_plate && (
          <>
            <span style={{ color: "var(--gray-200)" }}>·</span>
            <Car className="w-3 h-3 shrink-0" />
            <span className="font-mono">{v.license_plate}</span>
          </>
        )}
      </div>
    ),
  },
  {
    key: "ruta",
    header: "Ruta",
    render: (v) => (
      <div className="text-[12px]" style={{ color: "var(--gray-600)" }}>
        <div className="font-medium">{v.city_origin ?? "—"}</div>
        <div className="flex items-center gap-1" style={{ color: "var(--gray-400)" }}>
          <ArrowRight className="w-3 h-3 shrink-0" />
          {v.city_destination ?? "—"}
        </div>
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
    width: "32px",
    render: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
  },
];
